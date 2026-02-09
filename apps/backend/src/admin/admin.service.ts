import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { LlmConfigService, type LlmProviderConfig } from '../llm/llm-config.service';
import { LlmLogsService } from '../llm/llm-logs.service';
import { QueueService } from '../queue/queue.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { AdminUsageQueryDto } from './dto/admin-usage-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

type LlmConfig = {
  providerName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  cheaperModel?: string;
  qualityModel?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  timeoutMs?: number;
  stop?: string[];
  responseFormat?: string;
  systemPrompt?: string;
  activeProviderId?: string;
};

type OcrConfig = {
  apiKey?: string;
  secretKey?: string;
};

type BudgetConfig = {
  enabled?: boolean;
  dailyCallLimit?: number;
  mode?: 'soft' | 'hard';
};

type HealthStatus = {
  ok: boolean;
  checkedAt: string;
  status?: number;
  latencyMs?: number;
  reason?: string;
  model?: string;
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
    private readonly llmConfigService: LlmConfigService,
    private readonly llmLogsService: LlmLogsService,
    private readonly queueService: QueueService,
    private readonly baiduOcrService: BaiduOcrService,
  ) {}

  async getMetrics() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [usersByRole, classesTotal, enrollmentsTotal, homeworksTotal, submissionsTotal, submissionsToday] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
        this.prisma.class.count(),
        this.prisma.enrollment.count(),
        this.prisma.homework.count(),
        this.prisma.submission.count(),
        this.prisma.submission.count({ where: { createdAt: { gte: startOfDay } } }),
      ]);

    const usersTotal = usersByRole.reduce((sum, item) => sum + item._count._all, 0);
    const usersStudents = usersByRole.find((item) => item.role === Role.STUDENT)?._count._all || 0;
    const usersTeachers = usersByRole.find((item) => item.role === Role.TEACHER)?._count._all || 0;
    const usersAdmins = usersByRole.find((item) => item.role === Role.ADMIN)?._count._all || 0;

    return {
      users: {
        total: usersTotal,
        students: usersStudents,
        teachers: usersTeachers,
        admins: usersAdmins,
      },
      classes: { total: classesTotal },
      enrollments: { total: enrollmentsTotal },
      homeworks: { total: homeworksTotal },
      submissions: { total: submissionsTotal, today: submissionsToday },
      updatedAt: new Date().toISOString(),
    };
  }

  async getUsage(query: AdminUsageQueryDto) {
    const days = query.days ?? 7;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const submissions = await this.prisma.submission.findMany({
      where: { createdAt: { gte: start } },
      select: { status: true, errorCode: true, createdAt: true },
      take: 50000,
    });

    const dailyMap = new Map<
      string,
      { date: string; total: number; done: number; failed: number; queued: number; processing: number }
    >();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start.getTime());
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, {
        date: key,
        total: 0,
        done: 0,
        failed: 0,
        queued: 0,
        processing: 0,
      });
    }

    const errorCounts = new Map<string, number>();
    const summary = { total: 0, done: 0, failed: 0, queued: 0, processing: 0 };

    for (const submission of submissions) {
      const key = submission.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.total += 1;
        if (submission.status === 'DONE') {
          entry.done += 1;
        } else if (submission.status === 'FAILED') {
          entry.failed += 1;
        } else if (submission.status === 'PROCESSING') {
          entry.processing += 1;
        } else if (submission.status === 'QUEUED') {
          entry.queued += 1;
        }
      }

      summary.total += 1;
      if (submission.status === 'DONE') {
        summary.done += 1;
      } else if (submission.status === 'FAILED') {
        summary.failed += 1;
      } else if (submission.status === 'PROCESSING') {
        summary.processing += 1;
      } else if (submission.status === 'QUEUED') {
        summary.queued += 1;
      }

      if (submission.errorCode) {
        errorCounts.set(submission.errorCode, (errorCounts.get(submission.errorCode) || 0) + 1);
      }
    }

    const daily = Array.from(dailyMap.values());
    const errors = Array.from(errorCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { days, summary, daily, errors, updatedAt: new Date().toISOString() };
  }

  async listUsers(query: ListUsersQueryDto) {
    const keyword = query.keyword?.trim();
    const take = Math.min(Math.max(query.limit || 500, 1), 500);
    const where: {
      role?: Role;
      isActive?: boolean;
      OR?: Array<{ name?: { contains: string }; account?: { contains: string } }>;
    } = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { account: { contains: keyword } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        account: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  async createUser(dto: CreateAdminUserDto) {
    const account = dto.account.trim();
    const name = dto.name.trim();

    if (!account || !name) {
      throw new BadRequestException('Account and name are required');
    }

    const existing = await this.prisma.user.findUnique({ where: { account } });
    if (existing) {
      throw new BadRequestException('Account already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        account,
        name,
        role: dto.role ?? Role.STUDENT,
        passwordHash,
        isActive: true,
      },
    });

    return {
      id: user.id,
      account: user.account,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException('Name is required');
    }

    // When changing role away from TEACHER, disconnect from all classes to avoid
    // orphaned teacher-class associations that would grant unauthorized access.
    if (dto.role !== undefined && dto.role !== Role.TEACHER && existing.role === Role.TEACHER) {
      await this.prisma.class.updateMany({
        where: { teachers: { some: { id } } },
        data: {},
      });
      // Prisma's implicit many-to-many requires explicit disconnect via class update
      const teacherClasses = await this.prisma.class.findMany({
        where: { teachers: { some: { id } } },
        select: { id: true },
      });
      for (const klass of teacherClasses) {
        await this.prisma.class.update({
          where: { id: klass.id },
          data: { teachers: { disconnect: { id } } },
        });
      }
      if (teacherClasses.length > 0) {
        this.logger.log(
          `Disconnected user ${id} from ${teacherClasses.length} class(es) due to role change from TEACHER to ${dto.role}`,
        );
      }
    }

    // When changing role away from STUDENT, remove enrollments to avoid
    // orphaned enrollment records that could leak homework data.
    if (dto.role !== undefined && dto.role !== Role.STUDENT && existing.role === Role.STUDENT) {
      const deleted = await this.prisma.enrollment.deleteMany({
        where: { studentId: id },
      });
      if (deleted.count > 0) {
        this.logger.log(
          `Removed ${deleted.count} enrollment(s) for user ${id} due to role change from STUDENT to ${dto.role}`,
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return {
      id: user.id,
      account: user.account,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async resetUserPassword(id: string, dto: ResetUserPasswordDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { id, ok: true };
  }

  async listClassSummaries() {
    const classes = await this.prisma.class.findMany({
      include: {
        teachers: { select: { id: true, name: true, account: true } },
        _count: { select: { enrolls: true, homeworks: true, teachers: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      grade: klass.grade,
      teachers: klass.teachers,
      studentCount: klass._count.enrolls,
      teacherCount: klass._count.teachers,
      homeworkCount: klass._count.homeworks,
      createdAt: klass.createdAt,
    }));
  }

  async getSystemConfig() {
    const [llmConfig, ocrConfig, budgetConfig, llmHealth, ocrHealth, llmProviders] = await Promise.all([
      this.systemConfigService.getValue<LlmConfig>('llm'),
      this.systemConfigService.getValue<OcrConfig>('ocr'),
      this.systemConfigService.getValue<BudgetConfig>('budget'),
      this.systemConfigService.getValue<HealthStatus>('health:llm'),
      this.systemConfigService.getValue<HealthStatus>('health:ocr'),
      this.llmConfigService.getProviders(),
    ]);

    const resolvedLlm = this.buildLlmConfig(llmConfig);
    const resolvedOcr = this.buildOcrConfig(ocrConfig);
    const resolvedBudget = this.buildBudgetConfig(budgetConfig);

    return {
      llm: resolvedLlm,
      llmProviders: this.sanitizeProviders(llmProviders),
      ocr: resolvedOcr,
      budget: resolvedBudget,
      health: {
        llm: llmHealth ?? null,
        ocr: ocrHealth ?? null,
      },
    };
  }

  async getQueueMetrics(query: { status?: string; limit?: number }) {
    return this.queueService.getQueueMetrics(query);
  }

  async retryFailedQueueJobs(limit?: number) {
    return this.queueService.retryFailedJobs(limit);
  }

  async cleanQueue(options: { status?: string; graceMs?: number; limit?: number }) {
    return this.queueService.cleanQueue(options);
  }

  async pauseQueue() {
    return this.queueService.pauseQueue();
  }

  async resumeQueue() {
    return this.queueService.resumeQueue();
  }

  async updateSystemConfig(dto: UpdateSystemConfigDto) {
    if (dto.llm) {
      const existing = (await this.systemConfigService.getValue<LlmConfig>('llm')) || {};
      const next: LlmConfig = { ...existing, ...dto.llm };

      this.applyTextUpdate(next, 'providerName', dto.llm.providerName);
      this.applyTextUpdate(next, 'baseUrl', dto.llm.baseUrl);
      this.applyTextUpdate(next, 'model', dto.llm.model);
      this.applyTextUpdate(next, 'cheaperModel', dto.llm.cheaperModel);
      this.applyTextUpdate(next, 'qualityModel', dto.llm.qualityModel);
      this.applyTextUpdate(next, 'responseFormat', dto.llm.responseFormat);
      this.applyTextUpdate(next, 'systemPrompt', dto.llm.systemPrompt);
      this.applyTextUpdate(next, 'activeProviderId', dto.llm.activeProviderId);

      if (dto.llm.apiKey !== undefined) {
        const trimmed = dto.llm.apiKey.trim();
        if (trimmed) {
          next.apiKey = trimmed;
        } else {
          delete next.apiKey;
        }
      }

      if (dto.llm.maxTokens !== undefined) {
        next.maxTokens = dto.llm.maxTokens;
      }
      if (dto.llm.temperature !== undefined) {
        next.temperature = dto.llm.temperature;
      }
      if (dto.llm.topP !== undefined) {
        next.topP = dto.llm.topP;
      }
      if (dto.llm.presencePenalty !== undefined) {
        next.presencePenalty = dto.llm.presencePenalty;
      }
      if (dto.llm.frequencyPenalty !== undefined) {
        next.frequencyPenalty = dto.llm.frequencyPenalty;
      }
      if (dto.llm.timeoutMs !== undefined) {
        next.timeoutMs = dto.llm.timeoutMs;
      }
      if (dto.llm.stop !== undefined) {
        next.stop = dto.llm.stop?.filter((entry) => entry?.trim()) || undefined;
      }

      await this.systemConfigService.setValue('llm', this.stripUndefined(next));
    }

    if (dto.llmProviders) {
      const existingProviders = (await this.systemConfigService.getValue<LlmProviderConfig[]>('llmProviders')) || [];
      const existingMap = new Map(existingProviders.map((provider) => [provider.id, provider]));

      const normalized = dto.llmProviders
        .map((provider) => {
          const id = this.normalizeText(provider.id) || this.normalizeText(provider.name) || '';
          if (!id) {
            return null;
          }
          const existing = existingMap.get(id);
          const baseUrl = this.normalizeText(provider.baseUrl) || this.normalizeText(existing?.baseUrl) || '';
          if (!baseUrl) {
            return null;
          }
          const apiKey = provider.clearApiKey
            ? undefined
            : provider.apiKey !== undefined
              ? this.normalizeText(provider.apiKey) || undefined
              : existing?.apiKey;

          return {
            id,
            name: this.normalizeText(provider.name) || this.normalizeText(existing?.name) || id,
            baseUrl,
            path: this.normalizeText(provider.path) || this.normalizeText(existing?.path) || undefined,
            apiKey,
            enabled: provider.enabled ?? existing?.enabled ?? true,
            headers: provider.headers || existing?.headers || [],
            models: provider.models || existing?.models || [],
          } as LlmProviderConfig;
        })
        .filter(Boolean) as LlmProviderConfig[];

      await this.systemConfigService.setValue('llmProviders', normalized);
    }

    if (dto.ocr) {
      const existing = (await this.systemConfigService.getValue<OcrConfig>('ocr')) || {};
      const next: OcrConfig = { ...existing };
      if (dto.ocr.apiKey !== undefined) {
        const trimmed = dto.ocr.apiKey.trim();
        if (trimmed) {
          next.apiKey = trimmed;
        } else {
          delete next.apiKey;
        }
      }
      if (dto.ocr.secretKey !== undefined) {
        const trimmed = dto.ocr.secretKey.trim();
        if (trimmed) {
          next.secretKey = trimmed;
        } else {
          delete next.secretKey;
        }
      }
      await this.systemConfigService.setValue('ocr', this.stripUndefined(next));
    }

    if (dto.budget) {
      const existing = (await this.systemConfigService.getValue<BudgetConfig>('budget')) || {};
      const next: BudgetConfig = { ...existing, ...dto.budget };
      if (dto.budget.enabled !== undefined) {
        next.enabled = dto.budget.enabled;
      }
      if (dto.budget.dailyCallLimit !== undefined) {
        next.dailyCallLimit = dto.budget.dailyCallLimit;
      }
      if (dto.budget.mode !== undefined) {
        next.mode = dto.budget.mode;
      }
      await this.systemConfigService.setValue('budget', this.stripUndefined(next));
    }

    return this.getSystemConfig();
  }

  async testLlmConnection() {
    const checkedAt = new Date().toISOString();
    const config = await this.llmConfigService.resolveRuntimeConfigForProvider();
    if (!config.baseUrl) {
      const result = { ok: false, reason: 'LLM_BASE_URL is not configured' };
      await this.storeHealthStatus('llm', { ...result, checkedAt });
      return result;
    }
    if (!config.model) {
      const result = { ok: false, reason: 'LLM_MODEL is not configured' };
      await this.storeHealthStatus('llm', { ...result, checkedAt });
      return result;
    }

    const payload: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
      temperature: 0,
    };

    const startedAt = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (config.apiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await this.fetchWithTimeout(
      this.resolveChatUrl(config.baseUrl, config.path),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      config.timeoutMs ?? 12000,
    );

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const result = { ok: false, status: response.status, latencyMs, reason: response.errorText };
      await this.storeHealthStatus('llm', { ...result, checkedAt, model: config.model });
      return result;
    }

    const result = { ok: true, status: response.status, latencyMs, model: config.model };
    await this.storeHealthStatus('llm', { ...result, checkedAt });
    return result;
  }

  async testOcrConnection() {
    const checkedAt = new Date().toISOString();
    const ocrConfig = await this.systemConfigService.getValue<OcrConfig>('ocr');
    const apiKey = this.normalizeText(ocrConfig?.apiKey) ||
      this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
    const secretKey = this.normalizeText(ocrConfig?.secretKey) ||
      this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';

    const config: Partial<{ apiKey: string; secretKey: string }> = {};
    if (apiKey) config.apiKey = apiKey;
    if (secretKey) config.secretKey = secretKey;

    const result = await this.baiduOcrService.testConnection(config);
    await this.storeHealthStatus('ocr', { ...result, checkedAt });
    return result;
  }

  async testLlmCall(
    dto: {
      providerId?: string;
      model?: string;
      prompt: string;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      responseFormat?: string;
      stop?: string[];
    },
    user: AuthUser,
  ) {
    const config = await this.llmConfigService.resolveRuntimeConfigForProvider(dto.providerId, {
      model: dto.model,
      maxTokens: dto.maxTokens,
      temperature: dto.temperature,
      topP: dto.topP,
      presencePenalty: dto.presencePenalty,
      frequencyPenalty: dto.frequencyPenalty,
      responseFormat: dto.responseFormat,
      systemPrompt: dto.systemPrompt,
      stop: dto.stop,
    });

    if (!config.baseUrl) {
      throw new BadRequestException('LLM_BASE_URL is not configured');
    }
    if (!config.model) {
      throw new BadRequestException('LLM_MODEL is not configured');
    }

    const payload: Record<string, unknown> = {
      model: config.model,
      messages: [
        ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
        { role: 'user', content: dto.prompt },
      ],
      max_tokens: config.maxTokens ?? 128,
      temperature: config.temperature ?? 0.2,
    };

    if (typeof config.topP === 'number') {
      payload.top_p = config.topP;
    }
    if (typeof config.presencePenalty === 'number') {
      payload.presence_penalty = config.presencePenalty;
    }
    if (typeof config.frequencyPenalty === 'number') {
      payload.frequency_penalty = config.frequencyPenalty;
    }
    if (config.stop?.length) {
      payload.stop = config.stop;
    }
    if (config.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (config.apiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs ?? 30000);
    let response: Response;
    try {
      response = await fetch(this.resolveChatUrl(config.baseUrl, config.path), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      await this.llmLogsService.logCall({
        source: 'admin-test',
        providerId: config.providerId,
        providerName: config.providerName,
        model: config.model,
        status: 'ERROR',
        latencyMs,
        prompt: dto.prompt,
        systemPrompt: config.systemPrompt,
        error: text,
        userId: user.id,
      });
      return { ok: false, status: response.status, latencyMs, error: text };
    }

    const parsed = text ? this.safeJson(text) : null;
    const usage = this.extractUsage(parsed);
    const cost = this.computeCost(config, usage?.promptTokens, usage?.completionTokens);

    await this.llmLogsService.logCall({
      source: 'admin-test',
      providerId: config.providerId,
      providerName: config.providerName,
      model: config.model,
      status: 'OK',
      latencyMs,
      prompt: dto.prompt,
      systemPrompt: config.systemPrompt,
      response: text,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      cost,
      userId: user.id,
    });

    return {
      ok: true,
      status: response.status,
      latencyMs,
      provider: config.providerName,
      model: config.model,
      response: text,
      usage,
      cost,
    };
  }

  async listLlmLogs(query: {
    page?: number;
    pageSize?: number;
    providerId?: string;
    model?: string;
    status?: string;
    source?: string;
    from?: string;
    to?: string;
  }) {
    return this.llmLogsService.listLogs({
      page: query.page,
      pageSize: query.pageSize,
      providerId: query.providerId,
      model: query.model,
      status: query.status,
      source: query.source,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  async clearLlmLogs(query: { before?: string; source?: string }) {
    return this.llmLogsService.clearLogs({
      before: query.before ? new Date(query.before) : undefined,
      source: query.source,
    });
  }

  private buildLlmConfig(overrides: LlmConfig | null) {
    const envBaseUrl = this.configService.get<string>('LLM_BASE_URL') || '';
    const envApiKey = this.configService.get<string>('LLM_API_KEY') || '';
    const envModel = this.configService.get<string>('LLM_MODEL') || '';
    const envCheaperModel = this.configService.get<string>('LLM_MODEL_CHEAPER') || '';
    const envQualityModel = this.configService.get<string>('LLM_MODEL_QUALITY') || '';
    const envProviderName =
      this.configService.get<string>('LLM_PROVIDER_NAME') ||
      this.configService.get<string>('LLM_PROVIDER') ||
      'llm';
    const envMaxTokens = Number(this.configService.get<string>('LLM_MAX_TOKENS') || '800');
    const envTemperature = Number(this.configService.get<string>('LLM_TEMPERATURE') || '0.2');
    const envTimeout = Number(this.configService.get<string>('LLM_TIMEOUT_MS') || '20000');

    const providerName = this.normalizeText(overrides?.providerName) || envProviderName;
    const baseUrl = this.normalizeText(overrides?.baseUrl) || envBaseUrl;
    const model = this.normalizeText(overrides?.model) || envModel;
    const cheaperModel = this.normalizeText(overrides?.cheaperModel) || envCheaperModel || undefined;
    const qualityModel = this.normalizeText(overrides?.qualityModel) || envQualityModel || undefined;
    const maxTokens = overrides?.maxTokens ?? envMaxTokens;
    const temperature = overrides?.temperature ?? envTemperature;
    const topP = overrides?.topP;
    const presencePenalty = overrides?.presencePenalty;
    const frequencyPenalty = overrides?.frequencyPenalty;
    const timeoutMs = overrides?.timeoutMs ?? envTimeout;
    const stop = overrides?.stop;
    const responseFormat = this.normalizeText(overrides?.responseFormat) || undefined;
    const systemPrompt = this.normalizeText(overrides?.systemPrompt) || undefined;
    const activeProviderId = this.normalizeText(overrides?.activeProviderId) || undefined;
    const apiKeyValue = this.normalizeText(overrides?.apiKey) || envApiKey;

    return {
      providerName,
      baseUrl,
      apiKeySet: Boolean(apiKeyValue),
      model,
      cheaperModel,
      qualityModel,
      maxTokens,
      temperature,
      topP,
      presencePenalty,
      frequencyPenalty,
      timeoutMs,
      stop,
      responseFormat,
      systemPrompt,
      activeProviderId,
    };
  }

  private buildOcrConfig(overrides: OcrConfig | null) {
    const envApiKey = this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
    const envSecretKey = this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';

    return {
      apiKeySet: Boolean(this.normalizeText(overrides?.apiKey) || envApiKey),
      secretKeySet: Boolean(this.normalizeText(overrides?.secretKey) || envSecretKey),
    };
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

  private resolveChatUrl(baseUrl: string, path?: string): string {
    const base = baseUrl.replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      this.assertNotInternalUrl(base);
      return base;
    }
    const customPath = this.normalizeText(path || '');
    if (customPath) {
      if (customPath.startsWith('http://') || customPath.startsWith('https://')) {
        this.assertNotInternalUrl(customPath);
        return customPath;
      }
      const resolved = `${base}${customPath.startsWith('/') ? '' : '/'}${customPath}`;
      this.assertNotInternalUrl(resolved);
      return resolved;
    }
    const resolved = `${base}/v1/chat/completions`;
    this.assertNotInternalUrl(resolved);
    return resolved;
  }

  /**
   * Block requests to internal/private network addresses to prevent SSRF.
   */
  private assertNotInternalUrl(url: string): void {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // Block localhost variants
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname === '0.0.0.0'
      ) {
        throw new BadRequestException('URLs pointing to localhost are not allowed');
      }

      // Block private/internal IP ranges
      const ipParts = hostname.split('.').map(Number);
      if (ipParts.length === 4 && ipParts.every((n) => !isNaN(n))) {
        const [a, b] = ipParts;
        if (
          a === 10 || // 10.0.0.0/8
          (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
          (a === 192 && b === 168) || // 192.168.0.0/16
          (a === 169 && b === 254) // 169.254.0.0/16 (link-local / cloud metadata)
        ) {
          throw new BadRequestException('URLs pointing to private networks are not allowed');
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid URL format');
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<{ ok: boolean; status: number; errorText: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, status: response.status, errorText };
      }
      return { ok: true, status: response.status, errorText: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, status: 0, errorText: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractUsage(data: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } | null) {
    if (!data?.usage) {
      return null;
    }
    return {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    };
  }

  private computeCost(
    config: { prices: Record<string, { priceIn?: number; priceOut?: number }>; model?: string },
    promptTokens?: number,
    completionTokens?: number,
  ) {
    const model = config.model || '';
    const pricing = config.prices[model];
    if (!pricing) {
      return undefined;
    }
    const inCost = pricing.priceIn ? (promptTokens || 0) / 1000 * pricing.priceIn : 0;
    const outCost = pricing.priceOut ? (completionTokens || 0) / 1000 * pricing.priceOut : 0;
    const total = inCost + outCost;
    return Number.isFinite(total) ? total : undefined;
  }

  private safeJson(payload: string) {
    try {
      return JSON.parse(payload) as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    } catch {
      return null;
    }
  }

  private sanitizeProviders(providers: LlmProviderConfig[]) {
    return providers.map((provider) => ({
      ...provider,
      apiKey: undefined,
      apiKeySet: Boolean(provider.apiKey),
    }));
  }

  private applyTextUpdate<T extends Record<string, unknown>>(
    target: T,
    key: keyof T,
    value?: string,
  ) {
    if (value === undefined) {
      return;
    }
    const trimmed = value.trim();
    if (trimmed) {
      target[key] = trimmed as T[keyof T];
    } else {
      delete target[key];
    }
  }

  private stripUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }

  private async storeHealthStatus(target: 'llm' | 'ocr', status: HealthStatus) {
    try {
      await this.systemConfigService.setValue(`health:${target}`, status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to store ${target} health status: ${message}`);
    }
  }
}
