import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AccountLockoutService {
  constructor(private readonly redis: RedisService) {}

  private failKey(account: string): string {
    return `auth:lockout:fail:${account}`;
  }

  private lockKey(account: string): string {
    return `auth:lockout:lock:${account}`;
  }

  async isLocked(account: string): Promise<{ locked: boolean; remainingSeconds: number }> {
    const locked = await this.redis.exists(this.lockKey(account));
    if (!locked) {
      return { locked: false, remainingSeconds: 0 };
    }
    const ttl = await this.redis.ttl(this.lockKey(account));
    return { locked: true, remainingSeconds: Math.max(ttl, 0) };
  }

  async recordFailure(account: string): Promise<{ locked: boolean; attempts: number }> {
    const count = await this.redis.incr(this.failKey(account), ATTEMPT_WINDOW_SECONDS);
    if (count >= MAX_ATTEMPTS) {
      await this.redis.set(this.lockKey(account), '1', LOCKOUT_SECONDS);
      await this.redis.del(this.failKey(account));
      return { locked: true, attempts: count };
    }
    return { locked: false, attempts: count };
  }

  async resetOnSuccess(account: string): Promise<void> {
    await this.redis.del(this.failKey(account));
    await this.redis.del(this.lockKey(account));
  }
}
