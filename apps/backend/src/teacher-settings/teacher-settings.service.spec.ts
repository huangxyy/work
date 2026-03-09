import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { TeacherSettingsService } from './teacher-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { LlmConfigService } from '../llm/llm-config.service';
import { GradingPolicyService } from '../grading-policy/grading-policy.service';

describe('TeacherSettingsService', () => {
  let service: TeacherSettingsService;
  let prisma: any;
  let configService: any;
  let systemConfigService: any;
  let llmConfigService: any;
  let gradingPolicyService: any;

  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 'teacher1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin1', name: 'Admin' };

  const mockRuntime = {
    providerId: 'provider-1',
    providerName: 'OpenAI',
    model: 'gpt-4',
    cheaperModel: 'gpt-3.5',
    qualityModel: 'gpt-4-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    timeoutMs: 30000,
    responseFormat: 'json',
    stop: null,
    systemPrompt: 'You are a grading assistant.',
  };

  beforeEach(async () => {
    prisma = {
      class: { findFirst: jest.fn() },
      homework: { findFirst: jest.fn(), findMany: jest.fn() },
      submission: { groupBy: jest.fn(), findMany: jest.fn() },
      gradingPolicy: { findMany: jest.fn() },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'LLM_DAILY_CALL_LIMIT') return '400';
        if (key === 'BUDGET_MODE') return 'soft';
        return undefined;
      }),
    };

    systemConfigService = {
      getValue: jest.fn().mockResolvedValue(null),
    };

    llmConfigService = {
      resolveRuntimeConfig: jest.fn().mockResolvedValue(mockRuntime),
    };

    gradingPolicyService = {
      getClassPolicy: jest.fn().mockResolvedValue(null),
      getHomeworkPolicy: jest.fn().mockResolvedValue(null),
      resolvePolicy: jest.fn().mockResolvedValue({ mode: 'cheap', needRewrite: false }),
      upsertClassPolicy: jest.fn().mockResolvedValue({ classId: 'class-1', mode: 'quality', needRewrite: true, updatedAt: new Date() }),
      upsertHomeworkPolicy: jest.fn().mockResolvedValue({ homeworkId: 'hw-1', mode: 'quality', needRewrite: false, updatedAt: new Date() }),
      clearClassPolicy: jest.fn().mockResolvedValue({ deleted: true }),
      clearHomeworkPolicy: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherSettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: LlmConfigService, useValue: llmConfigService },
        { provide: GradingPolicyService, useValue: gradingPolicyService },
      ],
    }).compile();

    service = module.get<TeacherSettingsService>(TeacherSettingsService);
  });

  // ─── getGradingSettings ───

  describe('getGradingSettings', () => {
    it('should return grading settings with provider info and budget', async () => {
      const result = await service.getGradingSettings();

      expect(result.grading.provider.name).toBe('OpenAI');
      expect(result.grading.model).toBe('gpt-4');
      expect(result.grading.cheaperModel).toBe('gpt-3.5');
      expect(result.grading.qualityModel).toBe('gpt-4-turbo');
      expect(result.grading.systemPromptSet).toBe(true);
      expect(result.budget.enabled).toBe(true);
      expect(result.budget.dailyCallLimit).toBe(400);
      expect(result.budget.mode).toBe('soft');
    });

    it('should report systemPromptSet as false when prompt is empty', async () => {
      llmConfigService.resolveRuntimeConfig.mockResolvedValue({
        ...mockRuntime,
        systemPrompt: '  ',
      });

      const result = await service.getGradingSettings();

      expect(result.grading.systemPromptSet).toBe(false);
    });

    it('should apply budget overrides from system config', async () => {
      systemConfigService.getValue.mockResolvedValue({
        enabled: false,
        dailyCallLimit: 100,
        mode: 'hard',
      });

      const result = await service.getGradingSettings();

      expect(result.budget.enabled).toBe(false);
      expect(result.budget.dailyCallLimit).toBe(100);
      expect(result.budget.mode).toBe('hard');
    });

    it('should use env defaults when budget config is null', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'LLM_DAILY_CALL_LIMIT') return '0';
        if (key === 'BUDGET_MODE') return 'hard';
        return undefined;
      });

      const result = await service.getGradingSettings();

      expect(result.budget.enabled).toBe(false);
      expect(result.budget.dailyCallLimit).toBe(0);
      expect(result.budget.mode).toBe('hard');
    });

    it('should default budget mode to soft for unknown env values', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'BUDGET_MODE') return 'unknown';
        if (key === 'LLM_DAILY_CALL_LIMIT') return '400';
        return undefined;
      });

      const result = await service.getGradingSettings();

      expect(result.budget.mode).toBe('soft');
    });

    it('should handle missing provider and model fields', async () => {
      llmConfigService.resolveRuntimeConfig.mockResolvedValue({
        ...mockRuntime,
        providerId: null,
        model: null,
        cheaperModel: null,
        qualityModel: null,
        systemPrompt: null,
      });

      const result = await service.getGradingSettings();

      expect(result.grading.provider.id).toBeUndefined();
      expect(result.grading.model).toBeUndefined();
      expect(result.grading.systemPromptSet).toBe(false);
    });
  });

  // ─── getPolicySummary ───

  describe('getPolicySummary', () => {
    it('should throw BadRequestException when no classId or homeworkId provided', async () => {
      await expect(service.getPolicySummary({}, mockTeacher)).rejects.toThrow(BadRequestException);
    });

    it('should return null policies when none exist', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      const result = await service.getPolicySummary({ classId: 'class-1' }, mockTeacher);

      expect(result.classPolicy).toBeNull();
      expect(result.homeworkPolicy).toBeNull();
      expect(result.effective).toEqual({ mode: 'cheap', needRewrite: false });
    });

    it('should format class and homework policies when they exist', async () => {
      const now = new Date();
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', classId: 'class-1' });
      gradingPolicyService.getClassPolicy.mockResolvedValue({
        classId: 'class-1',
        mode: 'quality',
        needRewrite: true,
        updatedAt: now,
      });
      gradingPolicyService.getHomeworkPolicy.mockResolvedValue({
        homeworkId: 'hw-1',
        mode: 'cheap',
        needRewrite: false,
        updatedAt: now,
      });

      const result = await service.getPolicySummary(
        { classId: 'class-1', homeworkId: 'hw-1' },
        mockTeacher,
      );

      expect(result.classPolicy!.mode).toBe('quality');
      expect(result.homeworkPolicy!.mode).toBe('cheap');
    });

    it('should skip class access check when homework access already verified', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', classId: 'class-1' });

      await service.getPolicySummary({ homeworkId: 'hw-1' }, mockTeacher);

      expect(prisma.class.findFirst).not.toHaveBeenCalled();
    });

    it('should check class access when only classId is provided', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      await service.getPolicySummary({ classId: 'class-1' }, mockTeacher);

      expect(prisma.class.findFirst).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when teacher has no class access', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.getPolicySummary({ classId: 'class-1' }, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when homework not found', async () => {
      prisma.homework.findFirst.mockResolvedValue(null);

      await expect(
        service.getPolicySummary({ homeworkId: 'missing' }, mockTeacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow admin access without class check', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      await service.getPolicySummary({ classId: 'class-1' }, mockAdmin);

      expect(prisma.class.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── getPolicyPreview ───

  describe('getPolicyPreview', () => {
    it('should throw BadRequestException when classId is missing', async () => {
      await expect(service.getPolicyPreview({}, mockTeacher)).rejects.toThrow(BadRequestException);
    });

    it('should return preview with homework items and resolved policies', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'Essay', dueAt: now, createdAt: now },
        { id: 'hw-2', title: 'Quiz', dueAt: null, createdAt: now },
      ]);
      prisma.gradingPolicy.findMany.mockResolvedValue([
        { homeworkId: 'hw-1', mode: 'quality', needRewrite: true, updatedAt: now },
      ]);
      prisma.submission.groupBy.mockResolvedValue([
        { homeworkId: 'hw-1', _count: { _all: 5 } },
      ]);
      prisma.submission.findMany.mockResolvedValue([
        { homeworkId: 'hw-1', status: 'DONE', updatedAt: now },
        { homeworkId: 'hw-2', status: 'FAILED', updatedAt: now },
      ]);

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      expect(result.classId).toBe('class-1');
      expect(result.classPolicy).toBeNull();
      expect(result.items).toHaveLength(2);

      const hw1 = result.items.find((i: any) => i.homeworkId === 'hw-1')!;
      expect(hw1.submissionCount).toBe(5);
      expect(hw1.lastStatus).toBe('DONE');
      expect(hw1.source.mode).toBe('homework');

      const hw2 = result.items.find((i: any) => i.homeworkId === 'hw-2')!;
      expect(hw2.submissionCount).toBe(0);
      expect(hw2.dueAt).toBeNull();
      expect(hw2.lastStatus).toBe('FAILED');
    });

    it('should handle empty homeworks list', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([]);
      prisma.gradingPolicy.findMany.mockResolvedValue([]);

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      expect(result.items).toEqual([]);
    });

    it('should return class policy when it exists', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([]);
      prisma.gradingPolicy.findMany.mockResolvedValue([]);
      gradingPolicyService.getClassPolicy.mockResolvedValue({
        classId: 'class-1',
        mode: 'quality',
        needRewrite: false,
        updatedAt: now,
      });

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      expect(result.classPolicy!.mode).toBe('quality');
    });
  });

  // ─── upsertClassPolicy ───

  describe('upsertClassPolicy', () => {
    it('should upsert class policy with valid input', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      const result = await service.upsertClassPolicy(
        'class-1',
        { mode: 'quality', needRewrite: true },
        mockTeacher,
      );

      expect(gradingPolicyService.upsertClassPolicy).toHaveBeenCalledWith('class-1', {
        mode: 'quality',
        needRewrite: true,
      });
    });

    it('should throw BadRequestException when no fields to update', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      await expect(
        service.upsertClassPolicy('class-1', {}, mockTeacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for unauthorized teacher', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertClassPolicy('class-1', { mode: 'quality' }, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── upsertHomeworkPolicy ───

  describe('upsertHomeworkPolicy', () => {
    it('should upsert homework policy with valid input', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', classId: 'class-1' });

      await service.upsertHomeworkPolicy('hw-1', { mode: 'quality' }, mockTeacher);

      expect(gradingPolicyService.upsertHomeworkPolicy).toHaveBeenCalledWith('hw-1', {
        mode: 'quality',
      });
    });

    it('should throw BadRequestException when no fields to update', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', classId: 'class-1' });

      await expect(
        service.upsertHomeworkPolicy('hw-1', {}, mockTeacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent homework', async () => {
      prisma.homework.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertHomeworkPolicy('missing', { mode: 'cheap' }, mockTeacher),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── clearClassPolicy / clearHomeworkPolicy ───

  describe('clearClassPolicy', () => {
    it('should clear class policy for authorized teacher', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });

      const result = await service.clearClassPolicy('class-1', mockTeacher);

      expect(gradingPolicyService.clearClassPolicy).toHaveBeenCalledWith('class-1');
    });
  });

  describe('clearHomeworkPolicy', () => {
    it('should clear homework policy for authorized teacher', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', classId: 'class-1' });

      const result = await service.clearHomeworkPolicy('hw-1', mockTeacher);

      expect(gradingPolicyService.clearHomeworkPolicy).toHaveBeenCalledWith('hw-1');
    });
  });

  // ─── resolveEffectiveWithSource ───

  describe('resolveEffectiveWithSource (via getPolicyPreview)', () => {
    it('should cascade: homework overrides class overrides default', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW1', dueAt: null, createdAt: now },
      ]);
      prisma.gradingPolicy.findMany.mockResolvedValue([
        { homeworkId: 'hw-1', mode: 'quality', needRewrite: true, updatedAt: now },
      ]);
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);
      gradingPolicyService.getClassPolicy.mockResolvedValue({
        classId: 'class-1',
        mode: 'cheap',
        needRewrite: false,
        updatedAt: now,
      });

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      const item = result.items[0];
      expect(item.effective.mode).toBe('quality');
      expect(item.source.mode).toBe('homework');
      expect(item.effective.needRewrite).toBe(true);
      expect(item.source.needRewrite).toBe('homework');
    });

    it('should use class policy when homework has no override', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW1', dueAt: null, createdAt: now },
      ]);
      prisma.gradingPolicy.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);
      gradingPolicyService.getClassPolicy.mockResolvedValue({
        classId: 'class-1',
        mode: 'quality',
        needRewrite: true,
        updatedAt: now,
      });

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      const item = result.items[0];
      expect(item.effective.mode).toBe('quality');
      expect(item.source.mode).toBe('class');
      expect(item.effective.needRewrite).toBe(true);
      expect(item.source.needRewrite).toBe('class');
    });

    it('should use defaults when no policies exist', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW1', dueAt: null, createdAt: now },
      ]);
      prisma.gradingPolicy.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      const item = result.items[0];
      expect(item.effective.mode).toBe('cheap');
      expect(item.source.mode).toBe('default');
      expect(item.effective.needRewrite).toBe(false);
      expect(item.source.needRewrite).toBe('default');
    });
  });

  // ─── normalizeMode ───

  describe('normalizeMode (indirect)', () => {
    it('should ignore invalid mode values and fall back to default', async () => {
      const now = new Date();
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW', dueAt: null, createdAt: now },
      ]);
      prisma.gradingPolicy.findMany.mockResolvedValue([
        { homeworkId: 'hw-1', mode: 'invalid_mode', needRewrite: null, updatedAt: now },
      ]);
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);

      const result = await service.getPolicyPreview({ classId: 'class-1' }, mockTeacher);

      expect(result.items[0].effective.mode).toBe('cheap');
      expect(result.items[0].source.mode).toBe('default');
    });
  });
});
