import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RetentionService } from './retention.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';

describe('RetentionService', () => {
  let service: RetentionService;
  let prisma: any;
  let storage: any;
  let systemConfig: any;

  beforeEach(async () => {
    prisma = {
      submission: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      submissionImage: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      batchUpload: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockResolvedValue([{ count: 1 }, undefined]),
    };

    storage = {
      deleteObjects: jest.fn().mockResolvedValue({ ok: 0, failed: [] }),
    };

    systemConfig = {
      getValue: jest.fn().mockResolvedValue(null),
      setValue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: SystemConfigService, useValue: systemConfig },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RETENTION_DAYS') return '7';
              if (key === 'RETENTION_DRY_RUN') return 'false';
              if (key === 'RETENTION_BATCH_SIZE') return '200';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  // ─── handleCron ───

  describe('handleCron', () => {
    it('should skip when RUN_RETENTION is not true', async () => {
      const original = process.env.RUN_RETENTION;
      process.env.RUN_RETENTION = 'false';

      await service.handleCron();

      expect(prisma.submission.findMany).not.toHaveBeenCalled();
      process.env.RUN_RETENTION = original;
    });
  });

  // ─── runRetentionJob ───

  describe('runRetentionJob', () => {
    it('should return stats with zero counts when no expired submissions', async () => {
      const stats = await service.runRetentionJob();

      expect(stats.scanned).toBe(0);
      expect(stats.deleted).toBe(0);
      expect(stats.dryRun).toBe(false);
    });

    it('should process dry run without deleting', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([
        { submissionId: 'sub-1', objectKey: 'key-1' },
      ]);

      const stats = await service.runRetentionJob({ dryRun: true });

      expect(stats.dryRun).toBe(true);
      expect(stats.scanned).toBe(1);
      expect(stats.deleted).toBe(1);
      expect(stats.minioOk).toBe(1);
      expect(storage.deleteObjects).not.toHaveBeenCalled();
    });

    it('should delete submissions with images in real run', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([
        { submissionId: 'sub-1', objectKey: 'key-1' },
      ]);
      storage.deleteObjects.mockResolvedValue({ ok: 1, failed: [] });
      prisma.$transaction.mockResolvedValue([{ count: 1 }, { id: 'sub-1' }]);

      const stats = await service.runRetentionJob({ dryRun: false });

      expect(stats.deleted).toBe(1);
      expect(stats.minioOk).toBe(1);
      expect(storage.deleteObjects).toHaveBeenCalledWith(['key-1']);
    });

    it('should skip DB delete when all MinIO deletes fail', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([
        { submissionId: 'sub-1', objectKey: 'key-1' },
      ]);
      storage.deleteObjects.mockResolvedValue({
        ok: 0,
        failed: [{ key: 'key-1', err: 'error' }],
      });

      const stats = await service.runRetentionJob({ dryRun: false });

      expect(stats.dbFailed).toBe(1);
      expect(stats.deleted).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle DB transaction error', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([]);
      prisma.$transaction.mockRejectedValue(new Error('DB error'));

      const stats = await service.runRetentionJob({ dryRun: false });

      expect(stats.dbFailed).toBe(1);
      expect(stats.deleted).toBe(0);
    });

    it('should collect sample submission IDs and object keys', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
          { id: 'sub-2', createdAt: new Date('2020-01-02') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([
        { submissionId: 'sub-1', objectKey: 'key-1' },
        { submissionId: 'sub-2', objectKey: 'key-2' },
      ]);

      const stats = await service.runRetentionJob({ dryRun: true });

      expect(stats.sampleSubmissionIds).toContain('sub-1');
      expect(stats.sampleObjectKeys).toContain('key-1');
    });

    it('should use custom days option', async () => {
      const stats = await service.runRetentionJob({ days: 30 });

      const cutoff = new Date(stats.cutoffDate);
      const daysAgo = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(daysAgo)).toBe(30);
    });

    it('should record history after run', async () => {
      await service.runRetentionJob();

      expect(systemConfig.setValue).toHaveBeenCalledWith(
        'retention:history',
        expect.arrayContaining([
          expect.objectContaining({ invokedBy: 'manual' }),
        ]),
      );
    });

    it('should handle history recording failure gracefully', async () => {
      systemConfig.setValue.mockRejectedValue(new Error('store failed'));

      await expect(service.runRetentionJob()).resolves.toBeDefined();
    });

    it('should handle partial MinIO failures', async () => {
      prisma.submission.findMany
        .mockResolvedValueOnce([
          { id: 'sub-1', createdAt: new Date('2020-01-01') },
        ])
        .mockResolvedValueOnce([]);
      prisma.submissionImage.findMany.mockResolvedValue([
        { submissionId: 'sub-1', objectKey: 'key-1' },
        { submissionId: 'sub-1', objectKey: 'key-2' },
      ]);
      storage.deleteObjects.mockResolvedValue({
        ok: 1,
        failed: [{ key: 'key-2', err: 'error' }],
      });
      prisma.$transaction.mockResolvedValue([{ count: 1 }, { id: 'sub-1' }]);

      const stats = await service.runRetentionJob({ dryRun: false });

      expect(stats.minioOk).toBe(1);
      expect(stats.minioFailed).toBe(1);
      expect(stats.deleted).toBe(1);
    });
  });

  // ─── getStatus ───

  describe('getStatus', () => {
    it('should return config and history', async () => {
      systemConfig.getValue.mockResolvedValue([
        { ranAt: '2025-01-01', invokedBy: 'manual' },
      ]);

      const result = await service.getStatus();

      expect(result.config.retentionDays).toBe(7);
      expect(result.config.dryRunDefault).toBe(false);
      expect(result.config.batchSizeDefault).toBe(200);
      expect(result.history).toHaveLength(1);
    });

    it('should return empty history when none stored', async () => {
      const result = await service.getStatus();

      expect(result.history).toEqual([]);
    });
  });

  // ─── cleanOrphanedBatchUploads ───

  describe('orphaned batch uploads', () => {
    it('should clean orphaned batch uploads in real run', async () => {
      prisma.batchUpload.findMany.mockResolvedValue([{ id: 'batch-1' }]);
      prisma.batchUpload.deleteMany.mockResolvedValue({ count: 1 });

      const stats = await service.runRetentionJob({ dryRun: false });

      expect(prisma.batchUpload.deleteMany).toHaveBeenCalled();
      // stats still valid
      expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should not delete orphaned batches in dry run', async () => {
      prisma.batchUpload.findMany.mockResolvedValue([{ id: 'batch-1' }]);

      await service.runRetentionJob({ dryRun: true });

      expect(prisma.batchUpload.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle orphan cleanup error gracefully', async () => {
      prisma.batchUpload.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.runRetentionJob()).resolves.toBeDefined();
    });
  });
});
