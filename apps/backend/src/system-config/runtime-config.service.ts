import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import { SystemConfigService } from './system-config.service';

type StorageConfig = {
  endpoint?: string;
  bucket?: string;
  region?: string;
};

type EmailConfig = {
  host?: string;
  port?: number;
  user?: string;
  from?: string;
  secure?: boolean;
};

type RedisConfig = {
  host?: string;
  port?: number;
  db?: number;
  username?: string;
  tls?: boolean;
};

type ParsedRedisUrl = {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tls: boolean;
};

type ResolvedRedisConfig = {
  host: string;
  port: number;
  db: number;
  username: string;
  tls: boolean;
  passwordSet: boolean;
  password: string;
};

type ResolvedStorageConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type ResolvedEmailConfig = {
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  password: string;
};

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async getStorageAdminConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveStorageConfig();
    const result = {
      endpoint: resolved.endpoint,
      bucket: resolved.bucket,
      region: resolved.region,
      accessKeySet: Boolean(resolved.accessKeyId),
      secretKeySet: Boolean(resolved.secretAccessKey),
    };

    this.logger.debug(
      `Storage admin config resolved endpointSet=${Boolean(result.endpoint)} bucket=${result.bucket || 'none'} region=${result.region || 'none'} accessKeySet=${result.accessKeySet} secretKeySet=${result.secretKeySet} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async getStorageRuntimeConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveStorageConfig();
    const result = {
      endpoint: resolved.endpoint,
      bucket: resolved.bucket,
      region: resolved.region,
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
    };

    this.logger.debug(
      `Storage runtime config resolved endpointSet=${Boolean(result.endpoint)} bucket=${result.bucket || 'none'} region=${result.region || 'none'} accessKeySet=${Boolean(result.accessKeyId)} secretKeySet=${Boolean(result.secretAccessKey)} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async getEmailAdminConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveEmailConfig();
    const result = {
      host: resolved.host,
      port: resolved.port,
      user: resolved.user,
      from: resolved.from,
      secure: resolved.secure,
      passwordSet: Boolean(resolved.password),
    };

    this.logger.debug(
      `Email admin config resolved hostSet=${Boolean(result.host)} port=${result.port} userSet=${Boolean(result.user)} secure=${result.secure} passwordSet=${result.passwordSet} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async getEmailRuntimeConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveEmailConfig();
    const result = {
      host: resolved.host,
      port: resolved.port,
      user: resolved.user,
      from: resolved.from,
      secure: resolved.secure,
      password: resolved.password,
    };

    this.logger.debug(
      `Email runtime config resolved hostSet=${Boolean(result.host)} port=${result.port} userSet=${Boolean(result.user)} secure=${result.secure} passwordSet=${Boolean(result.password)} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async getRedisAdminConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveRedisConfig();
    const { host, port, db, username, tls, passwordSet } = resolved;
    const result = { host, port, db, username, tls, passwordSet };

    this.logger.debug(
      `Redis admin config resolved host=${host} port=${port} db=${db} tls=${tls} usernameSet=${Boolean(username)} passwordSet=${passwordSet} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async getRedisRuntimeConfig() {
    const startedAt = Date.now();
    const resolved = await this.resolveRedisConfig();
    const options: RedisOptions = {
      host: resolved.host,
      port: resolved.port,
      db: resolved.db,
      username: resolved.username || undefined,
      password: resolved.password || undefined,
      tls: resolved.tls ? {} : undefined,
    };

    this.logger.debug(
      `Redis runtime config resolved host=${resolved.host} port=${resolved.port} db=${resolved.db} tls=${resolved.tls} usernameSet=${Boolean(resolved.username)} passwordSet=${resolved.passwordSet} durationMs=${Date.now() - startedAt}`,
    );

    return options;
  }

  private async resolveStorageConfig(): Promise<ResolvedStorageConfig> {
    const stored = await this.systemConfigService.getValue<StorageConfig>('storage');
    const accessKeyId = this.configService.get<string>('MINIO_ACCESS_KEY') || '';
    const secretAccessKey = this.configService.get<string>('MINIO_SECRET_KEY') || '';

    return {
      endpoint: this.normalizeText(stored?.endpoint) || this.configService.get<string>('MINIO_ENDPOINT') || '',
      bucket: this.normalizeText(stored?.bucket) || this.configService.get<string>('MINIO_BUCKET') || 'submissions',
      region: this.normalizeText(stored?.region) || this.configService.get<string>('MINIO_REGION') || 'us-east-1',
      accessKeyId,
      secretAccessKey,
    };
  }

  private async resolveEmailConfig(): Promise<ResolvedEmailConfig> {
    const stored = await this.systemConfigService.getValue<EmailConfig>('email');
    const port = stored?.port ?? Number(this.configService.get<string>('SMTP_PORT') || '587');

    return {
      host: this.normalizeText(stored?.host) || this.configService.get<string>('SMTP_HOST') || '',
      port,
      user: this.normalizeText(stored?.user) || this.configService.get<string>('SMTP_USER') || '',
      from: this.normalizeText(stored?.from) || this.configService.get<string>('SMTP_FROM') || 'noreply@homework-ai.local',
      secure: stored?.secure ?? port === 465,
      password: this.configService.get<string>('SMTP_PASS') || '',
    };
  }

  private async resolveRedisConfig(): Promise<ResolvedRedisConfig> {
    const stored = await this.systemConfigService.getValue<RedisConfig>('redis');
    const parsedEnv = this.parseRedisUrl(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
    const password = this.configService.get<string>('REDIS_PASSWORD') || parsedEnv.password || '';
    const host = this.normalizeText(stored?.host) || parsedEnv.host;
    const port = stored?.port ?? parsedEnv.port;
    const db = stored?.db ?? parsedEnv.db;
    const username = this.normalizeText(stored?.username) || parsedEnv.username || '';
    const tls = stored?.tls ?? parsedEnv.tls;
    const passwordSet = Boolean(password);
    return { host, port, db, username, tls, passwordSet, password };
  }

  private parseRedisUrl(redisUrl: string): ParsedRedisUrl {
    try {
      const url = new URL(redisUrl);
      const dbPath = (url.pathname || '').replace('/', '');
      const db = dbPath ? Number(dbPath) : 0;
      return {
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 6379,
        db: Number.isFinite(db) ? db : 0,
        username: url.username || undefined,
        password: url.password || undefined,
        tls: url.protocol === 'rediss:',
      };
    } catch {
      return { host: 'localhost', port: 6379, db: 0, tls: false };
    }
  }

  private normalizeText(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }
}
