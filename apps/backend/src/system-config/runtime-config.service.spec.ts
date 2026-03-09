import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RuntimeConfigService } from './runtime-config.service';
import { SystemConfigService } from './system-config.service';

describe('RuntimeConfigService', () => {
  let service: RuntimeConfigService;
  let configService: any;
  let systemConfigService: any;

  const envDefaults: Record<string, string> = {
    MINIO_ENDPOINT: 'http://minio:9000',
    MINIO_BUCKET: 'test-bucket',
    MINIO_REGION: 'us-west-2',
    MINIO_ACCESS_KEY: 'access123',
    MINIO_SECRET_KEY: 'secret456',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'user@example.com',
    SMTP_FROM: 'noreply@example.com',
    SMTP_PASS: 'smtp-pass',
    REDIS_URL: 'redis://localhost:6379/0',
    REDIS_PASSWORD: 'redis-pass',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => envDefaults[key] || undefined),
    };

    systemConfigService = {
      getValue: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuntimeConfigService,
        { provide: ConfigService, useValue: configService },
        { provide: SystemConfigService, useValue: systemConfigService },
      ],
    }).compile();

    service = module.get<RuntimeConfigService>(RuntimeConfigService);
  });

  // ─── Storage ───

  describe('getStorageAdminConfig', () => {
    it('should return storage config from env defaults', async () => {
      const result = await service.getStorageAdminConfig();

      expect(result.endpoint).toBe('http://minio:9000');
      expect(result.bucket).toBe('test-bucket');
      expect(result.region).toBe('us-west-2');
      expect(result.accessKeySet).toBe(true);
      expect(result.secretKeySet).toBe(true);
    });

    it('should prefer stored overrides over env values', async () => {
      systemConfigService.getValue.mockResolvedValue({
        endpoint: 'http://custom:9000',
        bucket: 'custom-bucket',
        region: 'eu-west-1',
      });

      const result = await service.getStorageAdminConfig();

      expect(result.endpoint).toBe('http://custom:9000');
      expect(result.bucket).toBe('custom-bucket');
      expect(result.region).toBe('eu-west-1');
    });

    it('should report false for unset access keys', async () => {
      configService.get.mockReturnValue(undefined);

      const result = await service.getStorageAdminConfig();

      expect(result.accessKeySet).toBe(false);
      expect(result.secretKeySet).toBe(false);
    });
  });

  describe('getStorageRuntimeConfig', () => {
    it('should return full storage credentials', async () => {
      const result = await service.getStorageRuntimeConfig();

      expect(result.accessKeyId).toBe('access123');
      expect(result.secretAccessKey).toBe('secret456');
      expect(result.endpoint).toBe('http://minio:9000');
    });
  });

  // ─── Email ───

  describe('getEmailAdminConfig', () => {
    it('should return email config from env defaults', async () => {
      const result = await service.getEmailAdminConfig();

      expect(result.host).toBe('smtp.example.com');
      expect(result.port).toBe(587);
      expect(result.user).toBe('user@example.com');
      expect(result.from).toBe('noreply@example.com');
      expect(result.secure).toBe(false);
      expect(result.passwordSet).toBe(true);
    });

    it('should prefer stored overrides over env', async () => {
      systemConfigService.getValue.mockResolvedValue({
        host: 'custom-smtp',
        port: 465,
        user: 'custom-user',
        from: 'custom@example.com',
        secure: true,
      });

      const result = await service.getEmailAdminConfig();

      expect(result.host).toBe('custom-smtp');
      expect(result.port).toBe(465);
      expect(result.secure).toBe(true);
    });

    it('should default secure to true when port is 465 and no stored override', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SMTP_PORT') return '465';
        return envDefaults[key];
      });

      const result = await service.getEmailAdminConfig();

      expect(result.secure).toBe(true);
    });
  });

  describe('getEmailRuntimeConfig', () => {
    it('should return email config with password', async () => {
      const result = await service.getEmailRuntimeConfig();

      expect(result.password).toBe('smtp-pass');
      expect(result.host).toBe('smtp.example.com');
    });
  });

  // ─── Redis ───

  describe('getRedisAdminConfig', () => {
    it('should return redis config from env defaults', async () => {
      const result = await service.getRedisAdminConfig();

      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(0);
      expect(result.tls).toBe(false);
      expect(result.passwordSet).toBe(true);
    });

    it('should prefer stored overrides', async () => {
      systemConfigService.getValue.mockResolvedValue({
        host: 'redis-cluster',
        port: 6380,
        db: 2,
        username: 'admin',
        tls: true,
      });

      const result = await service.getRedisAdminConfig();

      expect(result.host).toBe('redis-cluster');
      expect(result.port).toBe(6380);
      expect(result.db).toBe(2);
      expect(result.username).toBe('admin');
      expect(result.tls).toBe(true);
    });

    it('should parse rediss:// URL for TLS', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'rediss://user:pass@secure-host:6380/3';
        return envDefaults[key];
      });

      const result = await service.getRedisAdminConfig();

      expect(result.host).toBe('secure-host');
      expect(result.port).toBe(6380);
      expect(result.db).toBe(3);
      expect(result.tls).toBe(true);
    });

    it('should handle invalid REDIS_URL gracefully', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'not-a-url';
        if (key === 'REDIS_PASSWORD') return '';
        return undefined;
      });

      const result = await service.getRedisAdminConfig();

      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(0);
      expect(result.tls).toBe(false);
    });
  });

  describe('getRedisRuntimeConfig', () => {
    it('should return redis options for ioredis', async () => {
      const result = await service.getRedisRuntimeConfig();

      expect(result.host).toBe('localhost');
      expect(result.port).toBe(6379);
      expect(result.db).toBe(0);
      expect(result.password).toBe('redis-pass');
      expect(result.tls).toBeUndefined();
    });

    it('should enable TLS options when tls is true', async () => {
      systemConfigService.getValue.mockResolvedValue({ tls: true });

      const result = await service.getRedisRuntimeConfig();

      expect(result.tls).toEqual({});
    });

    it('should omit username and password when empty', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'REDIS_PASSWORD') return '';
        return undefined;
      });

      const result = await service.getRedisRuntimeConfig();

      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
    });
  });

  // ─── normalizeText ───

  describe('normalizeText (indirect via stored overrides)', () => {
    it('should trim whitespace-only stored values and fall back to env', async () => {
      systemConfigService.getValue.mockResolvedValue({
        endpoint: '   ',
        bucket: '  valid-bucket  ',
      });

      const result = await service.getStorageAdminConfig();

      expect(result.endpoint).toBe('http://minio:9000');
      expect(result.bucket).toBe('valid-bucket');
    });
  });

  // ─── parseRedisUrl edge cases ───

  describe('parseRedisUrl edge cases', () => {
    it('should extract username and password from URL', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'redis://myuser:mypass@myhost:6380/5';
        if (key === 'REDIS_PASSWORD') return '';
        return undefined;
      });

      const result = await service.getRedisAdminConfig();

      expect(result.host).toBe('myhost');
      expect(result.port).toBe(6380);
      expect(result.db).toBe(5);
      expect(result.username).toBe('myuser');
      expect(result.passwordSet).toBe(true);
    });

    it('should use REDIS_PASSWORD env over URL password', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'redis://user:urlpass@host:6379';
        if (key === 'REDIS_PASSWORD') return 'env-pass';
        return undefined;
      });

      const result = await service.getRedisAdminConfig();

      expect(result.passwordSet).toBe(true);
    });

    it('should default to db 0 when pathname is empty', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'REDIS_PASSWORD') return '';
        return undefined;
      });

      const result = await service.getRedisAdminConfig();

      expect(result.db).toBe(0);
    });
  });
});
