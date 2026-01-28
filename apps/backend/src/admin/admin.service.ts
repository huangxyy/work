import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
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
  timeoutMs?: number;
};

type OcrConfig = {
  baseUrl?: string;
  timeoutMs?: number;
};

type BudgetConfig = {
  enabled?: boolean;
  dailyCallLimit?: number;
  mode?: 'soft' | 'hard';
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async getMetrics() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      usersTotal,
      usersStudents,
      usersTeachers,
      usersAdmins,
      classesTotal,
      enrollmentsTotal,
      homeworksTotal,
      submissionsTotal,
      submissionsToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.TEACHER } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.class.count(),
      this.prisma.enrollment.count(),
      this.prisma.homework.count(),
      this.prisma.submission.count(),
      this.prisma.submission.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

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

  async listUsers(query: ListUsersQueryDto) {
    const keyword = query.keyword?.trim();
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
      orderBy: { createdAt: 'desc' },
      take: 500,
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
    const [llmConfig, ocrConfig, budgetConfig] = await Promise.all([
      this.systemConfigService.getValue<LlmConfig>('llm'),
      this.systemConfigService.getValue<OcrConfig>('ocr'),
      this.systemConfigService.getValue<BudgetConfig>('budget'),
    ]);

    const resolvedLlm = this.buildLlmConfig(llmConfig);
    const resolvedOcr = this.buildOcrConfig(ocrConfig);
    const resolvedBudget = this.buildBudgetConfig(budgetConfig);

    return {
      llm: resolvedLlm,
      ocr: resolvedOcr,
      budget: resolvedBudget,
    };
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
      if (dto.llm.timeoutMs !== undefined) {
        next.timeoutMs = dto.llm.timeoutMs;
      }

      await this.systemConfigService.setValue('llm', this.stripUndefined(next));
    }

    if (dto.ocr) {
      const existing = (await this.systemConfigService.getValue<OcrConfig>('ocr')) || {};
      const next: OcrConfig = { ...existing, ...dto.ocr };
      this.applyTextUpdate(next, 'baseUrl', dto.ocr.baseUrl);
      if (dto.ocr.timeoutMs !== undefined) {
        next.timeoutMs = dto.ocr.timeoutMs;
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
    const timeoutMs = overrides?.timeoutMs ?? envTimeout;
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
      timeoutMs,
    };
  }

  private buildOcrConfig(overrides: OcrConfig | null) {
    const envBaseUrl = this.configService.get<string>('OCR_BASE_URL') || 'http://localhost:8000';
    const envTimeout = Number(this.configService.get<string>('OCR_TIMEOUT_MS') || '10000');

    const baseUrl = this.normalizeText(overrides?.baseUrl) || envBaseUrl;
    const timeoutMs = overrides?.timeoutMs ?? envTimeout;

    return { baseUrl, timeoutMs };
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
}
