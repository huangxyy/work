import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { RuntimeConfigService } from '../../system-config/runtime-config.service';

const mockRedisClient = {
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(-1),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedisClient),
}));

describe('RedisService', () => {
  let service: RedisService;
  let runtimeConfig: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    runtimeConfig = {
      getRedisRuntimeConfig: jest.fn().mockResolvedValue({
        host: 'localhost',
        port: 6379,
        db: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: RuntimeConfigService, useValue: runtimeConfig },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  // ─── incr ───

  describe('incr', () => {
    it('should increment key and set TTL on first increment', async () => {
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.incr('test-key', 300);

      expect(result).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('test-key');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('test-key', 300);
    });

    it('should not set TTL on subsequent increments', async () => {
      mockRedisClient.incr.mockResolvedValue(2);

      const result = await service.incr('test-key', 300);

      expect(result).toBe(2);
      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it('should not set TTL when not provided', async () => {
      mockRedisClient.incr.mockResolvedValue(1);

      await service.incr('test-key');

      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });
  });

  // ─── get ───

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockRedisClient.get.mockResolvedValue('hello');

      const result = await service.get('key');

      expect(result).toBe('hello');
    });

    it('should return null for missing key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('missing');

      expect(result).toBeNull();
    });
  });

  // ─── set ───

  describe('set', () => {
    it('should set key with TTL', async () => {
      await service.set('key', 'value', 60);

      expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value', 'EX', 60);
    });

    it('should set key without TTL', async () => {
      await service.set('key', 'value');

      expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  // ─── del ───

  describe('del', () => {
    it('should delete key', async () => {
      await service.del('key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('key');
    });
  });

  // ─── exists ───

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      expect(await service.exists('key')).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      expect(await service.exists('missing')).toBe(false);
    });
  });

  // ─── ttl ───

  describe('ttl', () => {
    it('should return TTL value', async () => {
      mockRedisClient.ttl.mockResolvedValue(120);

      expect(await service.ttl('key')).toBe(120);
    });
  });

  // ─── expire ───

  describe('expire', () => {
    it('should set expire on key', async () => {
      await service.expire('key', 60);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('key', 60);
    });
  });

  // ─── ping ───

  describe('ping', () => {
    it('should return PONG', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      expect(await service.ping()).toBe('PONG');
    });
  });

  // ─── onModuleDestroy ───

  describe('onModuleDestroy', () => {
    it('should close client on destroy', async () => {
      // Initialize client first
      await service.ping();

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle close error gracefully', async () => {
      await service.ping();
      mockRedisClient.quit.mockRejectedValue(new Error('close error'));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
