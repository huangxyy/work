import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SystemConfigService } from '../system-config/system-config.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';
import { LlmConfigService } from '../llm/llm-config.service';
import { LlmLogsService } from '../llm/llm-logs.service';
import { QueueService } from '../queue/queue.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { AuditService } from '../common/audit/audit.service';
import { RedisService } from '../common/redis';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  HeadBucketCommand: jest.fn(),
}));

jest.mock('ioredis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  };
  return { __esModule: true, default: jest.fn(() => mockClient), __mockClient: mockClient };
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let configService: any;
  let systemConfigService: any;
  let runtimeConfigService: any;
  let llmConfigService: any;
  let llmLogsService: any;
  let queueService: any;
  let baiduOcrService: any;
  let audit: any;
  let redis: any;

  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin', name: 'Admin' };

  beforeEach(async () => {
    prisma = {
      user: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', account: 'test', name: 'Test', role: Role.STUDENT, isActive: true, createdAt: new Date() }),
        update: jest.fn().mockResolvedValue({ id: 'u1', account: 'test', name: 'Test', role: Role.STUDENT, isActive: true, createdAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({}),
      },
      class: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'c1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      enrollment: {
        count: jest.fn().mockResolvedValue(100),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      homework: { count: jest.fn().mockResolvedValue(20) },
      submission: {
        count: jest.fn().mockResolvedValue(500),
        findUnique: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } }),
      },
      llmCallLog: {
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn(prisma);
        }
        return fn;
      }),
    };

    configService = {
      get: jest.fn().mockReturnValue(''),
    };

    systemConfigService = {
      getValue: jest.fn().mockResolvedValue(null),
      setValue: jest.fn().mockResolvedValue(undefined),
    };

    runtimeConfigService = {
      getStorageRuntimeConfig: jest.fn().mockResolvedValue({ endpoint: '', bucket: '' }),
      getStorageAdminConfig: jest.fn().mockResolvedValue({}),
      getEmailRuntimeConfig: jest.fn().mockResolvedValue({ host: '', user: '' }),
      getEmailAdminConfig: jest.fn().mockResolvedValue({}),
      getRedisRuntimeConfig: jest.fn().mockResolvedValue({ host: 'localhost', port: 6379 }),
      getRedisAdminConfig: jest.fn().mockResolvedValue({}),
    };

    llmConfigService = {
      getProviders: jest.fn().mockResolvedValue([]),
      resolveRuntimeConfigForProvider: jest.fn().mockResolvedValue({
        baseUrl: 'https://api.example.com',
        model: 'gpt-4',
        apiKey: 'key',
        headers: {},
        prices: {},
      }),
    };

    llmLogsService = {
      listLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      clearLogs: jest.fn().mockResolvedValue({ deleted: 0 }),
      logCall: jest.fn().mockResolvedValue(undefined),
    };

    queueService = {
      getQueueMetrics: jest.fn().mockResolvedValue({ counts: {} }),
      retryFailedJobs: jest.fn().mockResolvedValue({ retried: 0 }),
      cleanQueue: jest.fn().mockResolvedValue({ cleaned: 0 }),
      pauseQueue: jest.fn().mockResolvedValue({ paused: true }),
      resumeQueue: jest.fn().mockResolvedValue({ resumed: true }),
    };

    baiduOcrService = {
      recognize: jest.fn().mockResolvedValue({ text: 'OCR result' }),
      testConnection: jest.fn().mockResolvedValue({ ok: true, latencyMs: 50 }),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
      listRecent: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: RuntimeConfigService, useValue: runtimeConfigService },
        { provide: LlmConfigService, useValue: llmConfigService },
        { provide: LlmLogsService, useValue: llmLogsService },
        { provide: QueueService, useValue: queueService },
        { provide: BaiduOcrService, useValue: baiduOcrService },
        { provide: AuditService, useValue: audit },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ─── getMetrics ───

  describe('getMetrics', () => {
    it('should return aggregated metrics', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { role: Role.STUDENT, _count: { _all: 100 } },
        { role: Role.TEACHER, _count: { _all: 10 } },
        { role: Role.ADMIN, _count: { _all: 2 } },
      ]);
      prisma.class.count.mockResolvedValue(5);
      prisma.enrollment.count.mockResolvedValue(100);
      prisma.homework.count.mockResolvedValue(20);
      prisma.submission.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(15);

      const result = await service.getMetrics();

      expect(result.users.total).toBe(112);
      expect(result.users.students).toBe(100);
      expect(result.users.teachers).toBe(10);
      expect(result.users.admins).toBe(2);
      expect(result.classes.total).toBe(5);
      expect(result.submissions.total).toBe(500);
      expect(result.submissions.today).toBe(15);
    });
  });

  // ─── getUsage ───

  describe('getUsage', () => {
    it('should return usage data', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { d: '2025-01-01', status: 'DONE', cnt: BigInt(10) },
      ]);
      prisma.submission.groupBy.mockResolvedValue([]);

      const result = await service.getUsage({ days: 7 });

      expect(result.days).toBe(7);
      expect(result.daily).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  // ─── exportUsersCsv ───

  describe('exportUsersCsv', () => {
    it('should return CSV with BOM header', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', account: 'alice', name: 'Alice', role: 'STUDENT', email: 'a@b.c', phone: '123', isActive: true, createdAt: new Date('2025-01-01') },
      ]);

      const csv = await service.exportUsersCsv();

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('ID,Account,Name');
      expect(csv).toContain('alice');
    });
  });

  // ─── listUsers ───

  describe('listUsers', () => {
    it('should list users with filters', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);

      const result = await service.listUsers({ role: Role.STUDENT, keyword: 'test' });

      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should cap limit at 500', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.listUsers({ limit: 9999 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.take).toBe(500);
    });
  });

  // ─── createUser ───

  describe('createUser', () => {
    it('should create a user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1', account: 'new', name: 'New', role: Role.STUDENT, isActive: true, createdAt: new Date(),
      });

      const result = await service.createUser({
        account: 'new', name: 'New', password: 'pass123',
      });

      expect(result.account).toBe('new');
      expect(audit.log).toHaveBeenCalled();
    });

    it('should throw on duplicate account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUser({ account: 'dup', name: 'Dup', password: 'pass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when account or name is empty', async () => {
      await expect(
        service.createUser({ account: '', name: 'N', password: 'p' }),
      ).rejects.toThrow('账号和姓名不能为空');
    });

    it('should throw when assigning non-student to class', async () => {
      await expect(
        service.createUser({ account: 'a', name: 'N', password: 'p', role: Role.TEACHER, classId: 'c1' }),
      ).rejects.toThrow('创建时只能为学生分配班级');
    });

    it('should create enrollment when classId provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.class.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.user.create.mockResolvedValue({
        id: 'u1', account: 'a', name: 'N', role: Role.STUDENT, isActive: true, createdAt: new Date(),
      });

      await service.createUser({ account: 'a', name: 'N', password: 'p', classId: 'c1' });

      expect(prisma.enrollment.create).toHaveBeenCalled();
    });
  });

  // ─── deleteUser ───

  describe('deleteUser', () => {
    it('should delete user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });

      const result = await service.deleteUser('u1', mockAdmin);

      expect(result.removed).toBe(true);
      expect(audit.log).toHaveBeenCalled();
    });

    it('should throw when deleting self', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: Role.ADMIN });

      await expect(
        service.deleteUser('admin-1', mockAdmin),
      ).rejects.toThrow('无法删除当前用户');
    });

    it('should throw when deleting last admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'other-admin', role: Role.ADMIN });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.deleteUser('other-admin', mockAdmin),
      ).rejects.toThrow('无法删除最后一个管理员');
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteUser('missing', mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateUser ───

  describe('updateUser', () => {
    it('should update user name', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });
      prisma.user.update.mockResolvedValue({
        id: 'u1', account: 'a', name: 'Updated', role: Role.STUDENT, isActive: true, createdAt: new Date(),
      });

      const result = await service.updateUser('u1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when name is empty string', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });

      await expect(
        service.updateUser('u1', { name: '' }),
      ).rejects.toThrow('姓名不能为空');
    });

    it('should disconnect teacher from classes on role change', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.TEACHER });
      prisma.class.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      prisma.user.update.mockResolvedValue({
        id: 'u1', account: 'a', name: 'N', role: Role.STUDENT, isActive: true, createdAt: new Date(),
      });

      await service.updateUser('u1', { role: Role.STUDENT });

      expect(prisma.class.update).toHaveBeenCalledTimes(2);
    });

    it('should remove enrollments on student role change', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });
      prisma.enrollment.deleteMany.mockResolvedValue({ count: 3 });
      prisma.user.update.mockResolvedValue({
        id: 'u1', account: 'a', name: 'N', role: Role.TEACHER, isActive: true, createdAt: new Date(),
      });

      await service.updateUser('u1', { role: Role.TEACHER });

      expect(prisma.enrollment.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'u1' } });
    });

    it('should log audit on role change', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });
      prisma.user.update.mockResolvedValue({
        id: 'u1', account: 'a', name: 'N', role: Role.ADMIN, isActive: true, createdAt: new Date(),
      });

      await service.updateUser('u1', { role: Role.ADMIN });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_CHANGE' }),
      );
    });
  });

  // ─── resetUserPassword ───

  describe('resetUserPassword', () => {
    it('should reset password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      const result = await service.resetUserPassword('u1', { password: 'newpass' });

      expect(result.ok).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_RESET' }));
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetUserPassword('missing', { password: 'p' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listClassSummaries ───

  describe('listClassSummaries', () => {
    it('should return class summaries', async () => {
      prisma.class.findMany.mockResolvedValue([
        {
          id: 'c1', name: 'Class A', grade: '3', createdAt: new Date(),
          teachers: [{ id: 't1', name: 'T', account: 'teacher' }],
          _count: { enrolls: 30, homeworks: 5, teachers: 1 },
        },
      ]);

      const result = await service.listClassSummaries();

      expect(result).toHaveLength(1);
      expect(result[0].studentCount).toBe(30);
    });
  });

  // ─── getSystemConfig ───

  describe('getSystemConfig', () => {
    it('should return merged system config', async () => {
      const result = await service.getSystemConfig();

      expect(result.llm).toBeDefined();
      expect(result.ocr).toBeDefined();
      expect(result.budget).toBeDefined();
      expect(result.health).toBeDefined();
    });
  });

  // ─── queue delegation ───

  describe('queue delegation', () => {
    it('should delegate getQueueMetrics', async () => {
      await service.getQueueMetrics({});
      expect(queueService.getQueueMetrics).toHaveBeenCalled();
    });

    it('should delegate retryFailedQueueJobs', async () => {
      await service.retryFailedQueueJobs(10);
      expect(queueService.retryFailedJobs).toHaveBeenCalledWith(10);
    });

    it('should delegate cleanQueue', async () => {
      await service.cleanQueue({ status: 'failed' });
      expect(queueService.cleanQueue).toHaveBeenCalled();
    });

    it('should delegate pauseQueue', async () => {
      await service.pauseQueue();
      expect(queueService.pauseQueue).toHaveBeenCalled();
    });

    it('should delegate resumeQueue', async () => {
      await service.resumeQueue();
      expect(queueService.resumeQueue).toHaveBeenCalled();
    });
  });

  // ─── getSubmissionDiagnosis ───

  describe('getSubmissionDiagnosis', () => {
    it('should return null for missing submission', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      const result = await service.getSubmissionDiagnosis('missing');

      expect(result).toBeNull();
    });

    it('should return diagnosis data', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's1', status: 'DONE', ocrText: 'text', gradingJson: {}, totalScore: 90,
        errorCode: null, errorMsg: null, teacherComment: null, manualScore: null,
        createdAt: new Date(), updatedAt: new Date(),
        student: { id: 'u1', name: 'A', account: 'a' },
        homework: { id: 'h1', title: 'HW', class: { id: 'c1', name: 'C' } },
        images: [{ id: 'i1', objectKey: 'key.jpg' }],
      });
      prisma.llmCallLog = { findMany: jest.fn().mockResolvedValue([]) };

      const result = await service.getSubmissionDiagnosis('s1');

      expect(result!.id).toBe('s1');
      expect(result!.images).toHaveLength(1);
    });
  });

  // ─── testOcrWithImage ───

  describe('testOcrWithImage', () => {
    it('should return success on OCR recognize', async () => {
      const result = await service.testOcrWithImage(Buffer.from('img'));

      expect(result.ok).toBe(true);
      expect(result.text).toBe('OCR result');
    });

    it('should return error on OCR failure', async () => {
      baiduOcrService.recognize.mockRejectedValue(new Error('OCR failed'));

      const result = await service.testOcrWithImage(Buffer.from('img'));

      expect(result.ok).toBe(false);
      expect(result.error).toBe('OCR failed');
    });
  });

  // ─── testStorageConnection ───

  describe('testStorageConnection', () => {
    it('should return not ok when endpoint not configured', async () => {
      const result = await service.testStorageConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not configured');
    });

    it('should return not ok when credentials missing', async () => {
      runtimeConfigService.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://minio:9000', bucket: 'test', accessKeyId: '', secretAccessKey: '',
      });

      const result = await service.testStorageConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('MINIO_ACCESS_KEY');
    });
  });

  // ─── testEmailConnection ───

  describe('testEmailConnection', () => {
    it('should return not ok when SMTP not configured', async () => {
      const result = await service.testEmailConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not configured');
    });

    it('should return not ok when password missing', async () => {
      runtimeConfigService.getEmailRuntimeConfig.mockResolvedValue({
        host: 'smtp.test.com', user: 'u', password: '',
      });

      const result = await service.testEmailConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('SMTP_PASS');
    });

    it('should return ok when SMTP verify succeeds', async () => {
      runtimeConfigService.getEmailRuntimeConfig.mockResolvedValue({
        host: 'smtp.test.com', port: 587, user: 'u', password: 'p', secure: false,
      });

      const result = await service.testEmailConnection();

      expect(result.ok).toBe(true);
    });
  });

  // ─── testRedisConnection ───

  describe('testRedisConnection', () => {
    it('should return ok on success', async () => {
      const result = await service.testRedisConnection();

      expect(result.ok).toBe(true);
    });
  });

  // ─── getErrorTrends ───

  describe('getErrorTrends', () => {
    it('should return error trends', async () => {
      prisma.submission.groupBy.mockResolvedValue([
        { errorCode: 'OCR_FAIL', _count: 5 },
      ]);
      prisma.submission.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90)  // done
        .mockResolvedValueOnce(10); // failed

      const result = await service.getErrorTrends(7);

      expect(result.total).toBe(100);
      expect(result.done).toBe(90);
      expect(result.failed).toBe(10);
      expect(result.successRate).toBe(90);
    });
  });

  // ─── getSystemInfo ───

  describe('getSystemInfo', () => {
    it('should return system info', async () => {
      prisma.$queryRaw.mockResolvedValue([{ size: '42.50' }]);

      const result = await service.getSystemInfo();

      expect(result.node).toBe(process.version);
      expect(result.platform).toBe(process.platform);
      expect(result.counts).toBeDefined();
      expect(result.dbSizeMb).toBe('42.50');
    });
  });

  // ─── bulkImportUsers ───

  describe('bulkImportUsers', () => {
    it('should import new users', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue({ id: 'u1' });

      const result = await service.bulkImportUsers({
        text: 'alice Alice\nbob Bob',
      });

      expect(result.total).toBe(2);
      expect(result.created).toBe(2);
    });

    it('should throw on empty lines', async () => {
      await expect(
        service.bulkImportUsers({ text: '   \n  ' }),
      ).rejects.toThrow('没有有效的数据行');
    });

    it('should throw when assigning non-student to class', async () => {
      await expect(
        service.bulkImportUsers({ text: 'alice', role: Role.TEACHER, classId: 'c1' }),
      ).rejects.toThrow('批量导入时只能为学生分配班级');
    });

    it('should mark existing accounts', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', account: 'alice' }]);

      const result = await service.bulkImportUsers({ text: 'alice Alice' });

      expect(result.exists).toBe(1);
    });

    it('should skip duplicate accounts in payload', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue({ id: 'u1' });

      const result = await service.bulkImportUsers({
        text: 'alice Alice\nalice Alice2',
      });

      expect(result.created).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  // ─── bulkDisableUsers ───

  describe('bulkDisableUsers', () => {
    it('should disable users', async () => {
      prisma.user.count.mockResolvedValue(0); // no admins to disable
      prisma.user.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkDisableUsers(['u1', 'u2']);

      expect(result.updated).toBe(2);
    });

    it('should throw on empty list', async () => {
      await expect(
        service.bulkDisableUsers([]),
      ).rejects.toThrow('至少需要一个用户ID');
    });

    it('should throw when disabling last admin', async () => {
      prisma.user.count
        .mockResolvedValueOnce(1) // adminsToDisable
        .mockResolvedValueOnce(0); // remainingActiveAdmins

      await expect(
        service.bulkDisableUsers(['admin-2']),
      ).rejects.toThrow('无法禁用最后一个活跃管理员');
    });
  });

  // ─── bulkResetPassword ───

  describe('bulkResetPassword', () => {
    it('should reset passwords', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkResetPassword(['u1', 'u2', 'u3'], 'newpass');

      expect(result.updated).toBe(3);
    });

    it('should throw on empty list', async () => {
      await expect(
        service.bulkResetPassword([], 'pass'),
      ).rejects.toThrow('至少需要一个用户ID');
    });
  });

  // ─── getLlmCostSummary ───

  describe('getLlmCostSummary', () => {
    it('should return cost summary', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.llmCallLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cost: 0.005 },
        _count: { _all: 10 },
      });

      const result = await service.getLlmCostSummary(7);

      expect(result.totalCalls).toBe(10);
      expect(result.totalCost).toBe(0.005);
    });
  });

  // ─── getAuditLogs ───

  describe('getAuditLogs', () => {
    it('should delegate to audit service', async () => {
      await service.getAuditLogs({ limit: 10, offset: 0 });
      expect(audit.listRecent).toHaveBeenCalled();
    });
  });

  // ─── updateSystemConfig ───

  describe('updateSystemConfig', () => {
    it('should update LLM config', async () => {
      const result = await service.updateSystemConfig({ llm: { model: 'gpt-4o' } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('llm', expect.objectContaining({ model: 'gpt-4o' }));
      expect(result).toBeDefined();
    });

    it('should update OCR config', async () => {
      await service.updateSystemConfig({ ocr: { apiKey: 'new-key' } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('ocr', expect.objectContaining({ apiKey: 'new-key' }));
    });

    it('should clear OCR apiKey when empty', async () => {
      await service.updateSystemConfig({ ocr: { apiKey: '' } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('ocr', expect.not.objectContaining({ apiKey: '' }));
    });

    it('should update budget config', async () => {
      await service.updateSystemConfig({ budget: { enabled: true, dailyCallLimit: 100 } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('budget', expect.objectContaining({ enabled: true, dailyCallLimit: 100 }));
    });

    it('should update storage config', async () => {
      await service.updateSystemConfig({ storage: { endpoint: 'http://minio:9000', bucket: 'test' } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('storage', expect.objectContaining({ endpoint: 'http://minio:9000' }));
    });

    it('should update email config', async () => {
      await service.updateSystemConfig({ email: { host: 'smtp.test.com', port: 587 } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('email', expect.objectContaining({ host: 'smtp.test.com', port: 587 }));
    });

    it('should update redis config', async () => {
      await service.updateSystemConfig({ redis: { host: 'redis-host', port: 6380 } });

      expect(systemConfigService.setValue).toHaveBeenCalledWith('redis', expect.objectContaining({ host: 'redis-host', port: 6380 }));
    });

    it('should log audit for config updates', async () => {
      await service.updateSystemConfig({ budget: { enabled: false } });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONFIG_UPDATE' }),
      );
    });
  });

  // ─── testLlmConnection ───

  describe('testLlmConnection', () => {
    it('should return not ok when baseUrl missing', async () => {
      llmConfigService.resolveRuntimeConfigForProvider.mockResolvedValue({ baseUrl: '', model: 'gpt-4' });

      const result = await service.testLlmConnection();

      expect(result.ok).toBe(false);
      expect((result as any).reason).toContain('LLM_BASE_URL');
    });

    it('should return not ok when model missing', async () => {
      llmConfigService.resolveRuntimeConfigForProvider.mockResolvedValue({ baseUrl: 'https://api.test.com', model: '' });

      const result = await service.testLlmConnection();

      expect(result.ok).toBe(false);
      expect((result as any).reason).toContain('LLM_MODEL');
    });
  });

  // ─── testOcrConnection ───

  describe('testOcrConnection', () => {
    it('should delegate to baiduOcrService', async () => {
      const result = await service.testOcrConnection();

      expect(result.ok).toBe(true);
      expect(baiduOcrService.testConnection).toHaveBeenCalled();
    });
  });

  // ─── listLlmLogs / clearLlmLogs ───

  describe('listLlmLogs', () => {
    it('should delegate to llmLogsService', async () => {
      await service.listLlmLogs({ page: 1, pageSize: 20 });
      expect(llmLogsService.listLogs).toHaveBeenCalled();
    });
  });

  describe('clearLlmLogs', () => {
    it('should delegate to llmLogsService', async () => {
      await service.clearLlmLogs({});
      expect(llmLogsService.clearLogs).toHaveBeenCalled();
    });
  });

  // ─── clearUserAuthCache ───

  describe('clearUserAuthCache', () => {
    it('should clear redis cache on delete', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.STUDENT });

      await service.deleteUser('u1', mockAdmin);

      expect(redis.del).toHaveBeenCalledWith('user:auth:u1');
    });
  });
});
