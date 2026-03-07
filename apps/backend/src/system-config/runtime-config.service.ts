import { Injectable } from '@nestjs/common';
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

@Injectable()
export class RuntimeConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async getStorageAdminConfig() {
    const stored = await this.systemConfigService.getValue<StorageConfig>('storage');
    const endpoint = this.normalizeText(stored?.endpoint) || this.configService.get<string>('MINIO_ENDPOINT') || '';
    const bucket = this.normalizeText(stored?.bucket) || this.configService.get<string>('MINIO_BUCKET') || 'submissions';
    const region = this.normalizeText(stored?.region) || this.configService.get<string>('MINIO_REGION') || 'us-east-1';
    const accessKeySet = Boolean(this.configService.get<string>('MINIO_ACCESS_KEY') || '');
    const secretKeySet = Boolean(this.configService.get<string>('MINIO_SECRET_KEY') || '');
    return { endpoint, bucket, region, accessKeySet, secretKeySet };
  }

  async getStorageRuntimeConfig() {
    const adminConfig = await this.getStorageAdminConfig();
    return {
      endpoint: adminConfig.endpoint,
      bucket: adminConfig.bucket,
      region: adminConfig.region,
      accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY') || '',
      secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY') || '',
    };
  }

  async getEmailAdminConfig() {
    const stored = await this.systemConfigService.getValue<EmailConfig>('email');
    const host = this.normalizeText(stored?.host) || this.configService.get<string>('SMTP_HOST') || '';
    const port = stored?.port ?? Number(this.configService.get<string>('SMTP_PORT') || '587');
    const user = this.normalizeText(stored?.user) || this.configService.get<string>('SMTP_USER') || '';
    const from = this.normalizeText(stored?.from) || this.configService.get<string>('SMTP_FROM') || 'noreply@homework-ai.local';
    const secure = stored?.secure ?? port === 465;
    const passwordSet = Boolean(this.configService.get<string>('SMTP_PASS') || '');
    return { host, port, user, from, secure, passwordSet };
  }

  async getEmailRuntimeConfig() {
    const adminConfig = await this.getEmailAdminConfig();
    return {
      host: adminConfig.host,
      port: adminConfig.port,
      user: adminConfig.user,
      from: adminConfig.from,
      secure: adminConfig.secure,
      password: this.configService.get<string>('SMTP_PASS') || '',
    };
  }

  async getRedisAdminConfig() {
    const resolved = await this.resolveRedisConfig();
    const { host, port, db, username, tls, passwordSet } = resolved;
    return { host, port, db, username, tls, passwordSet };
  }

  async getRedisRuntimeConfig() {
    const resolved = await this.resolveRedisConfig();
    const options: RedisOptions = {
      host: resolved.host,
      port: resolved.port,
      db: resolved.db,
      username: resolved.username || undefined,
      password: resolved.password || undefined,
      tls: resolved.tls ? {} : undefined,
    };
    return options;
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
