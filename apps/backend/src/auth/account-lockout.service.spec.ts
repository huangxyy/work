import { AccountLockoutService } from './account-lockout.service';
import { RedisService } from '../common/redis';

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      exists: jest.fn(),
      ttl: jest.fn(),
      incr: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      get: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    service = new AccountLockoutService(redis);
  });

  describe('isLocked', () => {
    it('should return false when not locked', async () => {
      redis.exists.mockResolvedValue(false);
      const result = await service.isLocked('testuser');
      expect(result.locked).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });

    it('should return true with remaining seconds when locked', async () => {
      redis.exists.mockResolvedValue(true);
      redis.ttl.mockResolvedValue(600);
      const result = await service.isLocked('testuser');
      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBe(600);
    });

    it('should clamp negative TTL to zero', async () => {
      redis.exists.mockResolvedValue(true);
      redis.ttl.mockResolvedValue(-1);
      const result = await service.isLocked('testuser');
      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBe(0);
    });

    it('should use the correct lock key', async () => {
      redis.exists.mockResolvedValue(false);
      await service.isLocked('user@example');
      expect(redis.exists).toHaveBeenCalledWith('auth:lockout:lock:user@example');
    });
  });

  describe('recordFailure', () => {
    it('should not lock on first failure', async () => {
      redis.incr.mockResolvedValue(1);
      const result = await service.recordFailure('testuser');
      expect(result.locked).toBe(false);
      expect(result.attempts).toBe(1);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should not lock below threshold', async () => {
      redis.incr.mockResolvedValue(4);
      const result = await service.recordFailure('testuser');
      expect(result.locked).toBe(false);
      expect(result.attempts).toBe(4);
    });

    it('should lock at exactly 5 failures', async () => {
      redis.incr.mockResolvedValue(5);
      redis.set.mockResolvedValue(undefined);
      redis.del.mockResolvedValue(undefined);
      const result = await service.recordFailure('testuser');
      expect(result.locked).toBe(true);
      expect(result.attempts).toBe(5);
      expect(redis.set).toHaveBeenCalledWith(
        'auth:lockout:lock:testuser',
        '1',
        15 * 60,
      );
      expect(redis.del).toHaveBeenCalledWith('auth:lockout:fail:testuser');
    });

    it('should lock above threshold', async () => {
      redis.incr.mockResolvedValue(7);
      redis.set.mockResolvedValue(undefined);
      redis.del.mockResolvedValue(undefined);
      const result = await service.recordFailure('testuser');
      expect(result.locked).toBe(true);
    });

    it('should pass attempt window TTL to incr', async () => {
      redis.incr.mockResolvedValue(1);
      await service.recordFailure('testuser');
      expect(redis.incr).toHaveBeenCalledWith(
        'auth:lockout:fail:testuser',
        15 * 60,
      );
    });
  });

  describe('resetOnSuccess', () => {
    it('should delete both fail and lock keys', async () => {
      redis.del.mockResolvedValue(undefined);
      await service.resetOnSuccess('testuser');
      expect(redis.del).toHaveBeenCalledWith('auth:lockout:fail:testuser');
      expect(redis.del).toHaveBeenCalledWith('auth:lockout:lock:testuser');
      expect(redis.del).toHaveBeenCalledTimes(2);
    });
  });
});
