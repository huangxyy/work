import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, WorkerOptions } from 'bullmq';
import { SubmissionStatus } from '@prisma/client';
import { GradingError } from '../grading/grading.errors';
import { GradingService } from '../grading/grading.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { BaiduOcrConfig } from '../ocr/ocr.types';

class OcrError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type GradingJobData = {
  submissionId: string;
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
};

@Processor('grading')
export class GradingProcessor extends WorkerHost {
  private readonly logger = new Logger(GradingProcessor.name);
  private readonly concurrency = Number(process.env.WORKER_CONCURRENCY || '5');
  private readonly defaultApiKey: string;
  private readonly defaultSecretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gradingService: GradingService,
    private readonly systemConfigService: SystemConfigService,
    private readonly baiduOcrService: BaiduOcrService,
    configService: ConfigService,
  ) {
    super();
    this.defaultApiKey = configService.get<string>('BAIDU_OCR_API_KEY') || '';
    this.defaultSecretKey = configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';
  }

  protected getWorkerOptions(): WorkerOptions {
    return { concurrency: this.concurrency };
  }

  async process(job: Job<{ submissionId?: string; message?: string; requestedAt?: string }>) {
    if (job.name === 'demo') {
      return this.handleDemo(job);
    }

    if ((job.name === 'grading' || job.name === 'regrade') && job.data.submissionId) {
      return this.handleGrading(job as Job<GradingJobData>);
    }

    this.logger.warn(`Unhandled job ${job.id} (${job.name})`);
    return null;
  }

  private async handleDemo(job: Job<{ message?: string; requestedAt?: string }>) {
    const startedAt = Date.now();
    this.logger.log(`Processing demo job ${job.id} message=${job.data.message || ''}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const duration = Date.now() - startedAt;
    this.logger.log(`Completed demo job ${job.id} in ${duration}ms`);
    return { durationMs: duration };
  }

  private async handleGrading(job: Job<GradingJobData>) {
    const startedAt = Date.now();
    const { submissionId, mode, needRewrite } = job.data;
    const jobLabel = `${job.name}:${job.id}`;
    let ocrDurationMs = 0;
    let llmDurationMs = 0;
    let llmStartedAt: number | null = null;

    try {
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: SubmissionStatus.PROCESSING, errorCode: null, errorMsg: null },
      });

      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: { images: { orderBy: { createdAt: 'asc' } } },
      });

      if (!submission) {
        throw new OcrError('SUBMISSION_NOT_FOUND', 'Submission not found');
      }

      let mergedText = submission.ocrText?.trim() || '';
      if (!mergedText) {
        const ocrStart = Date.now();
        const ocrConfig = await this.getOcrConfig();
        const texts: string[] = [];
        const failedImages: number[] = [];
        const imageCount = submission.images.length;
        this.logger.log(`Starting OCR for submission ${submissionId} with ${imageCount} images`);

        for (let i = 0; i < submission.images.length; i++) {
          const image = submission.images[i];
          const imageStart = Date.now();
          try {
            const imageBuffer = await this.storage.getObject(image.objectKey);
            const ocrResult = await this.baiduOcrService.recognize(imageBuffer, ocrConfig);
            const imageDuration = Date.now() - imageStart;
            if (ocrResult.text?.trim()) {
              const textLength = ocrResult.text.trim().length;
              texts.push(ocrResult.text.trim());
              this.logger.log(`OCR image ${i + 1}/${imageCount} succeeded in ${imageDuration}ms, text length: ${textLength}`);
            } else {
              this.logger.warn(`OCR image ${i + 1}/${imageCount} returned empty text in ${imageDuration}ms`);
              failedImages.push(i + 1);
            }
          } catch (error) {
            const imageDuration = Date.now() - imageStart;
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`OCR image ${i + 1}/${imageCount} failed in ${imageDuration}ms: ${message}`);
            failedImages.push(i + 1);
            // Continue processing other images instead of failing immediately
          }
        }

        // Use single newline to preserve paragraph structure from OCR
        // Using '\n\n' could create artificial paragraph breaks
        mergedText = texts.join('\n').trim();
        ocrDurationMs = Date.now() - ocrStart;

        if (failedImages.length > 0) {
          this.logger.warn(`OCR completed with ${failedImages.length}/${imageCount} images failed: [${failedImages.join(', ')}]`);
        } else {
          this.logger.log(`OCR completed for submission ${submissionId}: total duration ${ocrDurationMs}ms, all ${imageCount} images succeeded, total text length: ${mergedText.length}`);
        }

        if (!mergedText) {
          throw new OcrError('OCR_EMPTY', `OCR returned empty text from all ${imageCount} images`);
        }

        await this.prisma.submission.update({
          where: { id: submissionId },
          data: { ocrText: mergedText },
        });
      }

      llmStartedAt = Date.now();
      const gradingResponse = await this.gradingService.grade(mergedText, {
        mode: mode || 'cheap',
        needRewrite: Boolean(needRewrite),
      });
      llmDurationMs = Date.now() - llmStartedAt;

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.DONE,
          ocrText: mergedText,
          gradingJson: gradingResponse.result,
          totalScore: gradingResponse.result.totalScore,
          errorCode: null,
          errorMsg: null,
        },
      });

      const duration = Date.now() - startedAt;
      this.logger.log(
        `Grading job ${jobLabel} done in ${duration}ms (ocr=${ocrDurationMs}ms, llm=${llmDurationMs}ms, provider=${gradingResponse.meta.providerName}, model=${gradingResponse.meta.model}, degraded=${gradingResponse.meta.degraded}, reason=${gradingResponse.meta.degradeReason || 'none'})`,
      );
      return {
        durationMs: duration,
        ocrDurationMs,
        llmDurationMs,
        degraded: gradingResponse.meta.degraded,
      };
    } catch (error) {
      if (llmStartedAt && llmDurationMs === 0) {
        llmDurationMs = Date.now() - llmStartedAt;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code =
        error instanceof OcrError
          ? error.code
          : error instanceof GradingError
            ? error.code
            : error instanceof Error
              ? 'LLM_API_ERROR'
              : 'UNKNOWN';
      try {
        await this.prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.FAILED,
            errorCode: code,
            errorMsg: message,
          },
        });
      } catch (updateError) {
        const updateMessage =
          updateError instanceof Error ? updateError.message : 'Unknown update error';
        this.logger.error(`Failed to update submission ${submissionId}: ${updateMessage}`);
      }
      this.logger.error(
        `Grading job ${jobLabel} failed (ocr=${ocrDurationMs}ms, llm=${llmDurationMs}ms): ${message}`,
      );
      throw error;
    }
  }

  private async getOcrConfig(): Promise<Partial<BaiduOcrConfig>> {
    const stored = await this.systemConfigService.getValue<{ apiKey?: string; secretKey?: string }>(
      'ocr',
    );
    return {
      apiKey: stored?.apiKey?.trim() || this.defaultApiKey,
      secretKey: stored?.secretKey?.trim() || this.defaultSecretKey,
    };
  }
}
