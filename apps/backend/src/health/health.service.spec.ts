import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

// Mock ioredis module
jest.mock('ioredis', () => {
  const mockRedisInstance = {
    status: 'ready',
    ping: jest.fn((cb: (err: Error | null) => void) => cb(null)),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
  return { default: jest.fn(() => mockRedisInstance), __mockInstance: mockRedisInstance };
});

// Mock @aws-sdk/client-s3
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  HeadBucketCommand: jest.fn(),
}));

describe('HealthService', () => {
  let service: HealthService;
  let prisma: any;
  let runtimeConfig: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    runtimeConfig = {
      getRedisRuntimeConfig: jest.fn().mockResolvedValue({
        host: 'localhost',
        port: 6379,
        db: 0,
      }),
      getStorageRuntimeConfig: jest.fn().mockResolvedValue({
        endpoint: 'http://localhost:9000',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuntimeConfigService, useValue: runtimeConfig },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe('getHealth', () => {
    it('should return healthy when all services are up', async () => {
      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when database is down', async () => {
      prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('DB down'));

      const result = await service.getHealth();

      expect(result.services.database.status).toBe('unhealthy');
      expect(result.services.database.message).toBe('Database connection failed');
      expect(result.status).toBe('unhealthy');
    });

    it('should return degraded when redis fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ioredis = require('ioredis');
      ioredis.__mockInstance.ping.mockImplementation(
        (cb: (err: Error | null) => void) => cb(new Error('Redis down')),
      );
      ioredis.__mockInstance.status = 'end';

      const result = await service.getHealth();

      expect(result.services.redis.status).toBe('degraded');
    });

    it('should return degraded when storage fails', async () => {
      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://localhost:9000',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      });

      // Mock S3Client send to throw
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const s3 = require('@aws-sdk/client-s3');
      s3.S3Client.mockImplementation(() => ({
        send: jest.fn().mockRejectedValue(new Error('Storage down')),
      }));

      // Force new client creation by changing signature
      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://other:9000',
        bucket: 'other-bucket',
        region: 'us-east-1',
        accessKeyId: 'other',
        secretAccessKey: 'other',
      });

      const result = await service.getHealth();

      expect(result.services.storage.status).toBe('degraded');
    });
  });
});
