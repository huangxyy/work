import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RuntimeConfigService } from '../../system-config/runtime-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private clientPromise: Promise<Redis> | null = null;
  private clientPromiseSignature = '';
  private connectionSignature = '';

  constructor(private readonly runtimeConfigService: RuntimeConfigService) {}

  private async getClient(): Promise<Redis> {
    const startedAt = Date.now();
    const config = await this.runtimeConfigService.getRedisRuntimeConfig();
    const signature = JSON.stringify({
      host: config.host || '',
      port: config.port || 6379,
      db: config.db || 0,
      username: config.username || '',
      passwordSet: Boolean(config.password),
      tls: Boolean(config.tls),
    });
    if (this.client && this.connectionSignature === signature) {
      return this.client;
    }
    if (this.clientPromise && this.clientPromiseSignature === signature) {
      return this.clientPromise;
    }

    const previousClient = this.client;
    const connectPromise = (async () => {
      if (previousClient) {
        await this.closeClient(previousClient);
      }

      const nextClient = new Redis({
        ...config,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });
      this.client = nextClient;
      this.connectionSignature = signature;

      this.logger.debug(
        `Redis client initialized host=${config.host || 'localhost'} port=${config.port || 6379} db=${config.db || 0} durationMs=${Date.now() - startedAt}`,
      );

      return nextClient;
    })().finally(() => {
      if (this.clientPromiseSignature === signature) {
        this.clientPromise = null;
        this.clientPromiseSignature = '';
      }
    });

    this.clientPromise = connectPromise;
    this.clientPromiseSignature = signature;
    return connectPromise;
  }

  private async closeClient(client: Redis) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client) {
        await this.closeClient(this.client);
        this.client = null;
        this.clientPromise = null;
        this.clientPromiseSignature = '';
        this.connectionSignature = '';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Failed to close Redis: ${msg}`);
    }
  }

  /** Increment a key, set TTL only on creation. Returns the new count. */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const client = await this.getClient();
    const count = await client.incr(key);
    if (count === 1 && ttlSeconds) {
      await client.expire(key, ttlSeconds);
    }
    return count;
  }

  async get(key: string): Promise<string | null> {
    return (await this.getClient()).get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await (await this.getClient()).del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await (await this.getClient()).exists(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return (await this.getClient()).ttl(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await (await this.getClient()).expire(key, ttlSeconds);
  }

  async ping(): Promise<string> {
    return (await this.getClient()).ping();
  }
}
