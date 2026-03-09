import { Test, TestingModule } from '@nestjs/testing';
import { GradingPolicyService } from './grading-policy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GradingPolicyService', () => {
  let service: GradingPolicyService;
  let prisma: any;

  const mockClassPolicy = {
    id: 'policy-1',
    classId: 'class-1',
    homeworkId: null,
    mode: 'quality',
    needRewrite: true,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  const mockHomeworkPolicy = {
    id: 'policy-2',
    classId: null,
    homeworkId: 'hw-1',
    mode: 'cheap',
    needRewrite: false,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      gradingPolicy: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      homework: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingPolicyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GradingPolicyService>(GradingPolicyService);
  });

  // ─── getClassPolicy ───

  describe('getClassPolicy', () => {
    it('should fetch class policy from database on first call', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockClassPolicy);

      const result = await service.getClassPolicy('class-1');

      expect(result).toEqual(mockClassPolicy);
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
      });
    });

    it('should return cached class policy on subsequent calls', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockClassPolicy);

      await service.getClassPolicy('class-1');
      const result = await service.getClassPolicy('class-1');

      expect(result).toEqual(mockClassPolicy);
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return null when no class policy exists', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(null);

      const result = await service.getClassPolicy('class-1');

      expect(result).toBeNull();
    });

    it('should deduplicate concurrent fetches for the same key', async () => {
      let resolvePromise: (v: any) => void;
      prisma.gradingPolicy.findUnique.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; }),
      );

      const p1 = service.getClassPolicy('class-1');
      const p2 = service.getClassPolicy('class-1');

      resolvePromise!(mockClassPolicy);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual(mockClassPolicy);
      expect(r2).toEqual(mockClassPolicy);
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getHomeworkPolicy ───

  describe('getHomeworkPolicy', () => {
    it('should fetch homework policy from database', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockHomeworkPolicy);

      const result = await service.getHomeworkPolicy('hw-1');

      expect(result).toEqual(mockHomeworkPolicy);
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledWith({
        where: { homeworkId: 'hw-1' },
      });
    });

    it('should cache homework policy separately from class policy', async () => {
      prisma.gradingPolicy.findUnique
        .mockResolvedValueOnce(mockClassPolicy)
        .mockResolvedValueOnce(mockHomeworkPolicy);

      await service.getClassPolicy('class-1');
      await service.getHomeworkPolicy('hw-1');

      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── upsertClassPolicy ───

  describe('upsertClassPolicy', () => {
    it('should upsert with mode only', async () => {
      prisma.gradingPolicy.upsert.mockResolvedValue(mockClassPolicy);

      const result = await service.upsertClassPolicy('class-1', { mode: 'quality' });

      expect(result).toEqual(mockClassPolicy);
      expect(prisma.gradingPolicy.upsert).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
        update: { mode: 'quality' },
        create: { classId: 'class-1', mode: 'quality', needRewrite: null },
      });
    });

    it('should upsert with needRewrite only', async () => {
      prisma.gradingPolicy.upsert.mockResolvedValue(mockClassPolicy);

      await service.upsertClassPolicy('class-1', { needRewrite: true });

      expect(prisma.gradingPolicy.upsert).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
        update: { needRewrite: true },
        create: { classId: 'class-1', mode: null, needRewrite: true },
      });
    });

    it('should invalidate cache after upsert', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockClassPolicy);
      prisma.gradingPolicy.upsert.mockResolvedValue({ ...mockClassPolicy, mode: 'cheap' });

      await service.getClassPolicy('class-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(1);

      await service.upsertClassPolicy('class-1', { mode: 'cheap' });

      prisma.gradingPolicy.findUnique.mockResolvedValue({ ...mockClassPolicy, mode: 'cheap' });
      const result = await service.getClassPolicy('class-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
      expect(result!.mode).toBe('cheap');
    });
  });

  // ─── upsertHomeworkPolicy ───

  describe('upsertHomeworkPolicy', () => {
    it('should upsert homework policy with both fields', async () => {
      prisma.gradingPolicy.upsert.mockResolvedValue(mockHomeworkPolicy);

      const result = await service.upsertHomeworkPolicy('hw-1', {
        mode: 'cheap',
        needRewrite: false,
      });

      expect(result).toEqual(mockHomeworkPolicy);
      expect(prisma.gradingPolicy.upsert).toHaveBeenCalledWith({
        where: { homeworkId: 'hw-1' },
        update: { mode: 'cheap', needRewrite: false },
        create: { homeworkId: 'hw-1', mode: 'cheap', needRewrite: false },
      });
    });

    it('should invalidate homework cache after upsert', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockHomeworkPolicy);
      prisma.gradingPolicy.upsert.mockResolvedValue(mockHomeworkPolicy);

      await service.getHomeworkPolicy('hw-1');
      await service.upsertHomeworkPolicy('hw-1', { mode: 'quality' });
      await service.getHomeworkPolicy('hw-1');

      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── clearClassPolicy / clearHomeworkPolicy ───

  describe('clearClassPolicy', () => {
    it('should delete class policy and invalidate cache', async () => {
      prisma.gradingPolicy.deleteMany.mockResolvedValue({ count: 1 });
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockClassPolicy);

      await service.getClassPolicy('class-1');
      const result = await service.clearClassPolicy('class-1');

      expect(result).toEqual({ count: 1 });
      expect(prisma.gradingPolicy.deleteMany).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
      });

      await service.getClassPolicy('class-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearHomeworkPolicy', () => {
    it('should delete homework policy and invalidate cache', async () => {
      prisma.gradingPolicy.deleteMany.mockResolvedValue({ count: 1 });
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockHomeworkPolicy);

      await service.getHomeworkPolicy('hw-1');
      const result = await service.clearHomeworkPolicy('hw-1');

      expect(result).toEqual({ count: 1 });
      expect(prisma.gradingPolicy.deleteMany).toHaveBeenCalledWith({
        where: { homeworkId: 'hw-1' },
      });

      await service.getHomeworkPolicy('hw-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── resolvePolicy ───

  describe('resolvePolicy', () => {
    it('should return defaults when no policies exist', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(null);

      const result = await service.resolvePolicy({ classId: 'class-1' });

      expect(result).toEqual({ mode: 'cheap', needRewrite: false });
    });

    it('should apply class policy overrides', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue({
        ...mockClassPolicy,
        mode: 'quality',
        needRewrite: true,
      });

      const result = await service.resolvePolicy({ classId: 'class-1' });

      expect(result).toEqual({ mode: 'quality', needRewrite: true });
    });

    it('should let homework policy override class policy', async () => {
      prisma.gradingPolicy.findUnique
        .mockResolvedValueOnce({ ...mockClassPolicy, mode: 'quality', needRewrite: true })
        .mockResolvedValueOnce({ ...mockHomeworkPolicy, mode: 'cheap', needRewrite: false });

      const result = await service.resolvePolicy({
        classId: 'class-1',
        homeworkId: 'hw-1',
      });

      expect(result).toEqual({ mode: 'cheap', needRewrite: false });
    });

    it('should look up classId from homework when classId is not provided', async () => {
      prisma.homework.findUnique.mockResolvedValue({ classId: 'class-1' });
      prisma.gradingPolicy.findUnique
        .mockResolvedValueOnce(mockClassPolicy)
        .mockResolvedValueOnce(null);

      const result = await service.resolvePolicy({ homeworkId: 'hw-1' });

      expect(prisma.homework.findUnique).toHaveBeenCalledWith({
        where: { id: 'hw-1' },
        select: { classId: true },
      });
      expect(result.mode).toBe('quality');
    });

    it('should handle missing homework lookup gracefully', async () => {
      prisma.homework.findUnique.mockResolvedValue(null);
      prisma.gradingPolicy.findUnique.mockResolvedValue(null);

      const result = await service.resolvePolicy({ homeworkId: 'missing' });

      expect(result).toEqual({ mode: 'cheap', needRewrite: false });
    });

    it('should skip class policy lookup when classId is absent', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(null);
      prisma.homework.findUnique.mockResolvedValue(null);

      await service.resolvePolicy({ homeworkId: 'hw-1' });

      const calls = prisma.gradingPolicy.findUnique.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toEqual({ where: { homeworkId: 'hw-1' } });
    });

    it('should ignore invalid mode values in policies', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue({
        ...mockClassPolicy,
        mode: 'turbo',
        needRewrite: null,
      });

      const result = await service.resolvePolicy({ classId: 'class-1' });

      expect(result.mode).toBe('cheap');
      expect(result.needRewrite).toBe(false);
    });

    it('should resolve with only homeworkId when classId is null', async () => {
      prisma.homework.findUnique.mockResolvedValue({ classId: 'class-1' });
      prisma.gradingPolicy.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockHomeworkPolicy, mode: 'quality', needRewrite: true });

      const result = await service.resolvePolicy({ classId: null, homeworkId: 'hw-1' });

      expect(result).toEqual({ mode: 'quality', needRewrite: true });
    });
  });

  // ─── cache TTL ───

  describe('cache expiry', () => {
    it('should refetch after cache TTL expires', async () => {
      prisma.gradingPolicy.findUnique.mockResolvedValue(mockClassPolicy);

      await service.getClassPolicy('class-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(1);

      // Manually expire the cache by manipulating fetchedAt
      const cache = (service as any).classPolicyCache;
      const entry = cache.get('class-1');
      entry.fetchedAt = Date.now() - 20000;

      await service.getClassPolicy('class-1');
      expect(prisma.gradingPolicy.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
