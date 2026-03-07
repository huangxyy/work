import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { RetentionHistoryEntry, RetentionRunOptions, RetentionStats } from './retention.types';

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
    private readonly systemConfigService: SystemConfigService,
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
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const pageNumber = page + 1;
      const pageStartedAt = Date.now();
      const submissions = await this.findExpiredSubmissions(cutoffDate, batchSize, cursor);
      if (!submissions.length) {
        hasMore = false;
        break;
      }
      page = pageNumber;

      // Batch-fetch all images for this page of submissions to avoid N+1 queries
      const submissionIds = submissions.map((s) => s.id);
      const allImages = await this.prisma.submissionImage.findMany({
        where: { submissionId: { in: submissionIds } },
        select: { submissionId: true, objectKey: true },
      });
      const imagesBySubmission = new Map<string, string[]>();
      for (const img of allImages) {
        const keys = imagesBySubmission.get(img.submissionId) || [];
        keys.push(img.objectKey);
        imagesBySubmission.set(img.submissionId, keys);
      }

      stats.scanned += submissions.length;

      for (const submission of submissions) {
        if (stats.sampleSubmissionIds.length < 10) {
          stats.sampleSubmissionIds.push(submission.id);
        }

        const objectKeys = imagesBySubmission.get(submission.id) || [];

        if (stats.sampleObjectKeys.length < 10) {
          for (const key of objectKeys) {
            if (stats.sampleObjectKeys.length >= 10) {
              break;
            }
            stats.sampleObjectKeys.push(key);
          }
        }

        if (dryRun) {
          continue;
        }
      }

      if (dryRun) {
        stats.deleted += submissions.length;
        stats.minioOk += allImages.length;

        this.logger.debug(
          `Retention page processed page=${page} submissions=${submissions.length} objectKeys=${allImages.length} deleted=${submissions.length} minioOk=${allImages.length} minioFailed=0 dbFailed=0 dryRun=true durationMs=${Date.now() - pageStartedAt}`,
        );
      } else {
        const PAGE_CONCURRENCY = 10;
        let pageDeleted = 0;
        let pageMinioOk = 0;
        let pageMinioFailed = 0;
        let pageDbFailed = 0;

        for (let index = 0; index < submissions.length; index += PAGE_CONCURRENCY) {
          const chunk = submissions.slice(index, index + PAGE_CONCURRENCY);
          const outcomes = await Promise.all(
            chunk.map(async (submission) => {
              const objectKeys = imagesBySubmission.get(submission.id) || [];
              let minioOk = 0;
              let minioFailed = 0;

              if (objectKeys.length > 0) {
                const minioResult = await this.storage.deleteObjects(objectKeys);
                minioOk = minioResult.ok;
                minioFailed = minioResult.failed.length;

                if (minioResult.failed.length > 0) {
                  this.logger.warn(
                    `Retention MinIO delete failed for submission ${submission.id} (${minioResult.failed.length} objects)`,
                  );
                }

                if (minioResult.ok === 0) {
                  this.logger.warn(
                    `Retention skipping DB delete for ${submission.id}: all ${objectKeys.length} MinIO deletes failed`,
                  );
                  return { deleted: 0, minioOk, minioFailed, dbFailed: 1 };
                }
              }

              try {
                await this.prisma.$transaction([
                  this.prisma.submissionImage.deleteMany({ where: { submissionId: submission.id } }),
                  this.prisma.submission.delete({ where: { id: submission.id } }),
                ]);
                return { deleted: 1, minioOk, minioFailed, dbFailed: 0 };
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(`Retention DB delete failed for ${submission.id}: ${message}`);
                return { deleted: 0, minioOk, minioFailed, dbFailed: 1 };
              }
            }),
          );

          outcomes.forEach((outcome) => {
            pageDeleted += outcome.deleted;
            pageMinioOk += outcome.minioOk;
            pageMinioFailed += outcome.minioFailed;
            pageDbFailed += outcome.dbFailed;
          });
        }

        stats.deleted += pageDeleted;
        stats.minioOk += pageMinioOk;
        stats.minioFailed += pageMinioFailed;
        stats.dbFailed += pageDbFailed;

        this.logger.debug(
          `Retention page processed page=${page} submissions=${submissions.length} objectKeys=${allImages.length} deleted=${pageDeleted} minioOk=${pageMinioOk} minioFailed=${pageMinioFailed} dbFailed=${pageDbFailed} dryRun=false durationMs=${Date.now() - pageStartedAt}`,
        );
      }

      const last = submissions[submissions.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }

    // Clean up orphaned BatchUpload records whose linked submissions
    // have all been deleted (e.g. by prior retention runs or homework deletion).
    const orphanedBatchUploads = await this.cleanOrphanedBatchUploads(cutoffDate, dryRun);

    stats.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Retention run (${options.invokedBy || 'manual'}) cutoff=${stats.cutoffDate} scanned=${stats.scanned} deleted=${stats.deleted} minioOk=${stats.minioOk} minioFailed=${stats.minioFailed} dbFailed=${stats.dbFailed} orphanedBatches=${orphanedBatchUploads} dryRun=${stats.dryRun} durationMs=${stats.durationMs}`,
    );

    if (stats.dryRun) {
      this.logger.log(
        `Retention dry-run samples submissions=${stats.sampleSubmissionIds.join(',') || 'none'} objects=${
          stats.sampleObjectKeys.join(',') || 'none'
        }`,
      );
    }

    await this.recordHistory(stats, options.invokedBy || 'manual');

    return stats;
  }

  async getStatus() {
    const history =
      (await this.systemConfigService.getValue<RetentionHistoryEntry[]>('retention:history')) || [];
    return {
      config: {
        retentionDays: this.retentionDays,
        dryRunDefault: this.dryRunDefault,
        batchSizeDefault: this.batchSizeDefault,
        cron: DEFAULT_RETENTION_CRON,
        runRetention: process.env.RUN_RETENTION === 'true',
      },
      history: history.slice(0, 20),
    };
  }

  private async recordHistory(stats: RetentionStats, invokedBy: 'cron' | 'manual') {
    try {
      const history =
        (await this.systemConfigService.getValue<RetentionHistoryEntry[]>('retention:history')) || [];
      const entry: RetentionHistoryEntry = {
        ...stats,
        ranAt: new Date().toISOString(),
        invokedBy,
      };
      const next = [entry, ...history].slice(0, 20);
      await this.systemConfigService.setValue('retention:history', next);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to store retention history: ${message}`);
    }
  }

  private async cleanOrphanedBatchUploads(cutoffDate: Date, dryRun: boolean): Promise<number> {
    const startedAt = Date.now();
    try {
      const orphaned = await this.prisma.batchUpload.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          submissions: { none: {} },
        },
        select: { id: true },
        take: 500,
      });

      if (!orphaned.length) {
        this.logger.debug(`Retention orphan cleanup skipped count=0 dryRun=${dryRun} durationMs=${Date.now() - startedAt}`);
        return 0;
      }

      if (dryRun) {
        this.logger.log(
          `Retention dry-run: would delete ${orphaned.length} orphaned BatchUpload records durationMs=${Date.now() - startedAt}`,
        );
        return orphaned.length;
      }

      const result = await this.prisma.batchUpload.deleteMany({
        where: {
          id: { in: orphaned.map((b) => b.id) },
        },
      });

      this.logger.log(
        `Retention: deleted ${result.count} orphaned BatchUpload records durationMs=${Date.now() - startedAt}`,
      );
      return result.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to clean orphaned BatchUpload records after ${Date.now() - startedAt}ms: ${message}`,
      );
      return 0;
    }
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
