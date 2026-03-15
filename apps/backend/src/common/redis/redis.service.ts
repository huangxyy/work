import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RuntimeConfigService } from '../../system-config/runtime-config.service';

/**
 * Redis 连接池配置
 */
const REDIS_POOL_CONFIG = {
  // 最大连接重试次数
  maxRetriesPerRequest: 3,
  // 连接超时时间（毫秒）
  connectTimeout: 10000,
  // 命令超时时间（毫秒）
  commandTimeout: 5000,
  // 启用保持连接
  keepAlive: 30000,
  // 连接池大小（通过集群模式实现）
  // 单实例模式下使用单一连接，ioredis 内置连接复用
  // 如需真正的连接池，可使用 Redis Cluster 或添加 sentinel 模式
  // 启用 offline queue（连接断开时队列化命令）
  enableReadyCheck: true,
  // 连接断开时重连策略
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // 重连延迟
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // 只在特定错误时重连
      return true;
    }
    return false;
  },
  // 启用自动管道（批量命令优化）
  enableOfflineQueue: true,
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private clientPromise: Promise<Redis> | null = null;
  private clientPromiseSignature = '';
  private connectionSignature = '';
  // 连接池统计
  private connectionCount = 0;
  private lastConnectTime = 0;

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
        ...REDIS_POOL_CONFIG,
        lazyConnect: false,
        // 显示数据库选项
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
      });

      // 监听连接事件
      nextClient.on('connect', () => {
        this.connectionCount++;
        this.lastConnectTime = Date.now();
        this.logger.debug(`Redis connected (connection #${this.connectionCount})`);
      });

      // 监听错误事件
      nextClient.on('error', (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
      });

      // 监听关闭事件
      nextClient.on('close', () => {
        this.logger.debug('Redis connection closed');
      });

      // 监听重连事件
      nextClient.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      this.client = nextClient;
      this.connectionSignature = signature;

      this.logger.log(
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
      this.logger.debug('Redis client closed gracefully');
    } catch {
      client.disconnect();
      this.logger.debug('Redis client disconnected forcefully');
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

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    return {
      connectionCount: this.connectionCount,
      lastConnectTime: this.lastConnectTime,
      isConnected: this.client?.status === 'ready',
    };
  }

  /**
   * Pipeline 批量操作（性能优化）
   */
  async pipeline(commands: Array<{ name: string; args: string[] }>): Promise<unknown[]> {
    const client = await this.getClient();
    const pipeline = client.pipeline();
    commands.forEach(({ name, args }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pipeline as any)[name](...args);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (pipeline.exec() as any) || [];
  }

  /**
   * 批量获取（性能优化）
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return (await this.getClient()).mget(...keys);
  }

  /**
   * 批量设置（性能优化）
   */
  async mset(keyValues: Record<string, string>): Promise<void> {
    if (Object.keys(keyValues).length === 0) return;
    const client = await this.getClient();
    const pipeline = client.pipeline();
    Object.entries(keyValues).forEach(([key, value]) => {
      pipeline.set(key, value);
    });
    await pipeline.exec();
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

  /**
   * 批量删除（性能优化）
   */
  async delMultiple(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (await this.getClient()).del(...keys);
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
