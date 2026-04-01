import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { TeacherSettingsController } from './teacher-settings.controller';
import { GradingMode, GradingPreferenceDto } from './dto/grading-preference.dto';
import { GradingPolicyQueryDto } from './dto/grading-policy-query.dto';
import { GradingPolicyUpdateDto } from './dto/grading-policy-update.dto';
import { TeacherSettingsService } from './teacher-settings.service';
import { TeacherPreferenceService } from './teacher-preference.service';

describe('TeacherSettingsController', () => {
  let controller: TeacherSettingsController;
  let teacherSettingsService: {
    getGradingSettings: jest.Mock;
    getPolicySummary: jest.Mock;
    getPolicyPreview: jest.Mock;
    upsertClassPolicy: jest.Mock;
    upsertHomeworkPolicy: jest.Mock;
    clearClassPolicy: jest.Mock;
    clearHomeworkPolicy: jest.Mock;
  };
  let teacherPreferenceService: {
    getGradingPreference: jest.Mock;
    updateGradingPreference: jest.Mock;
  };

  const mockTeacher: AuthUser = {
    id: 'teacher-1',
    account: 'teacher1',
    name: 'Test Teacher',
    role: Role.TEACHER,
  };

  beforeEach(async () => {
    teacherSettingsService = {
      getGradingSettings: jest.fn(),
      getPolicySummary: jest.fn(),
      getPolicyPreview: jest.fn(),
      upsertClassPolicy: jest.fn(),
      upsertHomeworkPolicy: jest.fn(),
      clearClassPolicy: jest.fn(),
      clearHomeworkPolicy: jest.fn(),
    };
    teacherPreferenceService = {
      getGradingPreference: jest.fn(),
      updateGradingPreference: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TeacherSettingsController],
      providers: [
        {
          provide: TeacherSettingsService,
          useValue: teacherSettingsService,
        },
        {
          provide: TeacherPreferenceService,
          useValue: teacherPreferenceService,
        },
      ],
    }).compile();

    controller = moduleRef.get(TeacherSettingsController);
  });

  it('should return grading settings', async () => {
    teacherSettingsService.getGradingSettings.mockResolvedValue({ grading: {}, budget: {} });

    const result = await controller.getGradingSettings();

    expect(result).toEqual({ grading: {}, budget: {} });
    expect(teacherSettingsService.getGradingSettings).toHaveBeenCalledTimes(1);
  });

  it('should return grading preference', async () => {
    teacherPreferenceService.getGradingPreference.mockResolvedValue({ mode: 'cheap' });

    const result = await controller.getGradingPreference({ user: mockTeacher });

    expect(result).toEqual({ mode: 'cheap' });
    expect(teacherPreferenceService.getGradingPreference).toHaveBeenCalledWith(mockTeacher);
  });

  it('should update grading preference', async () => {
    const dto: GradingPreferenceDto = { mode: GradingMode.QUALITY };
    teacherPreferenceService.updateGradingPreference.mockResolvedValue({ mode: GradingMode.QUALITY });

    const result = await controller.updateGradingPreference(dto, { user: mockTeacher });

    expect(result).toEqual({ mode: GradingMode.QUALITY });
    expect(teacherPreferenceService.updateGradingPreference).toHaveBeenCalledWith(mockTeacher, dto);
  });

  it('should forward grading policy summary requests', async () => {
    const query: GradingPolicyQueryDto = { classId: 'class-1', homeworkId: 'homework-1' };
    teacherSettingsService.getPolicySummary.mockResolvedValue({ effective: { mode: 'cheap', needRewrite: false } });

    const result = await controller.getGradingPolicies(query, { user: mockTeacher });

    expect(result).toEqual({ effective: { mode: 'cheap', needRewrite: false } });
    expect(teacherSettingsService.getPolicySummary).toHaveBeenCalledWith(query, mockTeacher);
  });

  it('should forward grading policy preview requests', async () => {
    const query: GradingPolicyQueryDto = { classId: 'class-1' };
    teacherSettingsService.getPolicyPreview.mockResolvedValue({ classId: 'class-1', items: [] });

    const result = await controller.getPolicyPreview(query, { user: mockTeacher });

    expect(result).toEqual({ classId: 'class-1', items: [] });
    expect(teacherSettingsService.getPolicyPreview).toHaveBeenCalledWith(query, mockTeacher);
  });

  it('should forward class policy upserts', async () => {
    const body: GradingPolicyUpdateDto = { mode: 'quality', needRewrite: true };
    teacherSettingsService.upsertClassPolicy.mockResolvedValue({ id: 'policy-1' });

    const result = await controller.upsertClassPolicy('class-1', body, { user: mockTeacher });

    expect(result).toEqual({ id: 'policy-1' });
    expect(teacherSettingsService.upsertClassPolicy).toHaveBeenCalledWith('class-1', body, mockTeacher);
  });

  it('should forward homework policy upserts', async () => {
    const body: GradingPolicyUpdateDto = { mode: 'cheap', needRewrite: false };
    teacherSettingsService.upsertHomeworkPolicy.mockResolvedValue({ id: 'policy-2' });

    const result = await controller.upsertHomeworkPolicy('homework-1', body, { user: mockTeacher });

    expect(result).toEqual({ id: 'policy-2' });
    expect(teacherSettingsService.upsertHomeworkPolicy).toHaveBeenCalledWith('homework-1', body, mockTeacher);
  });

  it('should forward class policy clears', async () => {
    teacherSettingsService.clearClassPolicy.mockResolvedValue({ count: 1 });

    const result = await controller.clearClassPolicy('class-1', { user: mockTeacher });

    expect(result).toEqual({ count: 1 });
    expect(teacherSettingsService.clearClassPolicy).toHaveBeenCalledWith('class-1', mockTeacher);
  });

  it('should forward homework policy clears', async () => {
    teacherSettingsService.clearHomeworkPolicy.mockResolvedValue({ count: 1 });

    const result = await controller.clearHomeworkPolicy('homework-1', { user: mockTeacher });

    expect(result).toEqual({ count: 1 });
    expect(teacherSettingsService.clearHomeworkPolicy).toHaveBeenCalledWith('homework-1', mockTeacher);
  });
});
