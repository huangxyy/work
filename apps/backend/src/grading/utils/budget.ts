import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type BudgetDecision = {
  exceeded: boolean;
  limit?: number;
  count: number;
  mode: 'soft' | 'hard';
};

const buildRedisConnection = (redisUrl: string) => {
  try {
    const url = new URL(redisUrl);
    const port = url.port ? parseInt(url.port, 10) : 6379;
    return {
      host: url.hostname,
      port,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
};

@Injectable()
export class BudgetTracker implements OnModuleDestroy {
  private readonly logger = new Logger(BudgetTracker.name);
  private readonly redis: Redis;
  private readonly dailyCallLimit?: number;
  private readonly budgetMode: 'soft' | 'hard';

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(buildRedisConnection(redisUrl));
    const limit = Number(configService.get<string>('LLM_DAILY_CALL_LIMIT') || '400');
    this.dailyCallLimit = Number.isFinite(limit) ? limit : undefined;
    const mode = (configService.get<string>('BUDGET_MODE') || 'soft').toLowerCase();
    this.budgetMode = mode === 'hard' ? 'hard' : 'soft';
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown redis error';
      this.logger.warn(`Failed to close redis connection: ${message}`);
    }
  }

  async reserveCall(): Promise<BudgetDecision> {
    const key = `llm:calls:${this.currentDateKey()}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60 * 60 * 48);
    }

    if (!this.dailyCallLimit || this.dailyCallLimit <= 0) {
      return { exceeded: false, count, mode: this.budgetMode };
    }

    const exceeded = count > this.dailyCallLimit;
    return { exceeded, limit: this.dailyCallLimit, count, mode: this.budgetMode };
  }

  private currentDateKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
