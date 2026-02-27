import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const redisUrl =
      configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis({
      ...buildRedisConnection(redisUrl),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Failed to close Redis: ${msg}`);
    }
  }

  /** Increment a key, set TTL only on creation. Returns the new count. */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1 && ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
