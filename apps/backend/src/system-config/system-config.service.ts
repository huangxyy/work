import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CacheEntry = {
  value: unknown | null;
  fetchedAt: number;
};

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown | null>>();
  private readonly ttlMs = 15000;

  constructor(private readonly prisma: PrismaService) {}

  async getValue<T>(key: string): Promise<T | null> {
    const startedAt = Date.now();
    const now = startedAt;
    const cached = this.cache.get(key);
    if (cached && now - cached.fetchedAt < this.ttlMs) {
      this.logger.debug(`System config cache hit key=${key} durationMs=${Date.now() - startedAt}`);
      return cached.value as T | null;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      const value = await pending;
      this.logger.debug(`System config inflight hit key=${key} durationMs=${Date.now() - startedAt}`);
      return value as T | null;
    }

    const fetchPromise = this.prisma.systemConfig.findUnique({ where: { key } })
      .then((record) => {
        const value = record?.value ?? null;
        this.cache.set(key, { value, fetchedAt: Date.now() });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, fetchPromise);
    const value = await fetchPromise;

    this.logger.debug(`System config fetched from db key=${key} durationMs=${Date.now() - startedAt}`);

    return value as T | null;
  }

  async setValue<T extends Prisma.InputJsonValue>(key: string, value: T): Promise<void> {
    const startedAt = Date.now();
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.cache.set(key, { value, fetchedAt: Date.now() });
    this.logger.debug(`System config set key=${key} durationMs=${Date.now() - startedAt}`);
  }

  async getFeatureFlags(): Promise<Record<string, boolean>> {
    const stored = await this.getValue<Record<string, boolean>>('feature_flags');
    return stored || {};
  }

  async setFeatureFlag(flag: string, enabled: boolean): Promise<Record<string, boolean>> {
    const flags = await this.getFeatureFlags();
    flags[flag] = enabled;
    await this.setValue('feature_flags', flags);
    return flags;
  }

  async deleteValue(key: string): Promise<void> {
    const startedAt = Date.now();
    await this.prisma.systemConfig.delete({ where: { key } }).catch((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        return;
      }
      throw error;
    });
    this.cache.delete(key);
    this.inflight.delete(key);
    this.logger.debug(`System config deleted key=${key} durationMs=${Date.now() - startedAt}`);
  }
}
