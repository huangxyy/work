import { Test, TestingModule } from '@nestjs/testing';
import { LlmLogsService } from './llm-logs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LlmLogsService', () => {
  let service: LlmLogsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      llmCallLog: {
        create: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation((args: any[]) => Promise.all(args)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmLogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LlmLogsService>(LlmLogsService);
  });

  // ─── logCall ───

  describe('logCall', () => {
    it('should create a log entry', async () => {
      await service.logCall({ source: 'grading', status: 'success', model: 'gpt-4' });

      expect(prisma.llmCallLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'grading',
          status: 'success',
          model: 'gpt-4',
        }),
      });
    });

    it('should rethrow on database error', async () => {
      prisma.llmCallLog.create.mockRejectedValue(new Error('DB down'));

      await expect(
        service.logCall({ source: 'grading', status: 'error' }),
      ).rejects.toThrow('DB down');
    });
  });

  // ─── listLogs ───

  describe('listLogs', () => {
    it('should return paginated results', async () => {
      prisma.$transaction.mockResolvedValue([42, [{ id: 'log-1' }]]);

      const result = await service.listLogs({ page: 1, pageSize: 10 });

      expect(result.total).toBe(42);
      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should clamp pageSize to 1-100 range', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.listLogs({ pageSize: 200 });

      expect(result.pageSize).toBe(100);
    });

    it('should default page to 1 and pageSize to 20', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.listLogs({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should pass filter parameters', async () => {
      prisma.$transaction.mockResolvedValue([0, []]);
      const from = new Date('2025-01-01');
      const to = new Date('2025-12-31');

      await service.listLogs({
        providerId: 'p1',
        model: 'gpt-4',
        status: 'success',
        source: 'grading',
        from,
        to,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─── clearLogs ───

  describe('clearLogs', () => {
    it('should delete logs and return count', async () => {
      prisma.llmCallLog.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.clearLogs({});

      expect(result).toEqual({ deleted: 5 });
    });

    it('should filter by source', async () => {
      prisma.llmCallLog.deleteMany.mockResolvedValue({ count: 3 });

      await service.clearLogs({ source: 'grading' });

      expect(prisma.llmCallLog.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ source: 'grading' }),
      });
    });

    it('should filter by before date', async () => {
      const before = new Date('2025-06-01');
      prisma.llmCallLog.deleteMany.mockResolvedValue({ count: 10 });

      await service.clearLogs({ before });

      expect(prisma.llmCallLog.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: { lt: before },
        }),
      });
    });
  });
});
