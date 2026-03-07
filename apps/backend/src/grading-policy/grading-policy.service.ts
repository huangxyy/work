import { Logger, Injectable } from '@nestjs/common';
import { GradingPolicy } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PolicyCacheEntry = {
  value: GradingPolicy | null;
  fetchedAt: number;
};

export type GradingPolicyInput = {
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
};

export type GradingPolicyResolved = {
  mode: 'cheap' | 'quality';
  needRewrite: boolean;
};

@Injectable()
export class GradingPolicyService {
  private readonly logger = new Logger(GradingPolicyService.name);
  private readonly classPolicyCache = new Map<string, PolicyCacheEntry>();
  private readonly classPolicyInflight = new Map<string, Promise<GradingPolicy | null>>();
  private readonly homeworkPolicyCache = new Map<string, PolicyCacheEntry>();
  private readonly homeworkPolicyInflight = new Map<string, Promise<GradingPolicy | null>>();
  private readonly policyCacheTtlMs = 15000;

  constructor(private readonly prisma: PrismaService) {}

  async getClassPolicy(classId: string) {
    return this.getPolicyWithCache({
      cache: this.classPolicyCache,
      inflight: this.classPolicyInflight,
      key: classId,
      label: 'class',
      fetcher: () => this.prisma.gradingPolicy.findUnique({ where: { classId } }),
    });
  }

  async getHomeworkPolicy(homeworkId: string) {
    return this.getPolicyWithCache({
      cache: this.homeworkPolicyCache,
      inflight: this.homeworkPolicyInflight,
      key: homeworkId,
      label: 'homework',
      fetcher: () => this.prisma.gradingPolicy.findUnique({ where: { homeworkId } }),
    });
  }

