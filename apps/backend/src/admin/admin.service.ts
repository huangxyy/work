import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { LlmConfigService, type LlmProviderConfig } from '../llm/llm-config.service';
import { LlmLogsService } from '../llm/llm-logs.service';
import { QueueService } from '../queue/queue.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { AuditService } from '../common/audit/audit.service';
import { RedisService } from '../common/redis';
import { AdminUsageQueryDto } from './dto/admin-usage-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { BulkImportUsersDto } from './dto/bulk-import-users.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

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
    private readonly runtimeConfigService: RuntimeConfigService,
    private readonly llmConfigService: LlmConfigService,
    private readonly llmLogsService: LlmLogsService,
    private readonly queueService: QueueService,
    private readonly baiduOcrService: BaiduOcrService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async getMetrics() {
    const startedAt = Date.now();
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

    this.logger.debug(
      `Admin metrics fetched users=${usersTotal} classes=${classesTotal} submissions=${submissionsTotal} today=${submissionsToday} durationMs=${Date.now() - startedAt}`,
    );

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
    const startedAt = Date.now();
    const days = query.days ?? 7;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const where = { createdAt: { gte: start } };

    const [statusByDate, errorGroups] = await Promise.all([
      this.prisma.$queryRaw<Array<{ d: string; status: string; cnt: bigint }>>`
        SELECT DATE(createdAt) AS d, status, COUNT(*) AS cnt
        FROM Submission
        WHERE createdAt >= ${start}
        GROUP BY d, status
        ORDER BY d
      `,
      this.prisma.submission.groupBy({
        by: ['errorCode'],
        where: { ...where, errorCode: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { errorCode: 'desc' } },
        take: 10,
      }),
    ]);

    const dailyMap = new Map<
      string,
      { date: string; total: number; done: number; failed: number; queued: number; processing: number }
    >();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start.getTime());
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, total: 0, done: 0, failed: 0, queued: 0, processing: 0 });
    }

    const summary = { total: 0, done: 0, failed: 0, queued: 0, processing: 0 };
    for (const row of statusByDate) {
      const key = typeof row.d === 'string' ? row.d.slice(0, 10) : new Date(row.d).toISOString().slice(0, 10);
      const count = Number(row.cnt);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.total += count;
        const statusKey = row.status.toLowerCase() as keyof typeof summary;
        if (statusKey in entry) {
          entry[statusKey] += count;
        }
      }
      summary.total += count;
      const sKey = row.status.toLowerCase() as keyof typeof summary;
      if (sKey in summary) {
        summary[sKey] += count;
      }
    }

    const daily = Array.from(dailyMap.values());
    const errors = errorGroups.map((g) => ({
      code: g.errorCode!,
      count: g._count._all,
    }));

    this.logger.debug(
      `Admin usage fetched days=${days} dailyPoints=${daily.length} errorGroups=${errors.length} total=${summary.total} durationMs=${Date.now() - startedAt}`,
    );

    return { days, summary, daily, errors, updatedAt: new Date().toISOString() };
  }

  async exportUsersCsv() {
    const startedAt = Date.now();
    const users = await this.prisma.user.findMany({
      select: { id: true, account: true, name: true, role: true, email: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const header = 'ID,Account,Name,Role,Email,Phone,Active,Created\n';
    const rows = users.map(u =>
      `${u.id},${u.account},"${u.name}",${u.role},${u.email || ''},${u.phone || ''},${u.isActive},${u.createdAt.toISOString()}`
    ).join('\n');

    const csv = '\uFEFF' + header + rows;
    this.logger.log(
      `Admin users CSV exported users=${users.length} bytes=${Buffer.byteLength(csv, 'utf8')} durationMs=${Date.now() - startedAt}`,
    );

    return csv;
  }

  async listUsers(query: ListUsersQueryDto) {
    const startedAt = Date.now();
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

    const users = await this.prisma.user.findMany({
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

    this.logger.debug(
      `Admin users listed returned=${users.length} role=${query.role || 'all'} keyword=${keyword || 'none'} limit=${take} cursor=${query.cursor || 'none'} durationMs=${Date.now() - startedAt}`,
    );

    return users;
  }

  async createUser(dto: CreateAdminUserDto) {
    const account = dto.account.trim();
    const name = dto.name.trim();
    const role = dto.role ?? Role.STUDENT;
    const classId = dto.classId?.trim();

    if (!account || !name) {
      throw new BadRequestException('账号和姓名不能为空');
    }

    if (classId && role !== Role.STUDENT) {
      throw new BadRequestException('创建时只能为学生分配班级');
    }

    const existing = await this.prisma.user.findUnique({ where: { account } });
    if (existing) {
      throw new BadRequestException('账号已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      if (classId) {
        const klass = await tx.class.findUnique({ where: { id: classId }, select: { id: true } });
        if (!klass) {
          throw new BadRequestException('班级不存在');
        }
      }

      const created = await tx.user.create({
        data: {
          account,
          name,
          role,
          passwordHash,
          isActive: true,
        },
      });

      if (classId) {
        await tx.enrollment.create({
          data: {
            classId,
            studentId: created.id,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      action: 'USER_CREATE',
      targetId: user.id,
      detail: `Created user account=${account} role=${role}`,
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

  async deleteUser(id: string, currentUser: AuthUser) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    if (existing.id === currentUser.id) {
      throw new BadRequestException('无法删除当前用户');
    }

    if (existing.role === Role.ADMIN) {
      const otherAdminCount = await this.prisma.user.count({
        where: {
          role: Role.ADMIN,
          NOT: { id },
        },
      });
      if (otherAdminCount === 0) {
        throw new BadRequestException('无法删除最后一个管理员');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.deleteMany({ where: { studentId: id } });
      await tx.user.delete({ where: { id } });
    });

    await this.audit.log({
      action: 'USER_DELETE',
      userId: currentUser.id,
      targetId: id,
      detail: `Deleted user role=${existing.role}`,
    });

    await this.clearUserAuthCache([id]);

    return { id, removed: true };
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException('姓名不能为空');
    }

    // When changing role away from TEACHER, disconnect from all classes to avoid
    // orphaned teacher-class associations that would grant unauthorized access.
    if (dto.role !== undefined && dto.role !== Role.TEACHER && existing.role === Role.TEACHER) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { teachers: { some: { id } } },
        select: { id: true },
      });
      await Promise.all(
        teacherClasses.map((klass) =>
          this.prisma.class.update({
            where: { id: klass.id },
            data: { teachers: { disconnect: { id } } },
          }),
        ),
      );
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

    if (dto.role !== undefined && dto.role !== existing.role) {
      await this.audit.log({
        action: 'ROLE_CHANGE',
        targetId: id,
        detail: `Role changed from ${existing.role} to ${dto.role}`,
      });
    }

    await this.clearUserAuthCache([id]);

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
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.audit.log({
      action: 'PASSWORD_RESET',
      targetId: id,
    });

    await this.clearUserAuthCache([id]);

    return { id, ok: true };
  }

  async listClassSummaries() {
    const startedAt = Date.now();
    const classes = await this.prisma.class.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        createdAt: true,
        teachers: { select: { id: true, name: true, account: true } },
        _count: { select: { enrolls: true, homeworks: true, teachers: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    this.logger.debug(
      `Admin class summaries listed returned=${classes.length} durationMs=${Date.now() - startedAt}`,
    );

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
    const startedAt = Date.now();
    const [llmConfig, ocrConfig, budgetConfig, llmHealth, ocrHealth, llmProviders, storage, email, redis] = await Promise.all([
      this.systemConfigService.getValue<LlmConfig>('llm'),
      this.systemConfigService.getValue<OcrConfig>('ocr'),
      this.systemConfigService.getValue<BudgetConfig>('budget'),
      this.systemConfigService.getValue<HealthStatus>('health:llm'),
      this.systemConfigService.getValue<HealthStatus>('health:ocr'),
      this.llmConfigService.getProviders(),
      this.runtimeConfigService.getStorageAdminConfig(),
      this.runtimeConfigService.getEmailAdminConfig(),
      this.runtimeConfigService.getRedisAdminConfig(),
    ]);

    const resolvedLlm = this.buildLlmConfig(llmConfig);
    const resolvedOcr = this.buildOcrConfig(ocrConfig);
    const resolvedBudget = this.buildBudgetConfig(budgetConfig);

    this.logger.debug(
      `Admin system config fetched providers=${llmProviders.length} llmHealthSet=${Boolean(llmHealth)} ocrHealthSet=${Boolean(ocrHealth)} durationMs=${Date.now() - startedAt}`,
    );

    return {
      llm: resolvedLlm,
      llmProviders: this.sanitizeProviders(llmProviders),
      ocr: resolvedOcr,
      budget: resolvedBudget,
      storage,
      email,
      redis,
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

  async getFeatureFlags() {
    return this.systemConfigService.getFeatureFlags();
  }

  async updateFeatureFlag(flag: string, enabled: boolean) {
    const normalizedFlag = this.normalizeText(flag);
    if (!normalizedFlag) {
      throw new BadRequestException('标志值不能为空');
    }

    const result = await this.systemConfigService.setFeatureFlag(normalizedFlag, enabled);
    await this.audit.log({
      action: 'CONFIG_UPDATE',
      targetId: normalizedFlag,
      detail: `Updated feature flag ${normalizedFlag}=${enabled}`,
    });
    return result;
  }

  async getSubmissionDiagnosis(submissionId: string) {
    const startedAt = Date.now();
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        images: true,
        student: { select: { id: true, name: true, account: true } },
        homework: { select: { id: true, title: true, class: { select: { id: true, name: true } } } },
      },
    });
    if (!submission) {
      this.logger.debug(`Admin submission diagnosis miss submissionId=${submissionId} durationMs=${Date.now() - startedAt}`);
      return null;
    }

    const llmLogs = await this.prisma.llmCallLog.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    this.logger.debug(
      `Admin submission diagnosis fetched submissionId=${submissionId} images=${submission.images.length} llmLogs=${llmLogs.length} durationMs=${Date.now() - startedAt}`,
    );

    return {
      id: submission.id,
      status: submission.status,
      student: submission.student,
      homework: submission.homework,
      images: submission.images.map(img => ({ id: img.id, objectKey: img.objectKey })),
      ocrText: submission.ocrText,
      gradingJson: submission.gradingJson,
      totalScore: submission.totalScore,
      errorCode: submission.errorCode,
      errorMsg: submission.errorMsg,
      teacherComment: submission.teacherComment,
      manualScore: submission.manualScore,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      llmLogs,
    };
  }

  async testOcrWithImage(imageBuffer: Buffer) {
    const startedAt = Date.now();
    try {
      const ocrConfig = await this.systemConfigService.getValue<OcrConfig>('ocr');
      const apiKey = this.normalizeText(ocrConfig?.apiKey) ||
        this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
      const secretKey = this.normalizeText(ocrConfig?.secretKey) ||
        this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';
      const config: Partial<{ apiKey: string; secretKey: string }> = {};
      if (apiKey) config.apiKey = apiKey;
      if (secretKey) config.secretKey = secretKey;

      const result = await this.baiduOcrService.recognize(imageBuffer, config);
      this.logger.debug(`Admin OCR test completed textLength=${result.text.length} durationMs=${Date.now() - startedAt}`);
      return { ok: true, text: result.text, length: result.text.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Admin OCR test failed durationMs=${Date.now() - startedAt}: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  async testStorageConnection() {
    const startedAt = Date.now();
    const config = await this.runtimeConfigService.getStorageRuntimeConfig();
    if (!config.endpoint || !config.bucket) {
      return { ok: false, latencyMs: Date.now() - startedAt, reason: 'Storage endpoint/bucket is not configured' };
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
      return { ok: false, latencyMs: Date.now() - startedAt, reason: 'MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be configured in env' };
    }
    const client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    try {
      await Promise.race([
        client.send(new HeadBucketCommand({ Bucket: config.bucket })),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Storage test timed out')), 5000)),
      ]);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown storage error';
      return { ok: false, latencyMs: Date.now() - startedAt, reason };
    }
  }

  async testEmailConnection() {
    const startedAt = Date.now();
    const config = await this.runtimeConfigService.getEmailRuntimeConfig();
    if (!config.host || !config.user) {
      return { ok: false, latencyMs: Date.now() - startedAt, reason: 'SMTP host/user is not configured' };
    }
    if (!config.password) {
      return { ok: false, latencyMs: Date.now() - startedAt, reason: 'SMTP_PASS must be configured in env' };
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
    try {
      await transporter.verify();
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown SMTP error';
      return { ok: false, latencyMs: Date.now() - startedAt, reason };
    }
  }

  async testRedisConnection() {
    const startedAt = Date.now();
    const options = await this.runtimeConfigService.getRedisRuntimeConfig();
    const client = new Redis({
      ...options,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      await client.ping();
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Redis error';
      return { ok: false, latencyMs: Date.now() - startedAt, reason };
    } finally {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  }

  async getErrorTrends(days: number) {
    const safeDays = this.clampDays(days);
    const startedAt = Date.now();
    const since = new Date();
    since.setDate(since.getDate() - safeDays);

    const [failures, total, done, failed] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ['errorCode'],
        where: { status: 'FAILED', updatedAt: { gte: since }, errorCode: { not: null } },
        _count: true,
        orderBy: { _count: { errorCode: 'desc' } },
      }),
      this.prisma.submission.count({ where: { updatedAt: { gte: since } } }),
      this.prisma.submission.count({ where: { status: 'DONE', updatedAt: { gte: since } } }),
      this.prisma.submission.count({ where: { status: 'FAILED', updatedAt: { gte: since } } }),
    ]);

    this.logger.debug(
      `Admin error trends fetched days=${safeDays} total=${total} done=${done} failed=${failed} errorGroups=${failures.length} durationMs=${Date.now() - startedAt}`,
    );

    return {
      total,
      done,
      failed,
      successRate: total > 0 ? Number(((done / total) * 100).toFixed(1)) : 0,
      errorBreakdown: failures.map((f) => ({
        errorCode: f.errorCode || 'UNKNOWN',
        count: f._count,
      })),
    };
  }

  async getSystemInfo() {
    const startedAt = Date.now();
    const [userCount, submissionCount, classCount, homeworkCount, dbSize] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.submission.count(),
      this.prisma.class.count(),
      this.prisma.homework.count(),
      this.prisma.$queryRaw<Array<{ size: string }>>`
        SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size
        FROM information_schema.tables WHERE table_schema = DATABASE()
      `,
    ]);

    this.logger.debug(
      `Admin system info fetched users=${userCount} submissions=${submissionCount} classes=${classCount} homeworks=${homeworkCount} dbSizeMb=${dbSize[0]?.size || '0'} durationMs=${Date.now() - startedAt}`,
    );

    return {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.floor(process.uptime()),
      memoryUsage: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      counts: { users: userCount, submissions: submissionCount, classes: classCount, homeworks: homeworkCount },
      dbSizeMb: dbSize[0]?.size || '0',
      env: process.env.NODE_ENV || 'development',
    };
  }

  async bulkImportUsers(dto: BulkImportUsersDto) {
    const startedAt = Date.now();
    const lines = dto.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new BadRequestException('没有有效的数据行');
    }

    const role = dto.role ?? Role.STUDENT;
    const classId = this.normalizeText(dto.classId) || undefined;
    if (classId && role !== Role.STUDENT) {
      throw new BadRequestException('批量导入时只能为学生分配班级');
    }

    if (classId) {
      const klass = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
      if (!klass) {
        throw new BadRequestException('班级不存在');
      }
    }

    const defaultPwd = dto.defaultPassword || 'Abc123456';
    const passwordHash = await bcrypt.hash(defaultPwd, 10);

    const parsedEntries = lines.map((line) => {
      const parts = line.split(/[\t,\s]+/).filter(Boolean);
      const account = this.normalizeText(parts[0]);
      const name = this.normalizeText(parts.slice(1).join(' ')) || account;
      return { account, name };
    });

    const accounts = Array.from(new Set(parsedEntries.map((entry) => entry.account).filter(Boolean)));
    const existingUsers = accounts.length
      ? await this.prisma.user.findMany({
          where: { account: { in: accounts } },
          select: { id: true, account: true },
        })
      : [];
    const existingUserMap = new Map(existingUsers.map((user) => [user.account, user]));
    const enrolledStudentIds = new Set<string>();

    if (classId && role === Role.STUDENT && existingUsers.length > 0) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId, studentId: { in: existingUsers.map((user) => user.id) } },
        select: { studentId: true },
      });
      for (const enrollment of enrollments) {
        enrolledStudentIds.add(enrollment.studentId);
      }
    }

    const seenAccounts = new Set<string>();
    type BulkImportResult = {
      account: string;
      name: string;
      status: 'created' | 'exists' | 'error';
      error?: string;
    };
    const results: Array<BulkImportResult | null> = new Array(parsedEntries.length).fill(null);
    const processableEntries: Array<{ index: number; account: string; name: string }> = [];

    parsedEntries.forEach((entry, index) => {
      const { account, name } = entry;

      if (!account) {
        results[index] = { account: '', name: '', status: 'error', error: 'Empty line' };
        return;
      }

      if (seenAccounts.has(account)) {
        results[index] = { account, name, status: 'error', error: 'Duplicate account in payload' };
        return;
      }

      seenAccounts.add(account);
      processableEntries.push({ index, account, name });
    });

    const IMPORT_CONCURRENCY = 10;
    for (let index = 0; index < processableEntries.length; index += IMPORT_CONCURRENCY) {
      const chunk = processableEntries.slice(index, index + IMPORT_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (entry) => {
          const { account, name } = entry;

          try {
            const existing = existingUserMap.get(account);
            if (existing) {
              if (classId && role === Role.STUDENT && !enrolledStudentIds.has(existing.id)) {
                await this.prisma.enrollment.create({
                  data: { studentId: existing.id, classId },
                });
                enrolledStudentIds.add(existing.id);
              }

              return {
                index: entry.index,
                result: { account, name, status: 'exists' } as BulkImportResult,
              };
            }

            const user = await this.prisma.user.create({
              data: { account, name, role, passwordHash, isActive: true },
            });

            if (classId && role === Role.STUDENT) {
              await this.prisma.enrollment.create({
                data: { studentId: user.id, classId },
              });
              enrolledStudentIds.add(user.id);
            }

            return {
              index: entry.index,
              result: { account, name, status: 'created' } as BulkImportResult,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
              index: entry.index,
              result: { account, name, status: 'error', error: message } as BulkImportResult,
            };
          }
        }),
      );

      chunkResults.forEach(({ index: resultIndex, result }) => {
        results[resultIndex] = result;
      });
    }

    const finalizedResults = results.filter((result): result is BulkImportResult => result !== null);

    const created = finalizedResults.filter((result) => result.status === 'created').length;
    const exists = finalizedResults.filter((result) => result.status === 'exists').length;
    const errors = finalizedResults.filter((result) => result.status === 'error').length;

    this.logger.log(
      `Admin bulk import completed total=${lines.length} processable=${processableEntries.length} created=${created} exists=${exists} errors=${errors} role=${role}${classId ? ` classId=${classId}` : ''} durationMs=${Date.now() - startedAt}`,
    );

    await this.audit.log({
      action: 'USER_CREATE',
      detail: `Bulk imported ${created} users (${exists} existing, ${errors} errors) role=${role}${classId ? ` classId=${classId}` : ''}`,
    });

    return { total: lines.length, created, exists, errors, results: finalizedResults };
  }

  async getLlmCostSummary(days: number) {
    const safeDays = this.clampDays(days);
    const startedAt = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const [dailyStats, totals] = await Promise.all([
      this.prisma.$queryRaw<Array<{ d: string; calls: bigint; tokens: bigint; totalCost: number }>>`
        SELECT DATE(createdAt) AS d,
               COUNT(*) AS calls,
               COALESCE(SUM(totalTokens), 0) AS tokens,
               COALESCE(SUM(cost), 0) AS totalCost
        FROM LlmCallLog
        WHERE createdAt >= ${start}
        GROUP BY d
        ORDER BY d
      `,
      this.prisma.llmCallLog.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cost: true },
        _count: { _all: true },
      }),
    ]);

    const daily = dailyStats.map((row) => ({
      date: typeof row.d === 'string' ? row.d.slice(0, 10) : new Date(row.d).toISOString().slice(0, 10),
      calls: Number(row.calls),
      tokens: Number(row.tokens),
      cost: Number(row.totalCost),
    }));

    this.logger.debug(
      `Admin llm cost summary fetched days=${safeDays} totalCalls=${totals._count._all} dailyPoints=${daily.length} totalCost=${Number((totals._sum.cost || 0).toFixed(6))} durationMs=${Date.now() - startedAt}`,
    );

    return {
      days: safeDays,
      totalCalls: totals._count._all,
      totalPromptTokens: totals._sum.promptTokens || 0,
      totalCompletionTokens: totals._sum.completionTokens || 0,
      totalTokens: totals._sum.totalTokens || 0,
      totalCost: Number((totals._sum.cost || 0).toFixed(6)),
      avgCostPerCall: totals._count._all > 0
        ? Number(((totals._sum.cost || 0) / totals._count._all).toFixed(6))
        : 0,
      daily,
    };
  }

  async bulkDisableUsers(userIds: string[]) {
    const startedAt = Date.now();
    const normalizedUserIds = this.normalizeUserIds(userIds);
    if (!normalizedUserIds.length) {
      throw new BadRequestException('至少需要一个用户ID');
    }

    const adminsToDisable = await this.prisma.user.count({
      where: { id: { in: normalizedUserIds }, role: Role.ADMIN, isActive: true },
    });
    if (adminsToDisable > 0) {
      const remainingActiveAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, isActive: true, id: { notIn: normalizedUserIds } },
      });
      if (remainingActiveAdmins === 0) {
        throw new BadRequestException('无法禁用最后一个活跃管理员');
      }
    }

    const result = await this.prisma.user.updateMany({
      where: { id: { in: normalizedUserIds } },
      data: { isActive: false },
    });

    await Promise.all([
      this.clearUserAuthCache(normalizedUserIds),
      this.audit.log({
        action: 'USER_DISABLE',
        detail: `Bulk disabled ${result.count} user(s)`,
      }),
    ]);

    this.logger.log(
      `Admin bulk disable completed requested=${normalizedUserIds.length} updated=${result.count} durationMs=${Date.now() - startedAt}`,
    );

    return { requested: normalizedUserIds.length, updated: result.count };
  }

  async bulkResetPassword(userIds: string[], newPassword: string) {
    const startedAt = Date.now();
    const normalizedUserIds = this.normalizeUserIds(userIds);
    if (!normalizedUserIds.length) {
      throw new BadRequestException('至少需要一个用户ID');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const result = await this.prisma.user.updateMany({
      where: { id: { in: normalizedUserIds } },
      data: { passwordHash: hash },
    });

    await Promise.all([
      this.clearUserAuthCache(normalizedUserIds),
      this.audit.log({
        action: 'PASSWORD_RESET',
        detail: `Bulk reset passwords for ${result.count} user(s)`,
      }),
    ]);

    this.logger.log(
      `Admin bulk password reset completed requested=${normalizedUserIds.length} updated=${result.count} durationMs=${Date.now() - startedAt}`,
    );

    return { requested: normalizedUserIds.length, updated: result.count };
  }

  async getAuditLogs(query: AuditLogsQueryDto) {
    return this.audit.listRecent({
      limit: query.limit,
      offset: query.offset,
      action: query.action,
      actions: query.actions,
    });
  }

  async updateSystemConfig(dto: UpdateSystemConfigDto) {
    // Fetch all needed existing configs in parallel
    const [existingLlm, existingProviders, existingOcr, existingBudget, existingStorage, existingEmail, existingRedis] = await Promise.all([
      dto.llm ? this.systemConfigService.getValue<LlmConfig>('llm') : null,
      dto.llmProviders ? this.systemConfigService.getValue<LlmProviderConfig[]>('llmProviders') : null,
      dto.ocr ? this.systemConfigService.getValue<OcrConfig>('ocr') : null,
      dto.budget ? this.systemConfigService.getValue<BudgetConfig>('budget') : null,
      dto.storage ? this.systemConfigService.getValue<StorageConfig>('storage') : null,
      dto.email ? this.systemConfigService.getValue<EmailConfig>('email') : null,
      dto.redis ? this.systemConfigService.getValue<RedisConfig>('redis') : null,
    ]);

    const writes: Promise<void>[] = [];

    if (dto.llm) {
      const next: LlmConfig = { ...(existingLlm || {}), ...dto.llm };

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

      writes.push(this.systemConfigService.setValue('llm', this.stripUndefined(next)));
    }

    if (dto.llmProviders) {
      const existingMap = new Map((existingProviders || []).map((provider) => [provider.id, provider]));

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

      writes.push(this.systemConfigService.setValue('llmProviders', normalized));
    }

    if (dto.ocr) {
      const next: OcrConfig = { ...(existingOcr || {}) };
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
      writes.push(this.systemConfigService.setValue('ocr', this.stripUndefined(next)));
    }

    if (dto.budget) {
      const next: BudgetConfig = { ...(existingBudget || {}), ...dto.budget };
      if (dto.budget.enabled !== undefined) {
        next.enabled = dto.budget.enabled;
      }
      if (dto.budget.dailyCallLimit !== undefined) {
        next.dailyCallLimit = dto.budget.dailyCallLimit;
      }
      if (dto.budget.mode !== undefined) {
        next.mode = dto.budget.mode;
      }
      writes.push(this.systemConfigService.setValue('budget', this.stripUndefined(next)));
    }

    if (dto.storage) {
      const next: StorageConfig = { ...(existingStorage || {}) };
      this.applyTextUpdate(next, 'endpoint', dto.storage.endpoint);
      this.applyTextUpdate(next, 'bucket', dto.storage.bucket);
      this.applyTextUpdate(next, 'region', dto.storage.region);
      writes.push(this.systemConfigService.setValue('storage', this.stripUndefined(next)));
    }

    if (dto.email) {
      const next: EmailConfig = { ...(existingEmail || {}) };
      this.applyTextUpdate(next, 'host', dto.email.host);
      this.applyTextUpdate(next, 'user', dto.email.user);
      this.applyTextUpdate(next, 'from', dto.email.from);
      if (dto.email.port !== undefined) {
        next.port = dto.email.port;
      }
      if (dto.email.secure !== undefined) {
        next.secure = dto.email.secure;
      }
      writes.push(this.systemConfigService.setValue('email', this.stripUndefined(next)));
    }

    if (dto.redis) {
      const next: RedisConfig = { ...(existingRedis || {}) };
      this.applyTextUpdate(next, 'host', dto.redis.host);
      this.applyTextUpdate(next, 'username', dto.redis.username);
      if (dto.redis.port !== undefined) {
        next.port = dto.redis.port;
      }
      if (dto.redis.db !== undefined) {
        next.db = dto.redis.db;
      }
      if (dto.redis.tls !== undefined) {
        next.tls = dto.redis.tls;
      }
      writes.push(this.systemConfigService.setValue('redis', this.stripUndefined(next)));
    }

    await Promise.all(writes);

    const sections = [
      dto.llm && 'llm',
      dto.llmProviders && 'llmProviders',
      dto.ocr && 'ocr',
      dto.budget && 'budget',
      dto.storage && 'storage',
      dto.email && 'email',
      dto.redis && 'redis',
    ].filter(Boolean);
    const changedFields = [
      ...this.collectChangedFields('llm', dto.llm),
      ...this.collectChangedFields('ocr', dto.ocr),
      ...this.collectChangedFields('budget', dto.budget),
      ...this.collectChangedFields('storage', dto.storage),
      ...this.collectChangedFields('email', dto.email),
      ...this.collectChangedFields('redis', dto.redis),
      ...(dto.llmProviders ? ['llmProviders'] : []),
    ];
    await this.audit.log({
      action: 'CONFIG_UPDATE',
      detail: `Updated config sections: ${sections.join(', ')}; fields: ${changedFields.join(', ')}`,
    });

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
      throw new BadRequestException('LLM_BASE_URL 未配置');
    }
    if (!config.model) {
      throw new BadRequestException('LLM_MODEL 未配置');
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
        throw new BadRequestException('不允许使用指向 localhost 的URL');
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
          throw new BadRequestException('不允许使用指向私有网络的URL');
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('URL格式无效');
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

  private normalizeUserIds(userIds: string[]) {
    return Array.from(new Set(userIds.map((entry) => entry.trim()).filter(Boolean)));
  }

  private clampDays(days?: number, fallback = 7) {
    if (typeof days !== 'number' || !Number.isFinite(days)) {
      return fallback;
    }
    return Math.min(Math.max(Math.trunc(days), 1), 30);
  }

  private async clearUserAuthCache(userIds: string[]) {
    const normalizedUserIds = this.normalizeUserIds(userIds);
    if (!normalizedUserIds.length) {
      return;
    }

    const startedAt = Date.now();

    const results = await Promise.allSettled(
      normalizedUserIds.map((id) => this.redis.del(`user:auth:${id}`)),
    );
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      this.logger.warn(`Failed to clear auth cache for ${failedCount} user(s)`);
    }

    this.logger.debug(
      `Cleared auth cache requested=${normalizedUserIds.length} failed=${failedCount} durationMs=${Date.now() - startedAt}`,
    );
  }

  private collectChangedFields(section: string, payload?: object) {
    if (!payload) {
      return [] as string[];
    }
    const secretFields = new Set(['apiKey', 'secretKey', 'clearApiKey', 'clearSecretKey']);
    return Object.keys(payload as Record<string, unknown>)
      .filter((key) => !secretFields.has(key))
      .map((key) => `${section}.${key}`);
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
