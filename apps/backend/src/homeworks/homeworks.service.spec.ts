import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HomeworksService } from './homeworks.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';

describe('HomeworksService', () => {
  let service: HomeworksService;
  let prisma: any;
  let storage: any;
  let systemConfig: any;

  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 'teacher1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin1', name: 'Admin' };
  const mockStudent = { id: 'student-1', role: Role.STUDENT, account: 'student1', name: 'Student' };

  const mockClass = { id: 'class-1', name: 'Test Class' };
  const mockHomework = {
    id: 'homework-1',
    classId: 'class-1',
    title: 'Test Homework',
    desc: 'Description',
    dueAt: null,
    createdAt: new Date('2025-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      class: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      homework: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      submission: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      submissionImage: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      enrollment: {
        count: jest.fn(),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((args) => Promise.all(args)),
    };

    storage = {
      deleteObjects: jest.fn().mockResolvedValue({ ok: 0, failed: [] }),
    };

    systemConfig = {
      setValue: jest.fn().mockResolvedValue(undefined),
      deleteValue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworksService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();

    service = module.get<HomeworksService>(HomeworksService);
  });

  // ─── ensureClassAccess ───

  describe('ensureClassAccess (via createHomework)', () => {
    it('should allow admin to access any class', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.homework.create.mockResolvedValue(mockHomework);

      const result = await service.createHomework(
        { classId: 'class-1', title: 'New HW' },
        mockAdmin,
      );

      expect(result.id).toBe('homework-1');
      expect(prisma.class.findUnique).toHaveBeenCalledWith({ where: { id: 'class-1' } });
    });

    it('should throw NotFoundException when admin accesses non-existent class', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.createHomework({ classId: 'missing', title: 'HW' }, mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow teacher to access owned class', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.create.mockResolvedValue(mockHomework);

      const result = await service.createHomework(
        { classId: 'class-1', title: 'New HW' },
        mockTeacher,
      );

      expect(result.id).toBe('homework-1');
    });

    it('should throw ForbiddenException when teacher has no access to class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.createHomework({ classId: 'class-1', title: 'HW' }, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for student role', async () => {
      await expect(
        service.createHomework({ classId: 'class-1', title: 'HW' }, mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── ensureHomeworkAccess ───

  describe('ensureHomeworkAccess (via updateHomework)', () => {
    it('should allow admin to access any homework', async () => {
      prisma.homework.findUnique.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.homework.update.mockResolvedValue({ ...mockHomework, title: 'Updated' });

      const result = await service.updateHomework(
        'homework-1',
        { title: 'Updated' },
        mockAdmin,
      );

      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException when admin accesses non-existent homework', async () => {
      prisma.homework.findUnique.mockResolvedValue(null);

      await expect(
        service.updateHomework('missing', { title: 'X' }, mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow teacher to access owned homework', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.homework.update.mockResolvedValue({ ...mockHomework, title: 'Updated' });

      const result = await service.updateHomework(
        'homework-1',
        { title: 'Updated' },
        mockTeacher,
      );

      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException when teacher has no access to homework', async () => {
      prisma.homework.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHomework('homework-1', { title: 'X' }, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for student role', async () => {
      await expect(
        service.updateHomework('homework-1', { title: 'X' }, mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── createHomework ───

  describe('createHomework', () => {
    it('should create homework with all fields', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.create.mockResolvedValue({
        ...mockHomework,
        dueAt: new Date('2025-06-01'),
      });

      const result = await service.createHomework(
        { classId: 'class-1', title: 'Essay', desc: 'Write an essay', dueAt: '2025-06-01' },
        mockTeacher,
      );

      expect(result.allowLateSubmission).toBe(false);
      expect(prisma.homework.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          title: 'Essay',
          desc: 'Write an essay',
          dueAt: expect.any(Date),
        },
      });
    });

    it('should create homework without optional fields', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.create.mockResolvedValue(mockHomework);

      const result = await service.createHomework(
        { classId: 'class-1', title: 'Simple HW' },
        mockTeacher,
      );

      expect(result.allowLateSubmission).toBe(false);
      expect(prisma.homework.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          title: 'Simple HW',
          desc: undefined,
          dueAt: undefined,
        },
      });
    });
  });

  // ─── updateHomework ───

  describe('updateHomework', () => {
    beforeEach(() => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
    });

    it('should update title only', async () => {
      prisma.homework.update.mockResolvedValue({ ...mockHomework, title: 'New Title' });

      await service.updateHomework('homework-1', { title: 'New Title' }, mockTeacher);

      expect(prisma.homework.update).toHaveBeenCalledWith({
        where: { id: 'homework-1' },
        data: { title: 'New Title' },
      });
    });

    it('should clear desc when set to empty string', async () => {
      prisma.homework.update.mockResolvedValue({ ...mockHomework, desc: null });

      await service.updateHomework('homework-1', { desc: '' }, mockTeacher);

      expect(prisma.homework.update).toHaveBeenCalledWith({
        where: { id: 'homework-1' },
        data: { desc: null },
      });
    });

    it('should clear dueAt when set to empty string', async () => {
      prisma.homework.update.mockResolvedValue({ ...mockHomework, dueAt: null });

      await service.updateHomework('homework-1', { dueAt: '' }, mockTeacher);

      expect(prisma.homework.update).toHaveBeenCalledWith({
        where: { id: 'homework-1' },
        data: { dueAt: null },
      });
    });

    it('should set dueAt to a new Date when provided', async () => {
      prisma.homework.update.mockResolvedValue(mockHomework);

      await service.updateHomework('homework-1', { dueAt: '2025-12-31' }, mockTeacher);

      expect(prisma.homework.update).toHaveBeenCalledWith({
        where: { id: 'homework-1' },
        data: { dueAt: expect.any(Date) },
      });
    });
  });

  // ─── listByClass ───

  describe('listByClass', () => {
    it('should list homeworks with late submission flags', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([mockHomework]);
      prisma.systemConfig.findMany.mockResolvedValue([
        { key: 'homework:late-submission:homework-1', value: true },
      ]);

      const result = await service.listByClass('class-1', mockTeacher);

      expect(result).toHaveLength(1);
      expect(result[0].allowLateSubmission).toBe(true);
    });

    it('should default late submission to false when no config', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([mockHomework]);
      prisma.systemConfig.findMany.mockResolvedValue([]);

      const result = await service.listByClass('class-1', mockTeacher);

      expect(result[0].allowLateSubmission).toBe(false);
    });

    it('should return empty array when no homeworks', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([]);

      const result = await service.listByClass('class-1', mockTeacher);

      expect(result).toEqual([]);
    });
  });

  // ─── listByClassSummary ───

  describe('listByClassSummary', () => {
    it('should return empty array when no homeworks exist', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([]);

      const result = await service.listByClassSummary('class-1', mockTeacher);

      expect(result).toEqual([]);
    });

    it('should compute summary counts from status and student groups', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW1', desc: null, dueAt: null, createdAt: new Date() },
        { id: 'hw-2', title: 'HW2', desc: null, dueAt: null, createdAt: new Date() },
      ]);
      prisma.enrollment.count.mockResolvedValue(30);
      prisma.submission.groupBy.mockResolvedValueOnce([
        { homeworkId: 'hw-1', status: 'DONE', _count: { _all: 10 } },
        { homeworkId: 'hw-1', status: 'FAILED', _count: { _all: 2 } },
        { homeworkId: 'hw-1', status: 'QUEUED', _count: { _all: 1 } },
        { homeworkId: 'hw-1', status: 'PROCESSING', _count: { _all: 3 } },
        { homeworkId: 'hw-2', status: 'DONE', _count: { _all: 5 } },
      ]).mockResolvedValueOnce([
        { homeworkId: 'hw-1', studentId: 's1', _count: { _all: 2 } },
        { homeworkId: 'hw-1', studentId: 's2', _count: { _all: 1 } },
        { homeworkId: 'hw-2', studentId: 's1', _count: { _all: 1 } },
      ]);
      prisma.systemConfig.findMany.mockResolvedValue([]);

      const result = await service.listByClassSummary('class-1', mockTeacher);

      expect(result).toHaveLength(2);

      const hw1 = result.find((r: any) => r.id === 'hw-1')!;
      expect(hw1.studentCount).toBe(30);
      expect(hw1.submissionCount).toBe(2);
      expect(hw1.pendingStudents).toBe(28);
      expect(hw1.doneCount).toBe(10);
      expect(hw1.failedCount).toBe(2);
      expect(hw1.queuedCount).toBe(1);
      expect(hw1.processingCount).toBe(3);
      expect(hw1.submissionsTotal).toBe(16);
      expect(hw1.allowLateSubmission).toBe(false);

      const hw2 = result.find((r: any) => r.id === 'hw-2')!;
      expect(hw2.submissionCount).toBe(1);
      expect(hw2.pendingStudents).toBe(29);
      expect(hw2.doneCount).toBe(5);
    });

    it('should flag late submission correctly from config', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'HW1', desc: null, dueAt: null, createdAt: new Date() },
      ]);
      prisma.enrollment.count.mockResolvedValue(10);
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.systemConfig.findMany.mockResolvedValue([
        { key: 'homework:late-submission:hw-1', value: true },
      ]);

      const result = await service.listByClassSummary('class-1', mockTeacher);

      expect(result[0].allowLateSubmission).toBe(true);
    });
  });

  // ─── listForStudent ───

  describe('listForStudent', () => {
    it('should list homeworks for enrolled student with late submission flags', async () => {
      prisma.homework.findMany.mockResolvedValue([
        { ...mockHomework, class: { id: 'class-1', name: 'Test Class' } },
      ]);
      prisma.systemConfig.findMany.mockResolvedValue([]);

      const result = await service.listForStudent(mockStudent);

      expect(result).toHaveLength(1);
      expect(result[0].allowLateSubmission).toBe(false);
    });
  });

  // ─── getDeletePreview ───

  describe('getDeletePreview', () => {
    it('should return submission and image counts', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(5);
      prisma.submissionImage.count.mockResolvedValue(12);

      const result = await service.getDeletePreview('homework-1', mockTeacher);

      expect(result).toEqual({
        homeworkId: 'homework-1',
        submissionCount: 5,
        imageCount: 12,
      });
    });
  });

  // ─── updateLateSubmission ───

  describe('updateLateSubmission', () => {
    it('should enable late submission for homework', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });

      const result = await service.updateLateSubmission('homework-1', true, mockTeacher);

      expect(result).toEqual({ homeworkId: 'homework-1', allowLateSubmission: true });
      expect(systemConfig.setValue).toHaveBeenCalledWith(
        'homework:late-submission:homework-1',
        true,
      );
    });

    it('should disable late submission for homework', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });

      const result = await service.updateLateSubmission('homework-1', false, mockTeacher);

      expect(result).toEqual({ homeworkId: 'homework-1', allowLateSubmission: false });
    });
  });

  // ─── deleteHomework ───

  describe('deleteHomework', () => {
    it('should delete homework and clean up images', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(0);
      prisma.submissionImage.findMany.mockResolvedValue([
        { objectKey: 'submissions/hw1/img1.jpg' },
        { objectKey: 'submissions/hw1/img2.jpg' },
      ]);
      storage.deleteObjects.mockResolvedValue({ ok: 2, failed: [] });
      prisma.homework.delete.mockResolvedValue(undefined);

      const result = await service.deleteHomework('homework-1', mockTeacher);

      expect(result.deleted).toBe(true);
      expect(result.removedObjects).toBe(2);
      expect(result.failedObjectDeletes).toBe(0);
      expect(result.droppedActiveSubmissions).toBe(0);
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        'submissions/hw1/img1.jpg',
        'submissions/hw1/img2.jpg',
      ]);
      expect(systemConfig.deleteValue).toHaveBeenCalledWith(
        'homework:late-submission:homework-1',
      );
    });

    it('should reject deletion when active submissions exist and force is false', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(3);

      await expect(
        service.deleteHomework('homework-1', mockTeacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('should force-delete homework even with active submissions', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(2);
      prisma.submissionImage.findMany.mockResolvedValue([]);
      storage.deleteObjects.mockResolvedValue({ ok: 0, failed: [] });
      prisma.homework.delete.mockResolvedValue(undefined);

      const result = await service.deleteHomework('homework-1', mockTeacher, true);

      expect(result.deleted).toBe(true);
      expect(result.droppedActiveSubmissions).toBe(2);
    });

    it('should handle images with null objectKeys', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(0);
      prisma.submissionImage.findMany.mockResolvedValue([
        { objectKey: 'valid-key' },
        { objectKey: null },
        { objectKey: '' },
      ]);
      storage.deleteObjects.mockResolvedValue({ ok: 1, failed: [] });
      prisma.homework.delete.mockResolvedValue(undefined);

      const result = await service.deleteHomework('homework-1', mockTeacher);

      expect(storage.deleteObjects).toHaveBeenCalledWith(['valid-key']);
    });

    it('should deduplicate object keys before deletion', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(0);
      prisma.submissionImage.findMany.mockResolvedValue([
        { objectKey: 'same-key' },
        { objectKey: 'same-key' },
      ]);
      storage.deleteObjects.mockResolvedValue({ ok: 1, failed: [] });
      prisma.homework.delete.mockResolvedValue(undefined);

      await service.deleteHomework('homework-1', mockTeacher);

      expect(storage.deleteObjects).toHaveBeenCalledWith(['same-key']);
    });

    it('should report failed object deletes', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prisma.submission.count.mockResolvedValue(0);
      prisma.submissionImage.findMany.mockResolvedValue([
        { objectKey: 'key-1' },
        { objectKey: 'key-2' },
      ]);
      storage.deleteObjects.mockResolvedValue({ ok: 1, failed: ['key-2'] });
      prisma.homework.delete.mockResolvedValue(undefined);

      const result = await service.deleteHomework('homework-1', mockTeacher);

      expect(result.removedObjects).toBe(1);
      expect(result.failedObjectDeletes).toBe(1);
    });
  });

  // ─── getLateSubmissionMap ───

  describe('getLateSubmissionMap (via listByClass)', () => {
    it('should handle non-boolean config values as false', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.homework.findMany.mockResolvedValue([mockHomework]);
      prisma.systemConfig.findMany.mockResolvedValue([
        { key: 'homework:late-submission:homework-1', value: 'yes' },
      ]);

      const result = await service.listByClass('class-1', mockTeacher);

      expect(result[0].allowLateSubmission).toBe(false);
    });
  });
});