  async upsertClassPolicy(classId: string, input: GradingPolicyInput) {
    const startedAt = Date.now();
    const result = await this.prisma.gradingPolicy.upsert({
      where: { classId },
      update: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.needRewrite !== undefined ? { needRewrite: input.needRewrite } : {}),
      },
      create: {
        classId,
        mode: input.mode ?? null,
        needRewrite: input.needRewrite ?? null,
      },
    });
    this.invalidateClassPolicyCache(classId);
    this.logger.debug(`Grading class policy upserted classId=${classId} durationMs=${Date.now() - startedAt}`);
    return result;
  }

  async upsertHomeworkPolicy(homeworkId: string, input: GradingPolicyInput) {
    const startedAt = Date.now();
    const result = await this.prisma.gradingPolicy.upsert({
      where: { homeworkId },
      update: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.needRewrite !== undefined ? { needRewrite: input.needRewrite } : {}),
      },
      create: {
        homeworkId,
        mode: input.mode ?? null,
        needRewrite: input.needRewrite ?? null,
      },
    });
    this.invalidateHomeworkPolicyCache(homeworkId);
    this.logger.debug(`Grading homework policy upserted homeworkId=${homeworkId} durationMs=${Date.now() - startedAt}`);
    return result;
  }

  async clearClassPolicy(classId: string) {
    const startedAt = Date.now();
    const result = await this.prisma.gradingPolicy.deleteMany({ where: { classId } });
    this.invalidateClassPolicyCache(classId);
    this.logger.debug(
      `Grading class policy cleared classId=${classId} deleted=${result.count} durationMs=${Date.now() - startedAt}`,
    );
    return result;
  }

  async clearHomeworkPolicy(homeworkId: string) {
    const startedAt = Date.now();
    const result = await this.prisma.gradingPolicy.deleteMany({ where: { homeworkId } });
    this.invalidateHomeworkPolicyCache(homeworkId);
    this.logger.debug(
      `Grading homework policy cleared homeworkId=${homeworkId} deleted=${result.count} durationMs=${Date.now() - startedAt}`,
    );
    return result;
  }

  async resolvePolicy(params: { classId?: string | null; homeworkId?: string | null }): Promise<GradingPolicyResolved> {
    const startedAt = Date.now();
    let classId = params.classId || undefined;
    if (!classId && params.homeworkId) {
      const homework = await this.prisma.homework.findUnique({
        where: { id: params.homeworkId },
        select: { classId: true },
      });
      classId = homework?.classId || undefined;
    }

    const [classPolicy, homeworkPolicy] = await Promise.all([
      classId ? this.getClassPolicy(classId) : Promise.resolve(null),
      params.homeworkId ? this.getHomeworkPolicy(params.homeworkId) : Promise.resolve(null),
    ]);

    const resolved: GradingPolicyResolved = { mode: 'cheap', needRewrite: false };
    this.applyPolicy(resolved, classPolicy);
    this.applyPolicy(resolved, homeworkPolicy);

    this.logger.debug(
      `Grading policy resolved classId=${classId || 'none'} homeworkId=${params.homeworkId || 'none'} classPolicy=${Boolean(classPolicy)} homeworkPolicy=${Boolean(homeworkPolicy)} mode=${resolved.mode} needRewrite=${resolved.needRewrite} durationMs=${Date.now() - startedAt}`,
    );

    return resolved;
  }

  private async getPolicyWithCache(params: {
    cache: Map<string, PolicyCacheEntry>;
    inflight: Map<string, Promise<GradingPolicy | null>>;
    key: string;
    label: 'class' | 'homework';
    fetcher: () => Promise<GradingPolicy | null>;
  }): Promise<GradingPolicy | null> {
    const startedAt = Date.now();
    const cached = this.getCachedPolicy(params.cache, params.key);
    if (cached !== undefined) {
      this.logger.debug(
        `Grading ${params.label} policy cache hit key=${params.key} found=${Boolean(cached)} durationMs=${Date.now() - startedAt}`,
      );
      return cached;
    }

    const pending = params.inflight.get(params.key);
    if (pending) {
      const value = await pending;
      this.logger.debug(
        `Grading ${params.label} policy inflight hit key=${params.key} found=${Boolean(value)} durationMs=${Date.now() - startedAt}`,
      );
      return value;
    }

    const fetchPromise = params.fetcher()
      .then((value) => {
        params.cache.set(params.key, { value, fetchedAt: Date.now() });
        return value;
      })
      .finally(() => {
        params.inflight.delete(params.key);
      });

    params.inflight.set(params.key, fetchPromise);
    const value = await fetchPromise;

    this.logger.debug(
      `Grading ${params.label} policy fetched key=${params.key} found=${Boolean(value)} durationMs=${Date.now() - startedAt}`,
    );

    return value;
  }

  private getCachedPolicy(cache: Map<string, PolicyCacheEntry>, key: string): GradingPolicy | null | undefined {
    const cached = cache.get(key);
    if (!cached) {
      return undefined;
    }
    if (Date.now() - cached.fetchedAt < this.policyCacheTtlMs) {
      return cached.value;
    }
    cache.delete(key);
    return undefined;
  }

  private invalidateClassPolicyCache(classId: string) {
    this.classPolicyCache.delete(classId);
    this.classPolicyInflight.delete(classId);
  }

  private invalidateHomeworkPolicyCache(homeworkId: string) {
    this.homeworkPolicyCache.delete(homeworkId);
    this.homeworkPolicyInflight.delete(homeworkId);
  }

  private applyPolicy(target: GradingPolicyResolved, policy: { mode?: string | null; needRewrite?: boolean | null } | null) {
    if (!policy) {
      return;
    }
    const normalizedMode = this.normalizeMode(policy.mode);
    if (normalizedMode) {
      target.mode = normalizedMode;
    }
    if (policy.needRewrite !== undefined && policy.needRewrite !== null) {
      target.needRewrite = Boolean(policy.needRewrite);
    }
  }

  private normalizeMode(value?: string | null): 'cheap' | 'quality' | null {
    if (value === 'cheap' || value === 'quality') {
      return value;
    }
    return null;
  }
}
