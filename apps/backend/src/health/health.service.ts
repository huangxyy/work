import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

type ServiceHealth = {
  status: HealthStatus;
  message?: string;
  responseTime?: number;
};

type QueueDepth = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: boolean;
};

type OverallHealth = {
  status: HealthStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  queue?: QueueDepth;
  uptime: number;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private s3Client: S3Client | null = null;
  private storageBucket = 'submissions';
  private storageSignature = '';
  private readonly startTime: number;
  private redisClient: import('ioredis').default | null = null;
  private redisSignature = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfigService: RuntimeConfigService,
    @Optional() @Inject(getQueueToken('grading')) private readonly gradingQueue?: Queue,
  ) {
    this.startTime = Date.now();
  }

  async getHealth(): Promise<OverallHealth> {
    const startedAt = Date.now();
    const [database, redis, storage, queue] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkQueue(),
    ]);

    const allHealthy = [database, redis, storage].every((s) => s.status === 'healthy');
    const anyUnhealthy = [database, redis, storage].some((s) => s.status === 'unhealthy');

    const status: HealthStatus = allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded';

    const queueSummary = queue ? ` waiting=${queue.waiting} active=${queue.active} failed=${queue.failed}` : '';
    const summary = `Health snapshot status=${status} db=${database.status}/${database.responseTime ?? -1} redis=${redis.status}/${redis.responseTime ?? -1} storage=${storage.status}/${storage.responseTime ?? -1}${queueSummary} durationMs=${Date.now() - startedAt}`;
    if (status === 'healthy') {
      this.logger.debug(summary);
    } else {
      this.logger.warn(summary);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
        storage,
      },
      ...(queue && { queue }),
      uptime: Date.now() - this.startTime,
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed durationMs=${responseTime}: ${message}`);
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
      };
    }
  }

  /**
   * Reuse a single Redis client across health checks to avoid connection leaks.
   * Reconnects lazily if the previous client was disconnected.
   */
  private async getRedisClient(): Promise<import('ioredis').default> {
    const config = await this.runtimeConfigService.getRedisRuntimeConfig();
    const signature = JSON.stringify({
      host: config.host || '',
      port: config.port || 6379,
      db: config.db || 0,
      username: config.username || '',
      passwordSet: Boolean(config.password),
      tls: Boolean(config.tls),
    });
    if (this.redisClient && this.redisClient.status === 'ready' && this.redisSignature === signature) {
      return this.redisClient;
    }
    // Clean up stale client
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch (error) {
        this.logger.debug(`Error disconnecting stale Redis client: ${error}`);
      }
      this.redisClient = null;
    }
    const Redis = (await import('ioredis')).default;
    const client = new Redis({
      ...config,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await client.connect();
    this.redisClient = client;
    this.redisSignature = signature;
    return client;
  }

  private async getStorageContext(): Promise<{ client: S3Client; bucket: string }> {
    const config = await this.runtimeConfigService.getStorageRuntimeConfig();
    const signature = JSON.stringify({
      endpoint: config.endpoint || '',
      bucket: config.bucket || 'submissions',
      region: config.region || 'us-east-1',
      accessKeySet: Boolean(config.accessKeyId),
      secretKeySet: Boolean(config.secretAccessKey),
    });
    if (!this.s3Client || this.storageSignature !== signature) {
      this.storageBucket = config.bucket || 'submissions';
      this.storageSignature = signature;
      this.s3Client = new S3Client({
        region: config.region || 'us-east-1',
        endpoint: config.endpoint || undefined,
        forcePathStyle: true,
        credentials:
          config.accessKeyId && config.secretAccessKey
            ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
            : undefined,
      });
    }
    return { client: this.s3Client, bucket: this.storageBucket };
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const client = await this.getRedisClient();

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Redis ping timeout')), 5000);
        client.ping((err) => {
          clearTimeout(timer);
          if (err) reject(err);
          else resolve();
        });
      });

      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed durationMs=${responseTime}: ${message}`);
      // Reset the client so next check retries a fresh connection
      if (this.redisClient) {
        try {
          this.redisClient.disconnect();
        } catch (error) {
          this.logger.debug(`Error disconnecting failed Redis client: ${error}`);
        }
        this.redisClient = null;
      }
      return {
        status: 'degraded',
        message: 'Cache service unavailable',
        responseTime,
      };
    }
  }

  private async checkStorage(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const { client, bucket } = await this.getStorageContext();
      // Add timeout to prevent health check from hanging if MinIO is unresponsive
      const storageCheck = client.send(
        new HeadBucketCommand({
          Bucket: bucket,
        }),
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Storage health check timed out')), 5000),
      );

      await Promise.race([storageCheck, timeoutPromise]);
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Storage health check failed durationMs=${responseTime}: ${msg}`);
      return {
        status: 'degraded',
        message: 'Storage service unavailable',
        responseTime,
      };
    }
  }

  private async checkQueue(): Promise<QueueDepth | null> {
    if (!this.gradingQueue) return null;
    try {
      const [counts, paused] = await Promise.all([
        this.gradingQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        this.gradingQueue.isPaused(),
      ]);
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        paused,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Queue depth check failed: ${msg}`);
      return null;
    }
  }
}
