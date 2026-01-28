import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SystemConfigService } from '../../system-config/system-config.service';

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
  private readonly defaultDailyCallLimit?: number;
  private readonly defaultBudgetMode: 'soft' | 'hard';

  constructor(
    configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(buildRedisConnection(redisUrl));
    const limit = Number(configService.get<string>('LLM_DAILY_CALL_LIMIT') || '400');
    this.defaultDailyCallLimit = Number.isFinite(limit) ? limit : undefined;
    const mode = (configService.get<string>('BUDGET_MODE') || 'soft').toLowerCase();
    this.defaultBudgetMode = mode === 'hard' ? 'hard' : 'soft';
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
    const budgetConfig = await this.resolveBudgetConfig();
    const key = `llm:calls:${this.currentDateKey()}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60 * 60 * 48);
    }

    if (!budgetConfig.enabled || !budgetConfig.dailyCallLimit || budgetConfig.dailyCallLimit <= 0) {
      return { exceeded: false, count, mode: budgetConfig.mode };
    }

    const exceeded = count > budgetConfig.dailyCallLimit;
    return {
      exceeded,
      limit: budgetConfig.dailyCallLimit,
      count,
      mode: budgetConfig.mode,
    };
  }

  private async resolveBudgetConfig(): Promise<{
    enabled: boolean;
    dailyCallLimit?: number;
    mode: 'soft' | 'hard';
  }> {
    const stored = await this.systemConfigService.getValue<{
      enabled?: boolean;
      dailyCallLimit?: number;
      mode?: 'soft' | 'hard';
    }>('budget');

    const enabled = stored?.enabled ?? Boolean(this.defaultDailyCallLimit && this.defaultDailyCallLimit > 0);
    const dailyCallLimit = stored?.dailyCallLimit ?? this.defaultDailyCallLimit;
    const mode = stored?.mode ?? this.defaultBudgetMode;

    return { enabled, dailyCallLimit, mode };
  }

  private currentDateKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}${month}${day}`;
  }
}
