import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(private readonly redis: RedisService) {}

  private failKey(account: string): string {
    return `auth:lockout:fail:${account}`;
  }

  private lockKey(account: string): string {
    return `auth:lockout:lock:${account}`;
  }

  async isLocked(account: string): Promise<{ locked: boolean; remainingSeconds: number }> {
    const startedAt = Date.now();
    const ttl = await this.redis.ttl(this.lockKey(account));
    if (ttl === -2) {
      this.logger.debug(`Account lockout checked account=${account} locked=false remainingSeconds=0 durationMs=${Date.now() - startedAt}`);
      return { locked: false, remainingSeconds: 0 };
    }
    const remainingSeconds = Math.max(ttl, 0);
    this.logger.debug(
      `Account lockout checked account=${account} locked=true remainingSeconds=${remainingSeconds} durationMs=${Date.now() - startedAt}`,
    );
    return { locked: true, remainingSeconds };
  }

  async recordFailure(account: string): Promise<{ locked: boolean; attempts: number }> {
    const startedAt = Date.now();
    const count = await this.redis.incr(this.failKey(account), ATTEMPT_WINDOW_SECONDS);
    if (count >= MAX_ATTEMPTS) {
      await Promise.all([
        this.redis.set(this.lockKey(account), '1', LOCKOUT_SECONDS),
        this.redis.del(this.failKey(account)),
      ]);
      this.logger.debug(
        `Account lockout threshold reached account=${account} attempts=${count} locked=true durationMs=${Date.now() - startedAt}`,
      );
      return { locked: true, attempts: count };
    }

    this.logger.debug(
      `Account failure recorded account=${account} attempts=${count} locked=false durationMs=${Date.now() - startedAt}`,
    );

    return { locked: false, attempts: count };
  }

  async resetOnSuccess(account: string): Promise<void> {
    const startedAt = Date.now();
    await Promise.all([
      this.redis.del(this.failKey(account)),
      this.redis.del(this.lockKey(account)),
    ]);

    this.logger.debug(`Account lockout reset account=${account} durationMs=${Date.now() - startedAt}`);
  }
}
