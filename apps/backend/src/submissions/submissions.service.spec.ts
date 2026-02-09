import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, SubmissionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { GradingPolicyService } from '../grading-policy/grading-policy.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { LlmConfigService } from '../llm/llm-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let prismaService: jest.Mocked<PrismaService>;
  let storageService: jest.Mocked<StorageService>;
  let queueService: jest.Mocked<QueueService>;
  let gradingPolicyService: jest.Mocked<GradingPolicyService>;
  let ocrService: jest.Mocked<BaiduOcrService>;
  let systemConfigService: jest.Mocked<SystemConfigService>;
  let llmConfigService: jest.Mocked<LlmConfigService>;

  const mockStudent: AuthUser = {
    id: 'student-1',
    account: 'student1',
    name: 'Test Student',
    role: Role.STUDENT,
  };

  const mockTeacher: AuthUser = {
    id: 'teacher-1',
    account: 'teacher1',
    name: 'Test Teacher',
    role: Role.TEACHER,
  };

  const mockAdmin: AuthUser = {
    id: 'admin-1',
    account: 'admin1',
    name: 'Test Admin',
    role: Role.ADMIN,
  };

  const mockHomework = {
    id: 'homework-1',
    title: 'Test Homework',
    classId: 'class-1',
    description: null,
    deadline: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubmission = {
    id: 'submission-1',
    homeworkId: 'homework-1',
    studentId: 'student-1',
    status: SubmissionStatus.QUEUED,
    totalScore: null,
    gradingJson: null,
    ocrText: null,
    errorCode: null,
    errorMsg: null,
    batchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaService = {
      homework: {
        findFirst: jest.fn(),
      },
      submission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      submissionImage: {
        createMany: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
      },
      // Interactive transaction: execute callback passing the mock itself as tx
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(prismaService)),
    } as unknown as jest.Mocked<PrismaService>;

    storageService = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockResolvedValue(Buffer.from('test')),
    } as unknown as jest.Mocked<StorageService>;

    queueService = {
      enqueueGrading: jest.fn().mockResolvedValue(undefined),
      enqueueRegrade: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueueService>;

    gradingPolicyService = {
      resolvePolicy: jest.fn().mockResolvedValue({
        mode: 'cheap',
        needRewrite: false,
      }),
    } as unknown as jest.Mocked<GradingPolicyService>;

    ocrService = {
      recognize: jest.fn(),
    } as unknown as jest.Mocked<BaiduOcrService>;

    systemConfigService = {
      getValue: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<SystemConfigService>;

    llmConfigService = {
      resolveRuntimeConfig: jest.fn().mockResolvedValue({
        providerName: 'llm',
        baseUrl: '',
        headers: {},
        prices: {},
      }),
    } as unknown as jest.Mocked<LlmConfigService>;

    service = new SubmissionsService(
      prismaService,
      storageService,
      queueService,
      gradingPolicyService,
      ocrService,
      systemConfigService,
      llmConfigService,
    );
  });

  describe('createSubmission', () => {
    const mockFiles = [
      {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
      },
    ] as Express.Multer.File[];

    it('should create submission for enrolled student', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.submission.create = jest.fn().mockResolvedValue(mockSubmission);
      prismaService.submissionImage.createMany = jest.fn().mockResolvedValue({ count: 1 });

      const result = await service.createSubmission(
        { homeworkId: 'homework-1' },
        mockFiles,
        mockStudent,
      );

      expect(result.submissionId).toBe('submission-1');
      expect(result.status).toBe(SubmissionStatus.QUEUED);
      expect(queueService.enqueueGrading).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-student users', async () => {
      await expect(
        service.createSubmission({ homeworkId: 'homework-1' }, mockFiles, mockTeacher),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createSubmission({ homeworkId: 'homework-1' }, mockFiles, mockAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when no files uploaded', async () => {
      await expect(
        service.createSubmission({ homeworkId: 'homework-1' }, [], mockStudent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when more than 3 files uploaded', async () => {
      const tooManyFiles = [
        { originalname: '1.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('1') },
        { originalname: '2.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('2') },
        { originalname: '3.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('3') },
        { originalname: '4.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('4') },
      ] as Express.Multer.File[];

      await expect(
        service.createSubmission({ homeworkId: 'homework-1' }, tooManyFiles, mockStudent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-image files', async () => {
      const nonImageFiles = [
        { originalname: 'test.pdf', mimetype: 'application/pdf', buffer: Buffer.from('test') },
      ] as Express.Multer.File[];

      await expect(
        service.createSubmission({ homeworkId: 'homework-1' }, nonImageFiles, mockStudent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when homework not found or no access', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.createSubmission({ homeworkId: 'nonexistent' }, mockFiles, mockStudent),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubmission', () => {
    const submissionWithRelations = {
      ...mockSubmission,
      images: [],
      student: { id: 'student-1', name: 'Test Student', account: 'student1' },
      homework: { id: 'homework-1', title: 'Test Homework' },
    };

    it('should allow admin to get any submission', async () => {
      prismaService.submission.findUnique = jest.fn().mockResolvedValue(submissionWithRelations);

      const result = await service.getSubmission('submission-1', mockAdmin);

      expect(result).toBeDefined();
      expect(prismaService.submission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'submission-1' },
        }),
      );
    });

    it('should allow student to get own submission', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(submissionWithRelations);

      const result = await service.getSubmission('submission-1', mockStudent);

      expect(result).toBeDefined();
      expect(prismaService.submission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'submission-1', studentId: mockStudent.id },
        }),
      );
    });

    it('should allow teacher to get submission from their class', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(submissionWithRelations);

      const result = await service.getSubmission('submission-1', mockTeacher);

      expect(result).toBeDefined();
      expect(prismaService.submission.findFirst).toHaveBeenCalled();
    });
  });

  describe('listStudentSubmissions', () => {
    it('should throw ForbiddenException for non-student users', async () => {
      await expect(service.listStudentSubmissions(mockTeacher)).rejects.toThrow(ForbiddenException);
    });

    it('should list submissions for student', async () => {
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          ...mockSubmission,
          homework: { id: 'homework-1', title: 'Test Homework' },
        },
      ]);

      const result = await service.listStudentSubmissions(mockStudent);

      expect(result).toHaveLength(1);
      expect(result[0].homeworkTitle).toBe('Test Homework');
    });
  });

  describe('listHomeworkSubmissions', () => {
    it('should throw ForbiddenException for student users', async () => {
      await expect(service.listHomeworkSubmissions('homework-1', mockStudent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when homework not found', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.listHomeworkSubmissions('homework-1', mockTeacher)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should list submissions for teacher', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          ...mockSubmission,
          student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        },
      ]);

      const result = await service.listHomeworkSubmissions('homework-1', mockTeacher);

      expect(result).toHaveLength(1);
      expect(result[0].studentName).toBe('Test Student');
    });
  });

  describe('requestRegrade', () => {
    it('should queue regrade for existing submission', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue({
        ...mockSubmission,
        images: [],
        student: { id: 'student-1', name: 'Test', account: 'test' },
        homework: { id: 'homework-1', title: 'Test' },
      });
      prismaService.submission.findUnique = jest.fn().mockResolvedValue({
        homeworkId: 'homework-1',
        homework: { classId: 'class-1' },
      });
      prismaService.submission.update = jest.fn().mockResolvedValue(mockSubmission);

      const result = await service.requestRegrade('submission-1', {}, mockStudent);

      expect(result.status).toBe(SubmissionStatus.QUEUED);
      expect(queueService.enqueueRegrade).toHaveBeenCalled();
    });

    it('should throw NotFoundException when submission not found', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.requestRegrade('nonexistent', {}, mockStudent)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
