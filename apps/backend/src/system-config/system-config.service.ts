import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CacheEntry = {
  value: unknown | null;
  fetchedAt: number;
};

@Injectable()
export class SystemConfigService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 15000;

  constructor(private readonly prisma: PrismaService) {}

  async getValue<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.fetchedAt < this.ttlMs) {
      return cached.value as T | null;
    }

    const record = await this.prisma.systemConfig.findUnique({ where: { key } });
    const value = record?.value ?? null;
    this.cache.set(key, { value, fetchedAt: now });
    return value as T | null;
  }

  async setValue<T extends Prisma.InputJsonValue>(key: string, value: T): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.cache.set(key, { value, fetchedAt: Date.now() });
  }
}
