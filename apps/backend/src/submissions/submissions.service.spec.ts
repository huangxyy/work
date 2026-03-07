import AdmZip = require('adm-zip');
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

jest.mock('sharp', () =>
  jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumbnail-buffer')),
  })),
);

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
    _count: { images: 0 },
  };

  beforeEach(() => {
    prismaService = {
      homework: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      submission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      submissionImage: {
        createMany: jest.fn(),
        create: jest.fn(),
      },
      batchUpload: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: unknown) => Promise<unknown>)(prismaService);
      }),
    } as unknown as jest.Mocked<PrismaService>;

    storageService = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockResolvedValue(Buffer.from('test')),
      listObjectKeys: jest.fn().mockResolvedValue([]),
      deleteObjects: jest.fn().mockResolvedValue({ ok: 0, failed: [] }),
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

  describe('createBatchSubmissions', () => {
    it('should merge multiple matched images for the same student into one submission', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);
      prismaService.batchUpload.create = jest.fn().mockResolvedValue({ id: 'batch-1' });
      prismaService.batchUpload.update = jest.fn().mockResolvedValue({ id: 'batch-1' });
      prismaService.submission.create = jest.fn().mockResolvedValue({ id: 'submission-batch-1' });
      prismaService.submissionImage.createMany = jest.fn().mockResolvedValue({ count: 2 });

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'storeStagingImage').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'loadImageBuffer').mockResolvedValue(Buffer.from('image-buffer'));
      jest
        .spyOn(service as any, 'resolveAccountForImage')
        .mockResolvedValueOnce({
          account: 'student1',
          matchedBy: 'ocr',
          confidence: 0.98,
          analysisZh: '命中学生',
          analysisEn: 'Matched student',
        })
        .mockResolvedValueOnce({
          account: 'student1',
          matchedBy: 'ocr',
          confidence: 0.97,
          analysisZh: '命中学生',
          analysisEn: 'Matched student',
        });

      const files = {
        images: [
          {
            originalname: 'page-1.jpg',
            mimetype: 'image/jpeg',
            buffer: Buffer.from('page-1'),
          },
          {
            originalname: 'page-2.jpg',
            mimetype: 'image/jpeg',
            buffer: Buffer.from('page-2'),
          },
        ] as Express.Multer.File[],
        archive: [],
      };

      const result = await service.createBatchSubmissions(
        { homeworkId: 'homework-1' } as never,
        files,
        mockTeacher,
      );

      expect(result.createdSubmissions).toBe(1);
      expect(result.acceptedImages).toBe(2);
      expect(result.submissions).toEqual([
        {
          submissionId: 'submission-batch-1',
          studentAccount: 'student1',
          studentName: 'Test Student',
          imageCount: 2,
        },
      ]);
      expect(prismaService.submission.create).toHaveBeenCalledTimes(1);
      expect(prismaService.submissionImage.createMany).toHaveBeenCalledTimes(1);
      expect(queueService.enqueueGrading).toHaveBeenCalledTimes(1);
      expect(prismaService.batchUpload.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { createdSubmissions: 1 },
      });

      const createManyMock = prismaService.submissionImage.createMany as unknown as jest.Mock;
      const imageRecords = createManyMock.mock.calls[0][0].data as Array<{
        submissionId: string;
        objectKey: string;
      }>;
      expect(imageRecords).toHaveLength(2);
      expect(imageRecords.every((item) => item.submissionId === 'submission-batch-1')).toBe(true);
    });

    it('should reject student users for batch uploads', async () => {
      await expect(
        service.createBatchSubmissions({ homeworkId: 'homework-1' } as never, { images: [], archive: [] }, mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when batch upload homework is not accessible', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.createBatchSubmissions({ homeworkId: 'homework-1' } as never, { images: [], archive: [] }, mockTeacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return preview results in dryRun mode without persisting submissions', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveAccountForImage').mockResolvedValue({
        account: 'student1',
        matchedBy: 'ocr',
        confidence: 0.99,
        analysisZh: '命中学生',
        analysisEn: 'Matched student',
      });

      const result = await service.createBatchSubmissions(
        { homeworkId: 'homework-1', dryRun: true } as never,
        {
          images: [
            {
              originalname: 'page-1.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('page-1'),
            } as Express.Multer.File,
          ],
          archive: [],
        },
        mockTeacher,
      );

      expect(result).toEqual({
        preview: true,
        totalImages: 1,
        matchedImages: 1,
        unmatchedCount: 0,
        groups: [{ account: 'student1', name: 'Test Student', imageCount: 1 }],
        unmatched: [],
        skipped: [],
        matchResults: [
          expect.objectContaining({
            file: 'page-1.jpg',
            fileKey: 'image:0:page-1.jpg',
            matchedAccount: 'student1',
            matchedName: 'Test Student',
            thumbnailUrl: 'https://example.com/thumb.jpg',
          }),
        ],
      });
      expect(prismaService.batchUpload.create).not.toHaveBeenCalled();
      expect(prismaService.submission.create).not.toHaveBeenCalled();
      expect(prismaService.submissionImage.createMany).not.toHaveBeenCalled();
      expect(queueService.enqueueGrading).not.toHaveBeenCalled();
    });

    it('should keep non-image uploads in skipped preview results while processing valid images', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveAccountForImage').mockResolvedValue({
        account: 'student1',
        matchedBy: 'ocr',
        confidence: 0.99,
        analysisZh: '命中学生',
        analysisEn: 'Matched student',
      });

      const result = await service.createBatchSubmissions(
        { homeworkId: 'homework-1', dryRun: true } as never,
        {
          images: [
            {
              originalname: 'page-1.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('page-1'),
            } as Express.Multer.File,
            {
              originalname: 'notes.pdf',
              mimetype: 'application/pdf',
              buffer: Buffer.from('notes'),
            } as Express.Multer.File,
          ],
          archive: [],
        },
        mockTeacher,
      );

      expect(result.preview).toBe(true);
      expect(result.skipped).toEqual([
        expect.objectContaining({
          file: 'notes.pdf',
          reason: 'NON_IMAGE',
          fileKey: 'image:1:notes.pdf',
        }),
      ]);
    });

    it('should reject batch uploads when no valid image remains after filtering', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([]);

      await expect(
        service.createBatchSubmissions(
          { homeworkId: 'homework-1' } as never,
          {
            images: [
              {
                originalname: 'notes.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.from('notes'),
              } as Express.Multer.File,
            ],
            archive: [],
          },
          mockTeacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject batch uploads that exceed the maximum image count', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([]);

      const images = Array.from({ length: 102 }, (_, index) => ({
        originalname: `page-${index + 1}.jpg`,
        mimetype: 'image/jpeg',
        buffer: Buffer.from(String(index + 1)),
      })) as Express.Multer.File[];

      await expect(
        service.createBatchSubmissions(
          { homeworkId: 'homework-1' } as never,
          { images, archive: [] },
          mockTeacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject oversized zip archives before extraction', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([]);

      await expect(
        service.createBatchSubmissions(
          { homeworkId: 'homework-1' } as never,
          {
            images: [],
            archive: [
              {
                originalname: 'bulk.zip',
                size: 104857601,
                buffer: Buffer.from('zip'),
              } as Express.Multer.File,
            ],
          },
          mockTeacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve name and mapping overrides before matching preview images', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveStudentByName').mockResolvedValue({
        account: 'student1',
        name: 'Test Student',
        isNew: false,
      });
      jest.spyOn(service as any, 'resolveAccountForImage').mockImplementation(async (...args: unknown[]) => {
        const [{ overrides }] = args as [{ overrides: Map<string, string> }];
        expect(overrides.get('image:0:page-1.jpg')).toBe('student1');
        return {
          account: 'student1',
          matchedBy: 'override',
          confidence: 1,
          analysisZh: '使用覆盖匹配',
          analysisEn: 'Matched by override',
        };
      });

      const result = await service.createBatchSubmissions(
        {
          homeworkId: 'homework-1',
          dryRun: true,
          nameOverrides: JSON.stringify({ 'image:0:page-1.jpg': 'Test Student' }),
          mappingOverrides: JSON.stringify({ 'image:0:page-1.jpg': 'student1' }),
        } as never,
        {
          images: [
            {
              originalname: 'page-1.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('page-1'),
            } as Express.Multer.File,
          ],
          archive: [],
        },
        mockTeacher,
      );

      expect(result.preview).toBe(true);
      expect(result.groups).toEqual([{ account: 'student1', name: 'Test Student', imageCount: 1 }]);
    });

    it('should include user-excluded files in skipped results while keeping other preview images', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveAccountForImage').mockResolvedValue({
        account: 'student1',
        matchedBy: 'ocr',
        confidence: 0.99,
        analysisZh: '命中学生',
        analysisEn: 'Matched student',
      });

      const result = await service.createBatchSubmissions(
        {
          homeworkId: 'homework-1',
          dryRun: true,
          excludedFileKeys: JSON.stringify(['image:0:skip-me.jpg']),
        } as never,
        {
          images: [
            {
              originalname: 'skip-me.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('skip'),
            } as Express.Multer.File,
            {
              originalname: 'keep-me.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('keep'),
            } as Express.Multer.File,
          ],
          archive: [],
        },
        mockTeacher,
      );

      expect(result.skipped).toEqual([
        expect.objectContaining({
          file: 'skip-me.jpg',
          reason: 'USER_EXCLUDED',
          fileKey: 'image:0:skip-me.jpg',
        }),
      ]);
      expect(result.totalImages).toBe(1);
    });

    it('should surface unmatched preview images when matching fails', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveAccountForImage').mockResolvedValue({
        account: undefined,
        matchedBy: 'ocr',
        confidence: 0.2,
        analysisZh: '未匹配到学生',
        analysisEn: 'No student matched',
        reason: 'ACCOUNT_NOT_FOUND',
      });

      const result = await service.createBatchSubmissions(
        { homeworkId: 'homework-1', dryRun: true } as never,
        {
          images: [
            {
              originalname: 'unknown.jpg',
              mimetype: 'image/jpeg',
              buffer: Buffer.from('unknown'),
            } as Express.Multer.File,
          ],
          archive: [],
        },
        mockTeacher,
      );

      expect(result.unmatchedCount).toBe(1);
      expect(result.unmatched).toEqual([
        expect.objectContaining({
          file: 'unknown.jpg',
          reason: 'ACCOUNT_NOT_FOUND',
          fileKey: 'image:0:unknown.jpg',
        }),
      ]);
      expect(result.groups).toEqual([]);
    });

    it('should process extracted archive images during dryRun preview', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(mockHomework);
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);

      jest.spyOn(service as any, 'extractZipEntries').mockImplementation(async (...args: unknown[]) => {
        const [, options] = args as [unknown, { images: Array<Record<string, unknown>> }];
        options.images.push({
          fileKey: 'zip:folder/page-1.jpg',
          filename: 'folder/page-1.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('zip-image'),
        });
      });
      jest.spyOn(service as any, 'getOcrConfig').mockResolvedValue({});
      jest.spyOn(service as any, 'generateThumbnail').mockResolvedValue('https://example.com/thumb.jpg');
      jest.spyOn(service as any, 'resolveAccountForImage').mockResolvedValue({
        account: 'student1',
        matchedBy: 'ocr',
        confidence: 0.95,
        analysisZh: '命中学生',
        analysisEn: 'Matched student',
      });

      const result = await service.createBatchSubmissions(
        { homeworkId: 'homework-1', dryRun: true } as never,
        {
          images: [],
          archive: [
            {
              originalname: 'bulk.zip',
              size: 128,
              buffer: Buffer.from('zip-buffer'),
              path: 'temp-bulk.zip',
            } as Express.Multer.File,
          ],
        },
        mockTeacher,
      );

      expect(result.preview).toBe(true);
      expect(result.totalImages).toBe(1);
      expect(result.groups).toEqual([{ account: 'student1', name: 'Test Student', imageCount: 1 }]);
    });
  });

  describe('regradeHomeworkSubmissions', () => {
    it('should requeue failed and stuck processing submissions for a homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        { id: 'submission-failed' },
        { id: 'submission-stuck' },
      ]);
      prismaService.submission.updateMany = jest.fn().mockResolvedValue({ count: 2 });
      jest.spyOn(service as any, 'resolveGradingOptions').mockResolvedValue({
        mode: 'quality',
        needRewrite: true,
      });

      const result = await service.regradeHomeworkSubmissions(
        { homeworkId: 'homework-1' },
        mockTeacher,
      );

      expect(result).toEqual({ homeworkId: 'homework-1', count: 2 });
      expect(prismaService.submission.findMany).toHaveBeenCalledWith({
        where: {
          homeworkId: 'homework-1',
          OR: [
            { status: SubmissionStatus.FAILED },
            { status: SubmissionStatus.PROCESSING, updatedAt: { lt: expect.any(Date) } },
          ],
        },
        select: { id: true },
      });
      expect(prismaService.submission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['submission-failed', 'submission-stuck'] } },
        data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
      });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-failed', {
        mode: 'quality',
        needRewrite: true,
      });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-stuck', {
        mode: 'quality',
        needRewrite: true,
      });
    });

    it('should reject student users when regrading homework submissions', async () => {
      await expect(service.regradeHomeworkSubmissions({ homeworkId: 'homework-1' }, mockStudent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return zero when there are no failed or stuck submissions to regrade', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.regradeHomeworkSubmissions({ homeworkId: 'homework-1' }, mockTeacher);

      expect(result).toEqual({ homeworkId: 'homework-1', count: 0 });
      expect(prismaService.submission.updateMany).not.toHaveBeenCalled();
      expect(queueService.enqueueRegrade).not.toHaveBeenCalled();
    });
  });

  describe('listBatchUploads', () => {
    it('should compute batch statuses from grouped submission counts', async () => {
      const createdAt = new Date('2026-03-07T00:00:00.000Z');
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1' });
      prismaService.batchUpload.findMany = jest.fn().mockResolvedValue([
        {
          id: 'batch-done',
          homeworkId: 'homework-1',
          uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
          totalImages: 2,
          matchedImages: 2,
          unmatchedCount: 0,
          createdSubmissions: 2,
          skipped: [],
          mode: 'cheap',
          needRewrite: false,
          createdAt,
        },
        {
          id: 'batch-failed',
          homeworkId: 'homework-1',
          uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
          totalImages: 1,
          matchedImages: 1,
          unmatchedCount: 0,
          createdSubmissions: 1,
          skipped: [],
          mode: 'cheap',
          needRewrite: false,
          createdAt,
        },
        {
          id: 'batch-processing',
          homeworkId: 'homework-1',
          uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
          totalImages: 2,
          matchedImages: 2,
          unmatchedCount: 0,
          createdSubmissions: 2,
          skipped: [],
          mode: 'quality',
          needRewrite: true,
          createdAt,
        },
        {
          id: 'batch-empty',
          homeworkId: 'homework-1',
          uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
          totalImages: 0,
          matchedImages: 0,
          unmatchedCount: 0,
          createdSubmissions: 0,
          skipped: [],
          mode: 'cheap',
          needRewrite: false,
          createdAt,
        },
      ]);
      prismaService.submission.groupBy = jest.fn().mockResolvedValue([
        { batchId: 'batch-done', status: SubmissionStatus.DONE, _count: { _all: 2 } },
        { batchId: 'batch-failed', status: SubmissionStatus.FAILED, _count: { _all: 1 } },
        { batchId: 'batch-processing', status: SubmissionStatus.PROCESSING, _count: { _all: 1 } },
        { batchId: 'batch-processing', status: SubmissionStatus.QUEUED, _count: { _all: 1 } },
      ]);

      const result = await service.listBatchUploads('homework-1', mockTeacher, {
        cursor: 'cursor-1',
        limit: 20,
      });

      expect(prismaService.batchUpload.findMany).toHaveBeenCalledWith({
        where: { homeworkId: 'homework-1' },
        include: { uploader: { select: { id: true, name: true, account: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        cursor: { id: 'cursor-1' },
        skip: 1,
      });
      expect(result.map((item) => ({ id: item.id, status: item.status }))).toEqual([
        { id: 'batch-done', status: 'DONE' },
        { id: 'batch-failed', status: 'FAILED' },
        { id: 'batch-processing', status: 'PROCESSING' },
        { id: 'batch-empty', status: 'EMPTY' },
      ]);
    });

    it('should reject student users when listing batch uploads', async () => {
      await expect(service.listBatchUploads('homework-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when the homework cannot be accessed for batch listing', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.listBatchUploads('homework-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should return an empty list when the homework has no batch uploads', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1' });
      prismaService.batchUpload.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.listBatchUploads('homework-1', mockTeacher);

      expect(result).toEqual([]);
      expect(prismaService.submission.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getBatchUploadDetail', () => {
    it('should return computed status counts and mapped submissions for a batch', async () => {
      const createdAt = new Date('2026-03-07T00:00:00.000Z');
      const updatedAt = new Date('2026-03-07T01:00:00.000Z');
      prismaService.batchUpload.findFirst = jest.fn().mockResolvedValue({
        id: 'batch-1',
        uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
        homework: { id: 'homework-1', title: 'Test Homework' },
        totalImages: 3,
        matchedImages: 2,
        unmatchedCount: 1,
        createdSubmissions: 2,
        skipped: [{ file: 'page-3.jpg', reason: 'NO_MATCH' }],
        mode: 'quality',
        needRewrite: true,
        createdAt,
        updatedAt,
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          id: 'submission-1',
          status: SubmissionStatus.DONE,
          totalScore: 95,
          errorCode: null,
          errorMsg: null,
          updatedAt,
          student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        },
        {
          id: 'submission-2',
          status: SubmissionStatus.FAILED,
          totalScore: null,
          errorCode: 'OCR_FAILED',
          errorMsg: 'ocr failed',
          updatedAt,
          student: { id: 'student-2', name: 'Other Student', account: 'student2' },
        },
      ]);
      prismaService.submission.groupBy = jest.fn().mockResolvedValue([
        { status: SubmissionStatus.DONE, _count: { _all: 1 } },
        { status: SubmissionStatus.FAILED, _count: { _all: 1 } },
      ]);

      const result = await service.getBatchUploadDetail('batch-1', mockTeacher);

      expect(result).toEqual({
        id: 'batch-1',
        homework: { id: 'homework-1', title: 'Test Homework' },
        uploader: { id: 'teacher-1', name: 'Test Teacher', account: 'teacher1' },
        totalImages: 3,
        matchedImages: 2,
        unmatchedCount: 1,
        createdSubmissions: 2,
        skipped: [{ file: 'page-3.jpg', reason: 'NO_MATCH' }],
        mode: 'quality',
        needRewrite: true,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        status: 'PARTIAL',
        statusCounts: { queued: 0, processing: 0, done: 1, failed: 1 },
        submissions: [
          {
            id: 'submission-1',
            studentName: 'Test Student',
            studentAccount: 'student1',
            status: SubmissionStatus.DONE,
            totalScore: 95,
            errorCode: null,
            errorMsg: null,
            updatedAt: updatedAt.toISOString(),
          },
          {
            id: 'submission-2',
            studentName: 'Other Student',
            studentAccount: 'student2',
            status: SubmissionStatus.FAILED,
            totalScore: null,
            errorCode: 'OCR_FAILED',
            errorMsg: 'ocr failed',
            updatedAt: updatedAt.toISOString(),
          },
        ],
      });
    });

    it('should reject student users when loading batch details', async () => {
      await expect(service.getBatchUploadDetail('batch-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when a batch detail cannot be accessed', async () => {
      prismaService.batchUpload.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.getBatchUploadDetail('batch-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });
  });

  describe('regradeBatchSubmissions', () => {
    it('should requeue failed submissions for a batch using resolved grading options', async () => {
      prismaService.batchUpload.findFirst = jest.fn().mockResolvedValue({
        id: 'batch-1',
        homeworkId: 'homework-1',
        mode: 'cheap',
        needRewrite: false,
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        { id: 'submission-failed-1' },
        { id: 'submission-failed-2' },
      ]);
      prismaService.submission.updateMany = jest.fn().mockResolvedValue({ count: 2 });
      jest.spyOn(service as any, 'resolveGradingOptions').mockResolvedValue({
        mode: 'cheap',
        needRewrite: false,
      });

      const result = await service.regradeBatchSubmissions('batch-1', mockTeacher);

      expect(result).toEqual({ batchId: 'batch-1', count: 2 });
      expect(prismaService.submission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['submission-failed-1', 'submission-failed-2'] } },
        data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
      });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-failed-1', {
        mode: 'cheap',
        needRewrite: false,
      });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-failed-2', {
        mode: 'cheap',
        needRewrite: false,
      });
    });

    it('should reject student users when regrading a batch', async () => {
      await expect(service.regradeBatchSubmissions('batch-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when the batch cannot be accessed for regrade', async () => {
      prismaService.batchUpload.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.regradeBatchSubmissions('batch-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should return zero when a batch has no failed submissions to regrade', async () => {
      prismaService.batchUpload.findFirst = jest.fn().mockResolvedValue({
        id: 'batch-1',
        homeworkId: 'homework-1',
        mode: 'cheap',
        needRewrite: false,
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.regradeBatchSubmissions('batch-1', mockTeacher);

      expect(result).toEqual({ batchId: 'batch-1', count: 0 });
      expect(prismaService.submission.updateMany).not.toHaveBeenCalled();
      expect(queueService.enqueueRegrade).not.toHaveBeenCalled();
    });
  });

  describe('retrySkippedSubmission', () => {
    const retryDto = {
      homeworkId: 'homework-1',
      fileKey: 'image:0:page-2.jpg',
      filename: 'page-2.jpg',
      studentName: 'Test Student',
      batchId: 'batch-1',
    };

    beforeEach(() => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', classId: 'class-1' });
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', account: 'student1', name: 'Test Student' } },
      ]);
      prismaService.batchUpload.findUnique = jest.fn().mockResolvedValue({
        skipped: [{ fileKey: retryDto.fileKey }],
        unmatchedCount: 1,
      });
      prismaService.batchUpload.update = jest.fn().mockResolvedValue({ id: 'batch-1' });
      prismaService.submissionImage.create = jest.fn().mockResolvedValue({ id: 'image-1' });
      jest.spyOn(service as any, 'resolveGradingOptions').mockResolvedValue({
        mode: 'cheap',
        needRewrite: false,
      });
    });

    it('should reject student users for retrySkipped', async () => {
      await expect(service.retrySkippedSubmission(retryDto, mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when retrySkipped homework cannot be accessed', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.retrySkippedSubmission(retryDto, mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should append retried skipped images to an existing queued batch submission', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue({
        id: 'submission-existing',
        status: SubmissionStatus.QUEUED,
      });

      const result = await service.retrySkippedSubmission(retryDto, mockTeacher);

      expect(result).toEqual({ submissionId: 'submission-existing' });
      expect(prismaService.submission.create).not.toHaveBeenCalled();
      expect(prismaService.submission.update).not.toHaveBeenCalled();
      expect(prismaService.submissionImage.create).toHaveBeenCalledWith({
        data: {
          submissionId: 'submission-existing',
          objectKey: expect.stringMatching(/^submissions\//),
        },
      });
      expect(queueService.enqueueGrading).not.toHaveBeenCalled();
      expect(queueService.enqueueRegrade).not.toHaveBeenCalled();
      expect(prismaService.batchUpload.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          skipped: [],
          matchedImages: { increment: 1 },
          unmatchedCount: { decrement: 1 },
        },
      });
    });

    it('should requeue an existing completed batch submission when appending a retried image', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue({
        id: 'submission-done',
        status: SubmissionStatus.DONE,
      });
      prismaService.submission.update = jest.fn().mockResolvedValue({
        id: 'submission-done',
        status: SubmissionStatus.QUEUED,
      });

      const result = await service.retrySkippedSubmission(retryDto, mockTeacher);

      expect(result).toEqual({ submissionId: 'submission-done' });
      expect(prismaService.submission.create).not.toHaveBeenCalled();
      expect(prismaService.submission.update).toHaveBeenCalledWith({
        where: { id: 'submission-done' },
        data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
      });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-done', {
        mode: 'cheap',
        needRewrite: false,
      });
      expect(queueService.enqueueGrading).not.toHaveBeenCalled();
    });

    it('should reject retrySkipped when the existing batch submission is still processing', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue({
        id: 'submission-processing',
        status: SubmissionStatus.PROCESSING,
      });

      await expect(service.retrySkippedSubmission(retryDto, mockTeacher)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaService.submission.create).not.toHaveBeenCalled();
      expect(prismaService.submissionImage.create).not.toHaveBeenCalled();
      expect(queueService.enqueueGrading).not.toHaveBeenCalled();
      expect(queueService.enqueueRegrade).not.toHaveBeenCalled();
    });

    it('should throw when the staging image cannot be found', async () => {
      storageService.getObject.mockRejectedValueOnce(new Error('missing'));

      await expect(service.retrySkippedSubmission(retryDto, mockTeacher)).rejects.toThrow(NotFoundException);

      expect(prismaService.submission.create).not.toHaveBeenCalled();
      expect(queueService.enqueueGrading).not.toHaveBeenCalled();
    });

    it('should create a new queued submission and enqueue grading when no batch submission exists', async () => {
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.submission.create = jest.fn().mockResolvedValue({ id: 'submission-new' });

      const result = await service.retrySkippedSubmission(retryDto, mockTeacher);

      expect(result).toEqual({ submissionId: 'submission-new' });
      expect(prismaService.submission.create).toHaveBeenCalledWith({
        data: {
          homeworkId: 'homework-1',
          studentId: 'student-1',
          status: SubmissionStatus.QUEUED,
          batchId: 'batch-1',
        },
      });
      expect(prismaService.batchUpload.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          createdSubmissions: { increment: 1 },
          skipped: [],
          matchedImages: { increment: 1 },
          unmatchedCount: { decrement: 1 },
        },
      });
      expect(queueService.enqueueGrading).toHaveBeenCalledWith('submission-new', {
        mode: 'cheap',
        needRewrite: false,
      });
    });

    it('should reuse an existing student account resolved from the provided Chinese name', async () => {
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([]);
      prismaService.user.findFirst = jest.fn().mockResolvedValue({
        id: 'student-existing',
        account: 'zhangsan',
        name: '张三',
      });
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.submission.create = jest.fn().mockResolvedValue({ id: 'submission-new' });

      const result = await service.retrySkippedSubmission(
        { ...retryDto, studentName: '张三', fileKey: 'image:0:page-3.jpg', filename: 'page-3.jpg' },
        mockTeacher,
      );

      expect(result).toEqual({ submissionId: 'submission-new' });
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { account: 'zhangsan', role: Role.STUDENT },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.enrollment.create).not.toHaveBeenCalled();
      expect(prismaService.submission.create).toHaveBeenCalledWith({
        data: {
          homeworkId: 'homework-1',
          studentId: 'student-existing',
          status: SubmissionStatus.QUEUED,
          batchId: 'batch-1',
        },
      });
    });

    it('should create and enroll a new student when retrySkipped resolves a new Chinese name', async () => {
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([]);
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue({
        id: 'student-new',
        account: 'zhangsan',
        name: '张三',
      });
      prismaService.enrollment.create = jest.fn().mockResolvedValue({ id: 'enrollment-1' });
      prismaService.submission.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.submission.create = jest.fn().mockResolvedValue({ id: 'submission-new' });

      const result = await service.retrySkippedSubmission(
        { ...retryDto, studentName: '张三', fileKey: 'image:0:page-4.jpg', filename: 'page-4.jpg' },
        mockTeacher,
      );

      expect(result).toEqual({ submissionId: 'submission-new' });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          account: 'zhangsan',
          name: '张三',
          role: Role.STUDENT,
          passwordHash: expect.any(String),
        }),
      });
      expect(prismaService.enrollment.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          studentId: 'student-new',
        },
      });
      expect(prismaService.submission.create).toHaveBeenCalledWith({
        data: {
          homeworkId: 'homework-1',
          studentId: 'student-new',
          status: SubmissionStatus.QUEUED,
          batchId: 'batch-1',
        },
      });
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

  describe('listStudentSubmissionsWithQuery', () => {
    it('should apply query filters and map student submissions', async () => {
      const updatedAt = new Date('2026-03-07T12:00:00.000Z');
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          ...mockSubmission,
          totalScore: 88,
          updatedAt,
          homework: { id: 'homework-1', title: 'Test Homework' },
          _count: { images: 2 },
        },
      ]);

      const result = await service.listStudentSubmissionsWithQuery(mockStudent, {
        keyword: 'Test Homework',
        homeworkId: 'homework-1',
        minScore: 60,
        maxScore: 100,
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T23:59:59.000Z',
      });

      expect(prismaService.submission.findMany).toHaveBeenCalledWith({
        where: {
          studentId: 'student-1',
          homeworkId: 'homework-1',
          homework: { title: { contains: 'Test Homework' } },
          totalScore: { gte: 60, lte: 100 },
          updatedAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-31T23:59:59.000Z'),
          },
        },
        include: {
          homework: { select: { id: true, title: true } },
          _count: { select: { images: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      });
      expect(result).toEqual([
        {
          id: 'submission-1',
          homeworkId: 'homework-1',
          homeworkTitle: 'Test Homework',
          status: SubmissionStatus.QUEUED,
          totalScore: 88,
          errorCode: null,
          errorMsg: null,
          imageCount: 2,
          updatedAt: updatedAt.toISOString(),
        },
      ]);
    });
  });

  describe('exportStudentSubmissionsCsv', () => {
    it('should export student submissions as localized csv rows', async () => {
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          ...mockSubmission,
          status: SubmissionStatus.DONE,
          totalScore: 95,
          updatedAt: new Date('2026-03-07T12:30:00.000Z'),
          homework: { id: 'homework-1', title: 'Test Homework' },
        },
      ]);

      const csv = await service.exportStudentSubmissionsCsv(mockStudent, { lang: 'zh-CN' });

      expect(csv).toContain('提交ID');
      expect(csv).toContain('Test Homework');
      expect(csv).toContain('完成');
      expect(csv.startsWith('\uFEFF')).toBe(true);
    });
  });

  describe('getUnsubmittedStudents', () => {
    it('should return only enrolled students without submissions', async () => {
      prismaService.homework.findUnique = jest.fn().mockResolvedValue({
        classId: 'class-1',
        class: { teachers: [{ id: 'teacher-1' }] },
      });
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        { student: { id: 'student-1', name: 'Test Student', account: 'student1' } },
        { student: { id: 'student-2', name: 'Other Student', account: 'student2' } },
      ]);
      prismaService.submission.findMany = jest.fn().mockResolvedValue([{ studentId: 'student-1' }]);

      const result = await service.getUnsubmittedStudents('homework-1', mockTeacher);

      expect(result).toEqual([{ id: 'student-2', name: 'Other Student', account: 'student2' }]);
    });

    it('should reject teachers who do not own the homework class', async () => {
      prismaService.homework.findUnique = jest.fn().mockResolvedValue({
        classId: 'class-1',
        class: { teachers: [{ id: 'teacher-2' }] },
      });

      await expect(service.getUnsubmittedStudents('homework-1', mockTeacher)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportHomeworkCsv', () => {
    it('should export homework submissions as localized csv rows', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({
        id: 'homework-1',
        title: 'Test Homework',
        classId: 'class-1',
        class: { name: 'Class 1' },
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          id: 'submission-1',
          status: SubmissionStatus.DONE,
          totalScore: 95,
          errorCode: null,
          errorMsg: null,
          gradingJson: { summary: 'Great work', errors: [{ type: 'grammar' }] },
          updatedAt: new Date('2026-03-07T12:30:00.000Z'),
          student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        },
      ]);

      const csv = await service.exportHomeworkCsv('homework-1', mockTeacher, 'zh-CN');

      expect(csv).toContain('班级名称');
      expect(csv).toContain('Class 1');
      expect(csv).toContain('完成');
      expect(csv).toContain('Great work');
    });

    it('should reject student users for homework csv export', async () => {
      await expect(service.exportHomeworkCsv('homework-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when homework csv export cannot access the homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.exportHomeworkCsv('homework-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportHomeworkImagesZip', () => {
    it('should export homework images in a zip grouped by student and submission', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          id: 'submission-1',
          images: [
            { objectKey: 'submissions/submission-1/page-1.jpg' },
            { objectKey: 'submissions/submission-1/page-2.jpg' },
          ],
          student: { account: 'student1' },
        },
      ]);
      storageService.getObject.mockResolvedValueOnce(Buffer.from('page-1')).mockResolvedValueOnce(Buffer.from('page-2'));

      const buffer = await service.exportHomeworkImagesZip('homework-1', mockTeacher);
      const zip = new AdmZip(buffer);

      expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([
        'student1/submission-1/page-1.jpg',
        'student1/submission-1/page-2.jpg',
      ]);
      expect(storageService.getObject).toHaveBeenCalledWith('submissions/submission-1/page-1.jpg');
      expect(storageService.getObject).toHaveBeenCalledWith('submissions/submission-1/page-2.jpg');
    });

    it('should reject student users for homework image zip export', async () => {
      await expect(service.exportHomeworkImagesZip('homework-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when homework image zip export cannot access the homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.exportHomeworkImagesZip('homework-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportHomeworkRemindersCsv', () => {
    it('should export reminders only for students who have not submitted', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({
        id: 'homework-1',
        title: 'Test Homework',
        classId: 'class-1',
        class: { name: 'Class 1' },
      });
      prismaService.enrollment.findMany = jest.fn().mockResolvedValue([
        {
          studentId: 'student-1',
          student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        },
        {
          studentId: 'student-2',
          student: { id: 'student-2', name: 'Other Student', account: 'student2' },
        },
      ]);
      prismaService.submission.findMany = jest.fn().mockResolvedValue([{ studentId: 'student-1' }]);

      const csv = await service.exportHomeworkRemindersCsv('homework-1', mockTeacher, 'zh-CN');

      expect(csv).toContain('Other Student');
      expect(csv).toContain('student2');
      expect(csv).not.toContain('Test Student');
    });

    it('should reject student users for homework reminders export', async () => {
      await expect(service.exportHomeworkRemindersCsv('homework-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when homework reminders export cannot access the homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.exportHomeworkRemindersCsv('homework-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportHomeworkPrintPacket', () => {
    it('should reject student users for print packet export', async () => {
      await expect(service.exportHomeworkPrintPacket('homework-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });

    it('should throw when print packet export cannot access the homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.exportHomeworkPrintPacket('homework-1', mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should throw when no completed submissions exist for print packet export', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', title: 'Test Homework' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([]);

      await expect(service.exportHomeworkPrintPacket('homework-1', mockTeacher)).rejects.toThrow(BadRequestException);
    });

    it('should export a single print packet pdf when the result fits in one file', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', title: 'Test Homework' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          id: 'submission-1',
          totalScore: 95,
          updatedAt: new Date('2026-03-07T12:30:00.000Z'),
          gradingJson: { summary: 'Great work', nextSteps: ['Keep going'], suggestions: { rewrite: 'Rewrite', sampleEssay: 'Essay' }, errors: [] },
          student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        },
      ]);
      jest.spyOn(service as any, 'renderPrintPacketPdf').mockResolvedValue(Buffer.from('pdf-buffer'));

      const result = await service.exportHomeworkPrintPacket('homework-1', mockTeacher, { lang: 'zh-CN' });

      expect(result).toEqual({
        filename: 'homework-homework-1-print-packet.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('pdf-buffer'),
        totalStudents: 1,
        files: 1,
      });
    });

    it('should split print packet export into multiple pdf files inside a zip when exceeding per-file limit', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({ id: 'homework-1', title: 'Test Homework' });
      prismaService.submission.findMany = jest.fn().mockResolvedValue(
        Array.from({ length: 31 }, (_, index) => ({
          id: `submission-${index + 1}`,
          totalScore: 80 + (index % 10),
          updatedAt: new Date(`2026-03-${String((index % 9) + 1).padStart(2, '0')}T12:00:00.000Z`),
          gradingJson: { summary: `Summary ${index + 1}`, nextSteps: [], suggestions: {}, errors: [] },
          student: {
            id: `student-${index + 1}`,
            name: `Student ${index + 1}`,
            account: `student${index + 1}`,
          },
        })),
      );
      jest.spyOn(service as any, 'renderPrintPacketPdf')
        .mockResolvedValueOnce(Buffer.from('pdf-1'))
        .mockResolvedValueOnce(Buffer.from('pdf-2'));

      const result = await service.exportHomeworkPrintPacket('homework-1', mockTeacher, { lang: 'en' });
      const zip = new AdmZip(result.buffer);

      expect(result.filename).toBe('homework-homework-1-print-packets.zip');
      expect(result.mimeType).toBe('application/zip');
      expect(result.totalStudents).toBe(31);
      expect(result.files).toBe(2);
      expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([
        'homework-print-packet-1.pdf',
        'homework-print-packet-2.pdf',
      ]);
    });
  });

  describe('exportHomeworkSubmissionsPdf', () => {
    it('should reject student users for homework pdf export', async () => {
      await expect(
        service.exportHomeworkSubmissionsPdf('homework-1', ['submission-1'], 'zh-CN', mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw when homework pdf export cannot access the homework', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.exportHomeworkSubmissionsPdf('homework-1', ['submission-1'], 'zh-CN', mockTeacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when no completed submissions are available for homework pdf export', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({
        id: 'homework-1',
        title: 'Test Homework',
        classId: 'class-1',
        class: { id: 'class-1', name: 'Class 1' },
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([]);

      await expect(
        service.exportHomeworkSubmissionsPdf('homework-1', ['submission-1'], 'zh-CN', mockTeacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('should render homework pdf export for completed submissions', async () => {
      prismaService.homework.findFirst = jest.fn().mockResolvedValue({
        id: 'homework-1',
        title: 'Test Homework',
        classId: 'class-1',
        class: { id: 'class-1', name: 'Class 1' },
      });
      prismaService.submission.findMany = jest.fn().mockResolvedValue([
        {
          id: 'submission-1',
          updatedAt: new Date('2026-03-07T12:30:00.000Z'),
          totalScore: 95,
          gradingJson: { summary: 'Great work' },
          ocrText: 'Original essay',
          student: { id: 'student-1', name: 'Test Student' },
          homework: { id: 'homework-1', title: 'Test Homework' },
        },
        {
          id: 'submission-2',
          updatedAt: new Date('2026-03-07T13:30:00.000Z'),
          totalScore: 90,
          gradingJson: { summary: 'Nice work' },
          ocrText: 'Another essay',
          student: { id: 'student-2', name: 'Other Student' },
          homework: { id: 'homework-1', title: 'Test Homework' },
        },
      ]);

      const fakeDoc = { font: jest.fn(), addPage: jest.fn() };
      jest.spyOn(service as any, 'resolvePdfFont').mockReturnValue('MockFont');
      jest.spyOn(service as any, 'writeSubmissionGradingSheet').mockImplementation(() => undefined);
      jest.spyOn(service as any, 'renderPdf').mockImplementation(async (...args: unknown[]) => {
        const [build] = args as [(doc: { font: jest.Mock; addPage: jest.Mock }) => void];
        build(fakeDoc as never);
        return Buffer.from('pdf-buffer');
      });

      const result = await service.exportHomeworkSubmissionsPdf(
        'homework-1',
        ['submission-1', 'submission-2'],
        'zh-CN',
        mockTeacher,
      );

      expect(result).toEqual(Buffer.from('pdf-buffer'));
      expect(fakeDoc.font).toHaveBeenCalledWith('MockFont');
      expect((service as any).writeSubmissionGradingSheet).toHaveBeenCalledTimes(2);
      expect(fakeDoc.addPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('ai matching helpers', () => {
    const candidates = [
      { id: 'student-1', account: 'student1', name: '王小明', normalized: 'STUDENT1' },
      { id: 'student-2', account: 'student10', name: '李四', normalized: 'STUDENT10' },
    ];
    const accountMap = new Map(candidates.map((candidate) => [candidate.account, candidate]));
    const accountList = candidates.map((candidate) => candidate.account);

    it('should resolve accounts from folder names, exact filenames and separated prefixes', () => {
      expect((service as any).resolveAccount('student1/page-1.jpg', accountMap, accountList)).toBe('student1');
      expect((service as any).resolveAccount('student1.jpg', accountMap, accountList)).toBe('student1');
      expect((service as any).resolveAccount('student10_page-2.jpg', accountMap, accountList)).toBe('student10');
      expect((service as any).resolveAccount('student10page-2.jpg', accountMap, accountList)).toBeNull();
    });

    it('should resolve accounts with overrides and reject unknown override accounts', () => {
      const image = { fileKey: 'image:0:page-1.jpg', filename: 'page-1.jpg' };
      expect(
        (service as any).resolveAccountWithOverrides(
          image,
          accountMap,
          accountList,
          new Map([['image:0:page-1.jpg', 'student1']]),
        ),
      ).toBe('student1');
      expect(
        (service as any).resolveAccountWithOverrides(
          image,
          accountMap,
          accountList,
          new Map([['image:0:page-1.jpg', 'missing']]),
        ),
      ).toBeNull();
    });

    it('should short-circuit resolveAccountForImage when no candidates exist', async () => {
      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:page-1.jpg', filename: 'page-1.jpg' },
        candidates: [],
        accountMap: new Map(),
        accountList: [],
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'ACCOUNT_NOT_FOUND',
        }),
      );
    });

    it('should return override match outcomes before OCR/LLM matching', async () => {
      const image = { fileKey: 'image:0:page-1.jpg', filename: 'page-1.jpg' };

      const success = await (service as any).resolveAccountForImage({
        image,
        candidates,
        accountMap,
        accountList,
        overrides: new Map([['image:0:page-1.jpg', 'student1']]),
        ocrConfig: {},
        llmRuntime: {},
      });
      const failure = await (service as any).resolveAccountForImage({
        image,
        candidates,
        accountMap,
        accountList,
        overrides: new Map([['image:0:page-1.jpg', 'missing']]),
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(success).toEqual(
        expect.objectContaining({
          account: 'student1',
          matchedBy: 'override',
          confidence: 1,
        }),
      );
      expect(failure).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'OVERRIDE_NOT_FOUND',
        }),
      );
    });

    it('should return filename matches before OCR/LLM matching', async () => {
      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:student10_page-2.jpg', filename: 'student10_page-2.jpg' },
        candidates,
        accountMap,
        accountList,
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: 'student10',
          matchedBy: 'filename',
          confidence: 0.9,
        }),
      );
    });

    it('should surface OCR failure results when OCR extraction returns an error', async () => {
      jest.spyOn(service as any, 'extractOcrText').mockResolvedValue({ text: '', error: 'network down' });

      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:page-ocr.jpg', filename: 'page-ocr.jpg' },
        candidates,
        accountMap,
        accountList,
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'OCR_FAILED',
        }),
      );
    });

    it('should surface OCR empty results when OCR text is blank', async () => {
      jest.spyOn(service as any, 'extractOcrText').mockResolvedValue({ text: '' });

      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:page-empty.jpg', filename: 'page-empty.jpg' },
        candidates,
        accountMap,
        accountList,
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'OCR_EMPTY',
        }),
      );
    });

    it('should prefer the longest direct OCR account match', async () => {
      jest.spyOn(service as any, 'extractOcrText').mockResolvedValue({ text: 'student10 student1' });

      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:page-direct-ocr.jpg', filename: 'page-direct-ocr.jpg' },
        candidates,
        accountMap,
        accountList,
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: 'student10',
          matchedBy: 'ocr',
          confidence: 0.9,
        }),
      );
    });

    it('should return AI_NOT_CONFIGURED with extracted Chinese name info when OCR finds no account', async () => {
      jest.spyOn(service as any, 'extractOcrText').mockResolvedValue({ text: '作文作者王小明' });

      const result = await (service as any).resolveAccountForImage({
        image: { fileKey: 'image:0:page-llm.jpg', filename: 'page-llm.jpg' },
        candidates,
        accountMap,
        accountList,
        overrides: null,
        ocrConfig: {},
        llmRuntime: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'AI_NOT_CONFIGURED',
          extractedName: { zh: '王小明', pinyin: 'wangxiaoming' },
        }),
      );
    });

    it('should extract and validate Chinese names while filtering duplicates and invalid phrases', () => {
      const extracted = (service as any).extractChineseNames('作者：王小明 Dear Smith 王小明 李四 亲爱的老师');

      expect(extracted).toEqual(expect.arrayContaining(['王小明', '李四']));
      expect(extracted.filter((name: string) => name === '王小明')).toHaveLength(1);
      expect((service as any).isValidChineseName('王小明')).toBe(true);
      expect((service as any).isValidChineseName('亲爱的老师')).toBe(false);
      expect((service as any).isValidChineseName('阿小明')).toBe(false);
    });

    it('should convert Chinese names to lowercase pinyin accounts', () => {
      expect((service as any).nameToPinyinAccount('李四')).toBe('lisi');
      expect((service as any).nameToPinyinAccount('张伟')).toBe('zhangwei');
    });
  });

  describe('batch helper utilities', () => {
    it('should return undefined when thumbnail generation fails', async () => {
      jest.spyOn(service as any, 'loadImageBuffer').mockRejectedValue(new Error('invalid image'));

      const url = await (service as any).generateThumbnail(
        { fileKey: 'image:0:page-1.jpg', filename: 'page-1.jpg', mimeType: 'image/jpeg' },
        'image:0:page-1.jpg',
      );

      expect(url).toBeUndefined();
      expect(storageService.putObject).not.toHaveBeenCalled();
    });

    it('should store staging images with normalized file keys', async () => {
      jest.spyOn(service as any, 'loadImageBuffer').mockResolvedValue(Buffer.from('staging-buffer'));

      await (service as any).storeStagingImage(
        { fileKey: 'image:0:page/1.jpg', filename: 'page-1.jpg', mimeType: 'image/png' },
        'image:0:page/1.jpg',
        'homework-1',
      );

      expect(storageService.putObject).toHaveBeenCalledWith(
        'staging/homework-1/image_0_page_1.jpg',
        Buffer.from('staging-buffer'),
        'image/png',
      );
    });

    it('should cleanup existing staging images and skip deletion when none exist', async () => {
      storageService.listObjectKeys.mockResolvedValueOnce([]).mockResolvedValueOnce([
        'staging/homework-1/image-1',
        'staging/homework-1/image-2',
      ]);
      storageService.deleteObjects.mockResolvedValue({ ok: 2, failed: [] });

      await (service as any).cleanupStagingImages('homework-1');
      expect(storageService.deleteObjects).not.toHaveBeenCalled();

      await (service as any).cleanupStagingImages('homework-1');
      expect(storageService.deleteObjects).toHaveBeenCalledWith([
        'staging/homework-1/image-1',
        'staging/homework-1/image-2',
      ]);
    });

    it('should swallow staging cleanup errors', async () => {
      storageService.listObjectKeys.mockRejectedValue(new Error('cleanup failed'));

      await expect((service as any).cleanupStagingImages('homework-1')).resolves.toBeUndefined();
    });

    it('should extract trimmed OCR text from the OCR service', async () => {
      jest.spyOn(service as any, 'loadImageBuffer').mockResolvedValue(Buffer.from('ocr-image'));
      ocrService.recognize.mockResolvedValue({ text: '  student1  ' } as never);

      const result = await (service as any).extractOcrText(
        { fileKey: 'image:0:ocr.jpg', filename: 'ocr.jpg', mimeType: 'image/jpeg' },
        { apiKey: 'test-key' },
      );

      expect(result).toEqual({ text: 'student1' });
      expect(ocrService.recognize).toHaveBeenCalledWith(Buffer.from('ocr-image'), { apiKey: 'test-key' });
    });

    it('should return OCR error info when OCR recognition throws', async () => {
      jest.spyOn(service as any, 'loadImageBuffer').mockResolvedValue(Buffer.from('ocr-image'));
      ocrService.recognize.mockRejectedValue(new Error('ocr failed'));

      const result = await (service as any).extractOcrText(
        { fileKey: 'image:0:ocr.jpg', filename: 'ocr.jpg', mimeType: 'image/jpeg' },
        {},
      );

      expect(result).toEqual({ text: '', error: 'ocr failed' });
    });

    it('should normalize noisy OCR text when finding accounts and select the longest match', () => {
      const helperCandidates = [
        { id: 'student-1', account: 'student1', name: 'One', normalized: 'STUDENT1' },
        { id: 'student-2', account: 'student10', name: 'Ten', normalized: 'STUDENT10' },
      ];

      const matches = (service as any).findAccountMatches('student-10 / student_1', helperCandidates);

      expect(matches.map((item: { account: string }) => item.account)).toEqual(['student1', 'student10']);
      expect((service as any).findAccountMatches('@@@', helperCandidates)).toEqual([]);
      expect((service as any).selectLongestMatches(matches).map((item: { account: string }) => item.account)).toEqual([
        'student10',
      ]);
      expect((service as any).selectLongestMatches([])).toEqual([]);
    });
  });

  describe('zip and parse helpers', () => {
    it('should parse mapping, excluded file keys and name overrides safely', () => {
      expect(
        Array.from(
          ((service as any).parseMappingOverrides('{"image:0:page-1.jpg":" student1 ","ignore":"   "}') as Map<string, string>).entries(),
        ),
      ).toEqual([['image:0:page-1.jpg', 'student1']]);
      expect((service as any).parseMappingOverrides('invalid-json')).toBeNull();

      expect(Array.from((service as any).parseExcludedFileKeys('["a","b"]') as Set<string>).sort()).toEqual([
        'a',
        'b',
      ]);
      expect(Array.from((service as any).parseExcludedFileKeys('invalid-json') as Set<string>)).toEqual([]);

      expect(
        Array.from(
          ((service as any).parseNameOverrides('{"image:0:page-1.jpg":" 张三 ","empty":"  "}') as Map<string, string>).entries(),
        ),
      ).toEqual([['image:0:page-1.jpg', '张三']]);
      expect((service as any).parseNameOverrides('invalid-json')).toBeNull();
    });

    it('should load image buffers from memory or disk and reject missing image sources', async () => {
      const tempPath = join(tmpdir(), `submissions-spec-${Date.now()}-${Math.random()}.txt`);
      await writeFile(tempPath, Buffer.from('temp-image'));

      try {
        await expect(
          (service as any).loadImageBuffer({ fileKey: 'image:0:memory.jpg', filename: 'memory.jpg', buffer: Buffer.from('mem') }),
        ).resolves.toEqual(Buffer.from('mem'));
        await expect(
          (service as any).loadImageBuffer({ fileKey: 'image:0:file.jpg', filename: 'file.jpg', path: tempPath }),
        ).resolves.toEqual(Buffer.from('temp-image'));
        await expect(
          (service as any).loadImageBuffer({ fileKey: 'image:0:missing.jpg', filename: 'missing.jpg' }),
        ).rejects.toThrow('Missing image buffer');
      } finally {
        await unlink(tempPath).catch(() => undefined);
      }
    });

    it('should resolve image extensions from filenames or mime type fallbacks', () => {
      expect((service as any).resolveImageExtension({ fileKey: '1', filename: 'essay.png', mimeType: 'image/jpeg' })).toBe('png');
      expect((service as any).resolveImageExtension({ fileKey: '2', filename: 'essay', mimeType: 'image/png' })).toBe('png');
      expect((service as any).resolveImageExtension({ fileKey: '3', filename: 'essay.unknown', mimeType: 'image/jpeg' })).toBe('jpg');
    });

    it('should extract zip entries while skipping hidden, excluded and non-image files in dryRun mode', async () => {
      const zip = new AdmZip();
      zip.addFile('folder/page-1.jpg', Buffer.from('img-1'));
      zip.addFile('notes.txt', Buffer.from('note'));
      zip.addFile('__MACOSX/hidden.jpg', Buffer.from('hidden'));
      zip.addFile('.DS_Store', Buffer.from('meta'));

      const options = {
        images: [] as Array<Record<string, unknown>>,
        skipped: [] as Array<Record<string, unknown>>,
        totalUncompressed: { value: 0 },
        dryRun: true,
        excludedKeys: new Set(['zip:folder/page-1.jpg']),
      };

      await (service as any).extractZipEntries(
        { buffer: zip.toBuffer(), originalname: 'batch.zip' },
        options,
      );

      expect(options.images).toEqual([]);
      expect(options.skipped).toEqual([
        expect.objectContaining({ file: 'folder/page-1.jpg', reason: 'USER_EXCLUDED', fileKey: 'zip:folder/page-1.jpg' }),
        expect.objectContaining({ file: 'notes.txt', reason: 'NON_IMAGE', fileKey: 'zip:notes.txt' }),
      ]);
    });

    it('should extract valid zip images in non-dry-run mode and enforce image count limits', async () => {
      const zip = new AdmZip();
      zip.addFile('folder/page-1.png', Buffer.from('img-1'));

      const options = {
        images: [] as Array<Record<string, unknown>>,
        skipped: [] as Array<Record<string, unknown>>,
        totalUncompressed: { value: 0 },
        dryRun: false,
      };

      await (service as any).extractZipEntries(
        { buffer: zip.toBuffer(), originalname: 'batch.zip' },
        options,
      );

      expect(options.images).toEqual([
        expect.objectContaining({
          fileKey: 'zip:folder/page-1.png',
          filename: 'folder/page-1.png',
          mimeType: 'image/png',
          buffer: Buffer.from('img-1'),
        }),
      ]);

      const limitOptions = {
        images: Array.from({ length: 101 }, (_, index) => ({ fileKey: `image:${index}` })),
        skipped: [] as Array<Record<string, unknown>>,
        totalUncompressed: { value: 0 },
        dryRun: true,
      };

      await expect(
        (service as any).extractZipEntries(
          { buffer: zip.toBuffer(), originalname: 'batch.zip' },
          limitOptions,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('llm matching helpers', () => {
    const candidates = [
      { id: 'student-1', account: 'student1', name: '王小明', normalized: 'STUDENT1' },
      { id: 'student-2', account: 'student2', name: '李四', normalized: 'STUDENT2' },
    ];
    const accountMap = new Map(candidates.map((candidate) => [candidate.account, candidate]));

    it('should return AI_FAILED when the llm request throws', async () => {
      jest.spyOn(service as any, 'fetchCompletion').mockRejectedValue(new Error('llm down'));

      const result = await (service as any).matchWithLlm({
        text: '作文作者王小明',
        candidates,
        accountMap,
        llmRuntime: { baseUrl: 'http://llm', model: 'test-model' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'AI_FAILED',
          extractedName: { zh: '王小明', pinyin: 'wangxiaoming' },
        }),
      );
    });

    it('should retry without response_format when the provider rejects json_object output and then return ai matches', async () => {
      const fetchCompletion = jest
        .spyOn(service as any, 'fetchCompletion')
        .mockResolvedValueOnce({ ok: false, status: 422, errorText: 'response_format unsupported', data: null })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          errorText: '',
          data: { choices: [{ message: { content: '{"matchedAccount":"student1","confidence":"0.8"}' } }] },
        });

      const result = await (service as any).matchWithLlm({
        text: 'student1',
        candidates,
        accountMap,
        llmRuntime: {
          baseUrl: 'http://llm',
          model: 'test-model',
          path: '/chat/completions',
          topP: 0.9,
          presencePenalty: 0.1,
          frequencyPenalty: 0.2,
          stop: ['END'],
          maxTokens: 300,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: 'student1',
          matchedBy: 'ai',
          confidence: 0.8,
        }),
      );

      const firstPayload = fetchCompletion.mock.calls[0][1] as Record<string, unknown>;
      const secondPayload = fetchCompletion.mock.calls[1][1] as Record<string, unknown>;

      expect(fetchCompletion).toHaveBeenCalledTimes(2);
      expect(fetchCompletion.mock.calls[0][0]).toBe('http://llm/chat/completions');
      expect(firstPayload.response_format).toEqual({ type: 'json_object' });
      expect(firstPayload.stop).toEqual(['END']);
      expect(firstPayload.top_p).toBe(0.9);
      expect(firstPayload.presence_penalty).toBe(0.1);
      expect(firstPayload.frequency_penalty).toBe(0.2);
      expect(secondPayload.response_format).toBeUndefined();
    });

    it('should return AI_PARSE_FAILED when llm content is missing', async () => {
      jest.spyOn(service as any, 'fetchCompletion').mockResolvedValue({
        ok: true,
        status: 200,
        errorText: '',
        data: { choices: [{}] },
      });

      const result = await (service as any).matchWithLlm({
        text: '作文作者王小明',
        candidates,
        accountMap,
        llmRuntime: { baseUrl: 'http://llm', model: 'test-model' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'AI_PARSE_FAILED',
          extractedName: { zh: '王小明', pinyin: 'wangxiaoming' },
        }),
      );
    });

    it('should return AI_AMBIGUOUS when the llm match confidence is too low', async () => {
      jest.spyOn(service as any, 'fetchCompletion').mockResolvedValue({
        ok: true,
        status: 200,
        errorText: '',
        data: {
          choices: [
            {
              text: '```json\n{"matchedAccount":"student1","confidence":0.4,"analysisZh":"不确定","analysisEn":"Unsure"}\n```',
            },
          ],
        },
      });

      const result = await (service as any).matchWithLlm({
        text: '作文作者王小明',
        candidates,
        accountMap,
        llmRuntime: { baseUrl: 'http://llm', model: 'test-model' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'AI_AMBIGUOUS',
          confidence: 0.4,
          analysisZh: '不确定',
          analysisEn: 'Unsure',
        }),
      );
    });

    it('should parse llm helper values and return AI_NO_MATCH for unknown accounts', async () => {
      jest.spyOn(service as any, 'fetchCompletion').mockResolvedValue({
        ok: true,
        status: 200,
        errorText: '',
        data: {
          choices: [{ message: { content: '{"matchedAccount":"missing","confidence":1.2}' } }],
        },
      });

      const result = await (service as any).matchWithLlm({
        text: '作文作者王小明',
        candidates,
        accountMap,
        llmRuntime: { baseUrl: 'http://llm/v1/chat/completions', model: 'test-model' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          account: null,
          reason: 'AI_NO_MATCH',
          confidence: 1,
          extractedName: { zh: '王小明', pinyin: 'wangxiaoming' },
        }),
      );
      expect((service as any).parseMatchResponse('```json\n{"matchedAccount":"student1"}\n```')).toEqual({
        matchedAccount: 'student1',
      });
      expect((service as any).parseMatchResponse('not-json')).toBeNull();
      expect((service as any).extractLlmContent({ choices: [{ text: '  hello  ' }] })).toBe('hello');
      expect(() => (service as any).extractLlmContent({ choices: [{}] })).toThrow('LLM response missing content');
      expect((service as any).normalizeConfidence('0.75')).toBe(0.75);
      expect((service as any).normalizeConfidence(-1)).toBe(0);
      expect((service as any).resolveLlmApiUrl({ baseUrl: 'http://llm', path: 'custom' })).toBe('http://llm/custom');
      expect((service as any).resolveLlmApiUrl({ baseUrl: 'http://llm/v1/chat/completions' })).toBe(
        'http://llm/v1/chat/completions',
      );
      expect((service as any).isResponseFormatUnsupported(422, 'response_format unsupported')).toBe(true);
      expect((service as any).isResponseFormatUnsupported(500, 'response_format unsupported')).toBe(false);
    });

    it('should wrap completion requests, parse json responses and preserve error payloads', async () => {
      const fetchWithTimeout = jest.spyOn(service as any, 'fetchWithTimeout');
      fetchWithTimeout
        .mockResolvedValueOnce(
          new Response('{"choices":[{"message":{"content":"{\\"matchedAccount\\":null}"}}]}', { status: 200 }),
        )
        .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
        .mockResolvedValueOnce(new Response('not-json', { status: 200 }));

      const runtime = {
        headers: { 'X-Test': '1' },
        apiKey: 'secret',
        timeoutMs: 1234,
      };

      const success = await (service as any).fetchCompletion('http://llm', { model: 'test' }, runtime);
      const failure = await (service as any).fetchCompletion('http://llm', { model: 'test' }, runtime);
      const invalidJson = await (service as any).fetchCompletion('http://llm', { model: 'test' }, runtime);

      expect(success).toEqual({
        ok: true,
        status: 200,
        errorText: '',
        data: { choices: [{ message: { content: '{"matchedAccount":null}' } }] },
      });
      expect(failure).toEqual({ ok: false, status: 502, errorText: 'bad gateway', data: null });
      expect(invalidJson).toEqual({ ok: true, status: 200, errorText: '', data: null });
      expect(fetchWithTimeout).toHaveBeenNthCalledWith(
        1,
        'http://llm',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer secret',
            'X-Test': '1',
          },
          body: JSON.stringify({ model: 'test' }),
        }),
        1234,
      );
    });

    it('should delegate fetchWithTimeout to global fetch and cover remaining helper edges', async () => {
      const originalFetch = global.fetch;
      const mockedFetch = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      global.fetch = mockedFetch as typeof fetch;

      try {
        const response = await (service as any).fetchWithTimeout('http://llm', { method: 'GET' }, 50);

        expect(response.status).toBe(200);
        expect(mockedFetch).toHaveBeenCalledWith(
          'http://llm',
          expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
        );
      } finally {
        global.fetch = originalFetch;
      }

      expect((service as any).normalizeConfidence('abc')).toBeUndefined();
      expect((service as any).parseMatchResponse('   ')).toBeNull();
      expect((service as any).resolveLlmApiUrl({ baseUrl: 'http://llm', path: 'https://alt.example/v1/chat/completions' })).toBe(
        'https://alt.example/v1/chat/completions',
      );
    });
  });

  describe('student resolution helpers', () => {
    const candidates = [
      { id: 'student-1', account: 'zhangsan', name: '张三', normalized: 'ZHANGSAN' },
      { id: 'student-2', account: 'lisi', name: '李 四', normalized: 'LISI' },
    ];

    it('should generate normalized accounts and validate account-like values', () => {
      expect((service as any).generateAccountFromName(' 张三 ')).toBe('zhangsan');
      expect((service as any).generateAccountFromName('')).toBe('');
      expect((service as any).looksLikeAccount('student_1')).toBe(true);
      expect((service as any).looksLikeAccount('bad-account!')).toBe(false);
    });

    it('should find students by exact or whitespace-normalized names', () => {
      expect((service as any).findStudentByName('张三', candidates)).toEqual(candidates[0]);
      expect((service as any).findStudentByName('李四', candidates)).toEqual(candidates[1]);
      expect((service as any).findStudentByName('王五', candidates)).toBeNull();
    });

    it('should reuse existing class students before any database creation', async () => {
      const result = await (service as any).resolveStudentByName(' 张三 ', 'class-1', candidates);

      expect(result).toEqual({ account: 'zhangsan', name: '张三', isNew: false });
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.enrollment.create).not.toHaveBeenCalled();
    });

    it('should reuse existing users from other classes and enroll them into the current class', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue({ id: 'student-existing', account: 'wangwu' });
      prismaService.enrollment.create = jest.fn().mockResolvedValue({ id: 'enrollment-1' });

      const result = await (service as any).resolveStudentByName('王五', 'class-1', candidates);

      expect(result).toEqual({ account: 'wangwu', name: '王五', isNew: false });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({ where: { account: 'wangwu' } });
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.enrollment.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          studentId: 'student-existing',
        },
      });
    });

    it('should create and enroll new students when the generated account is unused', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue({ id: 'student-new', account: 'wangwu', name: '王五' });
      prismaService.enrollment.create = jest.fn().mockResolvedValue({ id: 'enrollment-1' });

      const result = await (service as any).resolveStudentByName('王五', 'class-1', candidates);

      expect(result).toEqual({ account: 'wangwu', name: '王五', isNew: true });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          account: 'wangwu',
          name: '王五',
          role: Role.STUDENT,
          passwordHash: expect.any(String),
        }),
      });
      expect(prismaService.enrollment.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          studentId: 'student-new',
        },
      });
    });

    it('should return null when a generated account is invalid', async () => {
      jest.spyOn(service as any, 'generateAccountFromName').mockReturnValue('bad-account!');

      await expect((service as any).resolveStudentByName('王五', 'class-1', candidates)).resolves.toBeNull();
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.create).not.toHaveBeenCalled();
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

    it('should reject regrade requests for actively processing submissions', async () => {
      jest.spyOn(service, 'getSubmission').mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.PROCESSING,
        updatedAt: new Date(),
        images: [],
        student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        homework: { id: 'homework-1', title: 'Test Homework', classId: 'class-1' },
      } as never);

      await expect(service.requestRegrade('submission-1', {}, mockStudent)).rejects.toThrow(BadRequestException);

      expect(prismaService.submission.update).not.toHaveBeenCalled();
      expect(queueService.enqueueRegrade).not.toHaveBeenCalled();
    });

    it('should requeue stuck processing submissions when explicit grading options are provided', async () => {
      jest.spyOn(service, 'getSubmission').mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.PROCESSING,
        updatedAt: new Date(Date.now() - 11 * 60 * 1000),
        images: [],
        student: { id: 'student-1', name: 'Test Student', account: 'student1' },
        homework: { id: 'homework-1', title: 'Test Homework', classId: 'class-1' },
      } as never);
      prismaService.submission.update = jest.fn().mockResolvedValue(mockSubmission);

      const result = await service.requestRegrade(
        'submission-1',
        { mode: 'quality', needRewrite: true },
        mockStudent,
      );

      expect(result).toEqual({ submissionId: 'submission-1', status: SubmissionStatus.QUEUED });
      expect(queueService.enqueueRegrade).toHaveBeenCalledWith('submission-1', {
        mode: 'quality',
        needRewrite: true,
      });
    });
  });
});
