import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { GradingPolicyService, type GradingPolicyInput } from '../grading-policy/grading-policy.service';
import { LlmConfigService } from '../llm/llm-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';

type BudgetConfig = {
  enabled?: boolean;
  dailyCallLimit?: number;
  mode?: 'soft' | 'hard';
};

@Injectable()
export class TeacherSettingsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
    private readonly llmConfigService: LlmConfigService,
    private readonly gradingPolicyService: GradingPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async getGradingSettings() {
    const [runtime, budgetConfig] = await Promise.all([
      this.llmConfigService.resolveRuntimeConfig(),
      this.systemConfigService.getValue<BudgetConfig>('budget'),
    ]);

    const budget = this.buildBudgetConfig(budgetConfig);

    return {
      grading: {
        defaultMode: 'cheap',
        needRewriteDefault: false,
        provider: {
          id: runtime.providerId || undefined,
          name: runtime.providerName,
        },
        model: runtime.model || undefined,
        cheaperModel: runtime.cheaperModel || undefined,
        qualityModel: runtime.qualityModel || undefined,
        maxTokens: runtime.maxTokens,
        temperature: runtime.temperature,
        topP: runtime.topP,
        presencePenalty: runtime.presencePenalty,
        frequencyPenalty: runtime.frequencyPenalty,
        timeoutMs: runtime.timeoutMs,
        responseFormat: runtime.responseFormat,
        stop: runtime.stop,
        systemPromptSet: Boolean(runtime.systemPrompt && runtime.systemPrompt.trim()),
      },
      budget,
    };
  }

  async getPolicySummary(
    query: { classId?: string; homeworkId?: string },
    user: AuthUser,
  ) {
    if (!query.classId && !query.homeworkId) {
      throw new BadRequestException('classId or homeworkId is required');
    }

    let classId = query.classId;
    if (query.homeworkId) {
      classId = await this.ensureHomeworkAccess(query.homeworkId, user);
    }

    if (classId) {
      await this.ensureClassAccess(classId, user);
    }

    const [classPolicy, homeworkPolicy, effective] = await Promise.all([
      classId ? this.gradingPolicyService.getClassPolicy(classId) : Promise.resolve(null),
      query.homeworkId ? this.gradingPolicyService.getHomeworkPolicy(query.homeworkId) : Promise.resolve(null),
      this.gradingPolicyService.resolvePolicy({ classId, homeworkId: query.homeworkId }),
    ]);

    return {
      classPolicy: classPolicy
        ? {
            classId: classPolicy.classId,
            mode: classPolicy.mode,
            needRewrite: classPolicy.needRewrite,
            updatedAt: classPolicy.updatedAt.toISOString(),
          }
        : null,
      homeworkPolicy: homeworkPolicy
        ? {
            homeworkId: homeworkPolicy.homeworkId,
            mode: homeworkPolicy.mode,
            needRewrite: homeworkPolicy.needRewrite,
            updatedAt: homeworkPolicy.updatedAt.toISOString(),
          }
        : null,
      effective,
    };
  }

  async getPolicyPreview(query: { classId?: string }, user: AuthUser) {
    if (!query.classId) {
      throw new BadRequestException('classId is required');
    }

    await this.ensureClassAccess(query.classId, user);

    const [classPolicy, homeworks, homeworkPolicies] = await Promise.all([
      this.gradingPolicyService.getClassPolicy(query.classId),
      this.prisma.homework.findMany({
        where: { classId: query.classId },
        select: { id: true, title: true, dueAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gradingPolicy.findMany({
        where: { homeworkId: { not: null }, homework: { classId: query.classId } },
        select: { homeworkId: true, mode: true, needRewrite: true, updatedAt: true },
      }),
    ]);

    const homeworkIds = homeworks.map((homework) => homework.id);
    const [submissionCounts, recentSubmissions] = await Promise.all([
      homeworkIds.length
        ? this.prisma.submission.groupBy({
            by: ['homeworkId'],
            where: { homeworkId: { in: homeworkIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      homeworkIds.length
        ? this.prisma.submission.findMany({
            where: { homeworkId: { in: homeworkIds } },
            select: { homeworkId: true, status: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const countMap = new Map<string, number>(
      submissionCounts.map((item): [string, number] => [item.homeworkId as string, item._count._all]),
    );
    const lastStatusMap = new Map<string, { status: string; updatedAt: Date }>();
    for (const submission of recentSubmissions) {
      if (!lastStatusMap.has(submission.homeworkId)) {
        lastStatusMap.set(submission.homeworkId, {
          status: submission.status,
          updatedAt: submission.updatedAt,
        });
        if (lastStatusMap.size === homeworkIds.length) {
          break;
        }
      }
    }

    const homeworkPolicyMap = new Map(
      homeworkPolicies.map((policy) => [policy.homeworkId as string, policy]),
    );

    const items = homeworks.map((homework) => {
      const homeworkPolicy = homeworkPolicyMap.get(homework.id) || null;
      const resolved = this.resolveEffectiveWithSource(classPolicy, homeworkPolicy);
      const lastStatus = lastStatusMap.get(homework.id);
      return {
        homeworkId: homework.id,
        title: homework.title,
        dueAt: homework.dueAt ? homework.dueAt.toISOString() : null,
        createdAt: homework.createdAt.toISOString(),
        submissionCount: countMap.get(homework.id) || 0,
        lastStatus: lastStatus?.status || null,
        lastUpdatedAt: lastStatus?.updatedAt ? lastStatus.updatedAt.toISOString() : null,
        effective: resolved.effective,
        source: resolved.source,
      };
    });

    return {
      classId: query.classId,
      classPolicy: classPolicy
        ? {
            classId: classPolicy.classId,
            mode: classPolicy.mode,
            needRewrite: classPolicy.needRewrite,
            updatedAt: classPolicy.updatedAt.toISOString(),
          }
        : null,
      items,
    };
  }

  async upsertClassPolicy(classId: string, input: GradingPolicyInput, user: AuthUser) {
    await this.ensureClassAccess(classId, user);
    if (input.mode === undefined && input.needRewrite === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    return this.gradingPolicyService.upsertClassPolicy(classId, input);
  }

  async upsertHomeworkPolicy(homeworkId: string, input: GradingPolicyInput, user: AuthUser) {
    await this.ensureHomeworkAccess(homeworkId, user);
    if (input.mode === undefined && input.needRewrite === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    return this.gradingPolicyService.upsertHomeworkPolicy(homeworkId, input);
  }

  async clearClassPolicy(classId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);
    return this.gradingPolicyService.clearClassPolicy(classId);
  }

  async clearHomeworkPolicy(homeworkId: string, user: AuthUser) {
    await this.ensureHomeworkAccess(homeworkId, user);
    return this.gradingPolicyService.clearHomeworkPolicy(homeworkId);
  }

  private buildBudgetConfig(overrides: BudgetConfig | null) {
    const envLimit = Number(this.configService.get<string>('LLM_DAILY_CALL_LIMIT') || '400');
    const envModeRaw = (this.configService.get<string>('BUDGET_MODE') || 'soft').toLowerCase();
    const envMode = envModeRaw === 'hard' ? 'hard' : 'soft';
    const defaultEnabled = Number.isFinite(envLimit) ? envLimit > 0 : false;

    return {
      enabled: overrides?.enabled ?? defaultEnabled,
      dailyCallLimit: overrides?.dailyCallLimit ?? envLimit,
      mode: overrides?.mode ?? envMode,
    };
  }

  private async ensureClassAccess(classId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return;
    }
    const exists = await this.prisma.class.findFirst({
      where: { id: classId, teachers: { some: { id: user.id } } },
      select: { id: true },
    });
    if (!exists) {
      throw new ForbiddenException('No access to class');
    }
  }

  private async ensureHomeworkAccess(homeworkId: string, user: AuthUser): Promise<string> {
    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true, classId: true },
    });
    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }
    return homework.classId;
  }

  private resolveEffectiveWithSource(
    classPolicy: { mode?: string | null; needRewrite?: boolean | null } | null,
    homeworkPolicy: { mode?: string | null; needRewrite?: boolean | null } | null,
  ) {
    const effective = { mode: 'cheap' as 'cheap' | 'quality', needRewrite: false };
    const source = {
      mode: 'default' as 'default' | 'class' | 'homework',
      needRewrite: 'default' as 'default' | 'class' | 'homework',
    };

    const classMode = this.normalizeMode(classPolicy?.mode);
    if (classMode) {
      effective.mode = classMode;
      source.mode = 'class';
    }
    if (classPolicy?.needRewrite !== undefined && classPolicy?.needRewrite !== null) {
      effective.needRewrite = Boolean(classPolicy.needRewrite);
      source.needRewrite = 'class';
    }

    const homeworkMode = this.normalizeMode(homeworkPolicy?.mode);
    if (homeworkMode) {
      effective.mode = homeworkMode;
      source.mode = 'homework';
    }
    if (homeworkPolicy?.needRewrite !== undefined && homeworkPolicy?.needRewrite !== null) {
      effective.needRewrite = Boolean(homeworkPolicy.needRewrite);
      source.needRewrite = 'homework';
    }

    return { effective, source };
  }

  private normalizeMode(value?: string | null): 'cheap' | 'quality' | null {
    if (value === 'cheap' || value === 'quality') {
      return value;
    }
    return null;
  }
}
