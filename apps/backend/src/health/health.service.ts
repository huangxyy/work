import { Injectable, Logger } from '@nestjs/common';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

type ServiceHealth = {
  status: HealthStatus;
  message?: string;
  responseTime?: number;
};

type OverallHealth = {
  status: HealthStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  uptime: number;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly s3Client: S3Client;
  private readonly storageBucket: string;
  private readonly startTime: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.startTime = Date.now();

    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    const accessKeyId = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('MINIO_SECRET_KEY');
    this.storageBucket = this.config.get<string>('MINIO_BUCKET') || 'submissions';
    const region = this.config.get<string>('MINIO_REGION') || 'us-east-1';

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  async getHealth(): Promise<OverallHealth> {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const allHealthy = [database, redis, storage].every((s) => s.status === 'healthy');
    const anyUnhealthy = [database, redis, storage].some((s) => s.status === 'unhealthy');

    const status: HealthStatus = allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
        storage,
      },
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
      this.logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
      const Redis = (await import('ioredis')).default;
      const client = new Redis(redisUrl);

      await new Promise<void>((resolve, reject) => {
        client.on('error', reject);
        client.ping((err) => {
          if (err) reject(err);
          else resolve();
        });
        setTimeout(() => reject(new Error('Redis ping timeout')), 5000);
      });

      await client.quit();
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return {
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkStorage(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.storageBucket,
        }),
      );
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Storage health check failed', error);
      return {
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - start,
      };
    }
  }
}
