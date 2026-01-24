import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RetentionRunOptions, RetentionStats } from './retention.types';

const DEFAULT_RETENTION_CRON = process.env.RETENTION_CRON || '30 3 * * *';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly retentionDays: number;
  private readonly dryRunDefault: boolean;
  private readonly batchSizeDefault: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    configService: ConfigService,
  ) {
    this.retentionDays = Number(configService.get<string>('RETENTION_DAYS') || '7');
    this.dryRunDefault = (configService.get<string>('RETENTION_DRY_RUN') || 'false') === 'true';
    this.batchSizeDefault = Number(configService.get<string>('RETENTION_BATCH_SIZE') || '200');
  }

  @Cron(DEFAULT_RETENTION_CRON)
  async handleCron() {
    if (process.env.RUN_RETENTION !== 'true') {
      this.logger.log('Retention cron skipped (RUN_RETENTION!=true)');
      return;
    }

    await this.runRetentionJob({ invokedBy: 'cron' });
  }

  async runRetentionJob(options: RetentionRunOptions = {}): Promise<RetentionStats> {
    const startedAt = Date.now();
    const days = options.days ?? this.retentionDays;
    const dryRun = options.dryRun ?? this.dryRunDefault;
    const batchSize = options.batchSize ?? this.batchSizeDefault;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stats: RetentionStats = {
      cutoffDate: cutoffDate.toISOString(),
      scanned: 0,
      deleted: 0,
      minioOk: 0,
      minioFailed: 0,
      dbFailed: 0,
      dryRun,
      durationMs: 0,
      sampleSubmissionIds: [],
      sampleObjectKeys: [],
    };

    let cursor: { createdAt: Date; id: string } | null = null;

    while (true) {
      const submissions = await this.findExpiredSubmissions(cutoffDate, batchSize, cursor);
      if (!submissions.length) {
        break;
      }

      for (const submission of submissions) {
        stats.scanned += 1;
        if (stats.sampleSubmissionIds.length < 10) {
          stats.sampleSubmissionIds.push(submission.id);
        }

        const images = await this.prisma.submissionImage.findMany({
          where: { submissionId: submission.id },
          select: { objectKey: true },
        });
        const objectKeys = images.map((image) => image.objectKey);

        if (stats.sampleObjectKeys.length < 10) {
          for (const key of objectKeys) {
            if (stats.sampleObjectKeys.length >= 10) {
              break;
            }
            stats.sampleObjectKeys.push(key);
          }
        }

        if (dryRun) {
          stats.deleted += 1;
          stats.minioOk += objectKeys.length;
          continue;
        }

        const minioResult = await this.storage.deleteObjects(objectKeys);
        stats.minioOk += minioResult.ok;
        stats.minioFailed += minioResult.failed.length;

        if (minioResult.failed.length > 0) {
          this.logger.warn(
            `Retention MinIO delete failed for submission ${submission.id} (${minioResult.failed.length} objects)`,
          );
        }

        try {
          await this.prisma.$transaction([
            this.prisma.submissionImage.deleteMany({ where: { submissionId: submission.id } }),
            this.prisma.submission.delete({ where: { id: submission.id } }),
          ]);
          stats.deleted += 1;
        } catch (error) {
          stats.dbFailed += 1;
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Retention DB delete failed for ${submission.id}: ${message}`);
        }
      }

      const last = submissions[submissions.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }

    stats.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Retention run (${options.invokedBy || 'manual'}) cutoff=${stats.cutoffDate} scanned=${stats.scanned} deleted=${stats.deleted} minioOk=${stats.minioOk} minioFailed=${stats.minioFailed} dbFailed=${stats.dbFailed} dryRun=${stats.dryRun} durationMs=${stats.durationMs}`,
    );

    if (stats.dryRun) {
      this.logger.log(
        `Retention dry-run samples submissions=${stats.sampleSubmissionIds.join(',') || 'none'} objects=${
          stats.sampleObjectKeys.join(',') || 'none'
        }`,
      );
    }

    return stats;
  }

  private async findExpiredSubmissions(
    cutoffDate: Date,
    batchSize: number,
    cursor: { createdAt: Date; id: string } | null,
  ) {
    const where: {
      createdAt: { lt: Date };
      OR?: Array<{ createdAt: { gt: Date } } | { createdAt: Date; id: { gt: string } }>;
    } = {
      createdAt: { lt: cutoffDate },
    };

    if (cursor) {
      where.OR = [
        { createdAt: { gt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { gt: cursor.id } },
      ];
    }

    return this.prisma.submission.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
      select: { id: true, createdAt: true },
    });
  }
}
