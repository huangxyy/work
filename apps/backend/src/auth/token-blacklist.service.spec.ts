import { TokenBlacklistService } from './token-blacklist.service';
import { RedisService } from '../common/redis';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      set: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    service = new TokenBlacklistService(redis);
  });

  describe('revoke', () => {
    it('should store token in redis with TTL', async () => {
      await service.revoke('test-jti', 3600);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:blacklist:test-jti',
        '1',
        3600,
      );
    });

    it('should use minimum 60s TTL when given smaller value', async () => {
      await service.revoke('test-jti', 10);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:blacklist:test-jti',
        '1',
        60,
      );
    });

    it('should use minimum 60s TTL for zero', async () => {
      await service.revoke('test-jti', 0);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:blacklist:test-jti',
        '1',
        60,
      );
    });

    it('should use minimum 60s TTL for negative values', async () => {
      await service.revoke('test-jti', -100);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:blacklist:test-jti',
        '1',
        60,
      );
    });

    it('should keep TTL when exactly 60', async () => {
      await service.revoke('test-jti', 60);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:blacklist:test-jti',
        '1',
        60,
      );
    });
  });

  describe('isRevoked', () => {
    it('should return true when token exists in blacklist', async () => {
      redis.exists.mockResolvedValue(true);
      const result = await service.isRevoked('test-jti');
      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith('auth:blacklist:test-jti');
    });

    it('should return false when token does not exist', async () => {
      redis.exists.mockResolvedValue(false);
      const result = await service.isRevoked('test-jti');
      expect(result).toBe(false);
    });
  });
});
