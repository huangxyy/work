import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService } from './system-config.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      systemConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
  });

  // ─── getValue ───

  describe('getValue', () => {
    it('should fetch value from database on first call', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: { foo: 'bar' } });

      const result = await service.getValue('test');

      expect(result).toEqual({ foo: 'bar' });
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledWith({ where: { key: 'test' } });
    });

    it('should return null when key does not exist', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.getValue('missing');

      expect(result).toBeNull();
    });

    it('should return cached value on subsequent calls', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: 42 });

      await service.getValue('test');
      const result = await service.getValue('test');

      expect(result).toBe(42);
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent fetches for the same key', async () => {
      let resolve!: (v: any) => void;
      prisma.systemConfig.findUnique.mockImplementation(
        () => new Promise((r) => { resolve = r; }),
      );

      const p1 = service.getValue('test');
      const p2 = service.getValue('test');

      resolve({ key: 'test', value: 'shared' });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('shared');
      expect(r2).toBe('shared');
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should refetch after cache TTL expires', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: 'v1' });

      await service.getValue('test');

      // Expire cache
      const cache = (service as any).cache;
      cache.get('test').fetchedAt = Date.now() - 20000;

      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: 'v2' });
      const result = await service.getValue('test');

      expect(result).toBe('v2');
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── setValue ───

  describe('setValue', () => {
    it('should upsert value and update cache', async () => {
      prisma.systemConfig.upsert.mockResolvedValue(undefined);

      await service.setValue('key1', { enabled: true });

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'key1' },
        update: { value: { enabled: true } },
        create: { key: 'key1', value: { enabled: true } },
      });

      // Should be cached now
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      const result = await service.getValue('key1');
      expect(result).toEqual({ enabled: true });
      expect(prisma.systemConfig.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─── getFeatureFlags / setFeatureFlag ───

  describe('getFeatureFlags', () => {
    it('should return empty object when no flags stored', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.getFeatureFlags();

      expect(result).toEqual({});
    });

    it('should return stored flags', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue({
        key: 'feature_flags',
        value: { dark_mode: true, beta: false },
      });

      const result = await service.getFeatureFlags();

      expect(result).toEqual({ dark_mode: true, beta: false });
    });
  });

  describe('setFeatureFlag', () => {
    it('should merge new flag into existing flags', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue({
        key: 'feature_flags',
        value: { existing: true },
      });
      prisma.systemConfig.upsert.mockResolvedValue(undefined);

      const result = await service.setFeatureFlag('new_flag', true);

      expect(result).toEqual({ existing: true, new_flag: true });
    });

    it('should create flags from scratch when none exist', async () => {
      prisma.systemConfig.findUnique.mockResolvedValue(null);
      prisma.systemConfig.upsert.mockResolvedValue(undefined);

      const result = await service.setFeatureFlag('first', true);

      expect(result).toEqual({ first: true });
    });
  });

  // ─── deleteValue ───

  describe('deleteValue', () => {
    it('should delete config and clear cache', async () => {
      prisma.systemConfig.delete.mockResolvedValue(undefined);
      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: 'cached' });

      // Populate cache
      await service.getValue('test');
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledTimes(1);

      await service.deleteValue('test');

      expect(prisma.systemConfig.delete).toHaveBeenCalledWith({ where: { key: 'test' } });

      // Should refetch after delete
      prisma.systemConfig.findUnique.mockResolvedValue({ key: 'test', value: 'new' });
      const result = await service.getValue('test');
      expect(result).toBe('new');
      expect(prisma.systemConfig.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should swallow P2025 not-found error', async () => {
      const p2025Error = Object.assign(new Error('Not found'), { code: 'P2025' });
      prisma.systemConfig.delete.mockRejectedValue(p2025Error);

      await expect(service.deleteValue('missing')).resolves.toBeUndefined();
    });

    it('should rethrow non-P2025 errors', async () => {
      prisma.systemConfig.delete.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.deleteValue('key')).rejects.toThrow('DB connection lost');
    });
  });
});
