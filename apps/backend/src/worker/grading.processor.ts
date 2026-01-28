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

type OcrResponse = {
  text: string;
  confidence?: number;
};

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
  private readonly defaultOcrServiceUrl: string;
  private readonly defaultOcrTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gradingService: GradingService,
    private readonly systemConfigService: SystemConfigService,
    configService: ConfigService,
  ) {
    super();
    this.defaultOcrServiceUrl =
      configService.get<string>('OCR_BASE_URL') || 'http://localhost:8000';
    this.defaultOcrTimeoutMs = Number(configService.get<string>('OCR_TIMEOUT_MS') || '10000');
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
        const texts: string[] = [];

        for (const image of submission.images) {
          const imageBuffer = await this.storage.getObject(image.objectKey);
          const base64 = imageBuffer.toString('base64');
          const ocrResult = await this.callOcrWithRetry({
            image_base64: base64,
            preprocess: false,
          });
          if (ocrResult.text?.trim()) {
            texts.push(ocrResult.text.trim());
          }
        }

        mergedText = texts.join('\n\n').trim();
        ocrDurationMs = Date.now() - ocrStart;
        if (!mergedText) {
          throw new OcrError('OCR_EMPTY', 'OCR returned empty text');
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

  private async callOcrWithRetry(payload: {
    image_base64: string;
    preprocess?: boolean;
  }): Promise<OcrResponse> {
    try {
      return await this.callOcr(payload);
    } catch (error) {
      if (error instanceof OcrError && error.code === 'OCR_TIMEOUT') {
        this.logger.warn('OCR timeout, retrying once...');
        return this.callOcr(payload);
      }
      throw error;
    }
  }

  private async callOcr(payload: {
    image_base64: string;
    preprocess?: boolean;
  }): Promise<OcrResponse> {
    const ocrConfig = await this.getOcrConfig();
    const response = await this.fetchWithTimeout(
      `${ocrConfig.baseUrl}/ocr`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      ocrConfig.timeoutMs,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new OcrError('OCR_ERROR', `OCR service error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OcrResponse;
    if (!data.text || !data.text.trim()) {
      throw new OcrError('OCR_EMPTY', 'OCR returned empty text');
    }

    return data;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OcrError('OCR_TIMEOUT', 'OCR request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getOcrConfig(): Promise<{ baseUrl: string; timeoutMs: number }> {
    const stored = await this.systemConfigService.getValue<{ baseUrl?: string; timeoutMs?: number }>(
      'ocr',
    );
    const baseUrl = (stored?.baseUrl?.trim() || this.defaultOcrServiceUrl).replace(/\/$/, '');
    const timeoutMs = stored?.timeoutMs ?? this.defaultOcrTimeoutMs;
    return { baseUrl, timeoutMs };
  }
}
