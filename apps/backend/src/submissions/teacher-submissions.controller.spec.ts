import { BadRequestException, StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Express, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import { TeacherSubmissionsController } from './teacher-submissions.controller';
import { AddTeacherFeedbackDto } from './dto/add-teacher-feedback.dto';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
import { ExportHomeworkPdfQueryDto } from './dto/export-homework-pdf-query.dto';
import { ListHomeworkSubmissionsQueryDto } from './dto/list-homework-submissions-query.dto';
import { RegradeHomeworkSubmissionsDto } from './dto/regrade-homework-submissions.dto';
import { RetrySkippedDto } from './dto/retry-skipped.dto';
import { SubmissionsService } from './submissions.service';

describe('TeacherSubmissionsController', () => {
  let controller: TeacherSubmissionsController;
  let submissionsService: {
    createBatchSubmissions: jest.Mock;
    getUnsubmittedStudents: jest.Mock;
    listHomeworkSubmissions: jest.Mock;
    listBatchUploads: jest.Mock;
    getBatchUploadDetail: jest.Mock;
    exportHomeworkCsv: jest.Mock;
    exportHomeworkImagesZip: jest.Mock;
    exportHomeworkRemindersCsv: jest.Mock;
    regradeHomeworkSubmissions: jest.Mock;
    regradeBatchSubmissions: jest.Mock;
    exportHomeworkSubmissionsPdf: jest.Mock;
    addTeacherFeedback: jest.Mock;
    retrySkippedSubmission: jest.Mock;
  };
  let storageService: {
    getObject: jest.Mock;
  };

  const mockTeacher: AuthUser = {
    id: 'teacher-1',
    account: 'teacher1',
    name: 'Test Teacher',
    role: Role.TEACHER,
  };

  beforeEach(async () => {
    submissionsService = {
      createBatchSubmissions: jest.fn(),
      getUnsubmittedStudents: jest.fn(),
      listHomeworkSubmissions: jest.fn(),
      listBatchUploads: jest.fn(),
      getBatchUploadDetail: jest.fn(),
      exportHomeworkCsv: jest.fn(),
      exportHomeworkImagesZip: jest.fn(),
      exportHomeworkRemindersCsv: jest.fn(),
      regradeHomeworkSubmissions: jest.fn(),
      regradeBatchSubmissions: jest.fn(),
      exportHomeworkSubmissionsPdf: jest.fn(),
      addTeacherFeedback: jest.fn(),
      retrySkippedSubmission: jest.fn(),
    };
    storageService = {
      getObject: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TeacherSubmissionsController],
      providers: [
        {
          provide: SubmissionsService,
          useValue: submissionsService,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    controller = moduleRef.get(TeacherSubmissionsController);
  });

  describe('listing helpers and thumbnails', () => {
    it('should forward unsubmitted student requests', async () => {
      submissionsService.getUnsubmittedStudents.mockResolvedValue([{ id: 'student-1' }]);

      const result = await controller.getUnsubmittedStudents('homework-1', { user: mockTeacher });

      expect(result).toEqual([{ id: 'student-1' }]);
      expect(submissionsService.getUnsubmittedStudents).toHaveBeenCalledWith('homework-1', mockTeacher);
    });

    it('should forward homework submission list requests with pagination options', async () => {
      const query: ListHomeworkSubmissionsQueryDto = {
        homeworkId: 'homework-1',
        cursor: 'cursor-1',
        limit: 10,
      };
      submissionsService.listHomeworkSubmissions.mockResolvedValue([{ id: 'submission-1' }]);

      const result = await controller.list(query, { user: mockTeacher });

      expect(result).toEqual([{ id: 'submission-1' }]);
      expect(submissionsService.listHomeworkSubmissions).toHaveBeenCalledWith('homework-1', mockTeacher, {
        cursor: 'cursor-1',
        limit: 10,
      });
    });

    it('should reject thumbnail requests with invalid file keys', async () => {
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;

      await expect(controller.getThumbnail('../bad-key', res)).rejects.toThrow(BadRequestException);

      expect(storageService.getObject).not.toHaveBeenCalled();
    });

    it('should stream thumbnail images with cache headers', async () => {
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
      const image = Buffer.from('thumb');
      storageService.getObject.mockResolvedValue(image);

      const result = await controller.getThumbnail('valid_key-123', res);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(storageService.getObject).toHaveBeenCalledWith('thumbnails/valid_key-123.jpg');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    });

    it('should return 404 when a thumbnail does not exist', async () => {
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
      storageService.getObject.mockRejectedValue(new Error('missing'));

      await controller.getThumbnail('missing-thumb', res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Thumbnail not found');
    });
  });

  describe('createBatch', () => {
    it('should decode uploaded filenames and forward the request to submissionsService', async () => {
      submissionsService.createBatchSubmissions.mockResolvedValue({ batchId: 'batch-1' });

      const body: CreateBatchSubmissionsDto = {
        homeworkId: 'homework-1',
        dryRun: true,
      };
      const imageName = '作文-张三.jpg';
      const archiveName = '批量上传.zip';
      const files: { images?: Express.Multer.File[]; archive?: Express.Multer.File[] } = {
        images: [
          {
            originalname: Buffer.from(imageName, 'utf-8').toString('latin1'),
          } as Express.Multer.File,
        ],
        archive: [
          {
            originalname: Buffer.from(archiveName, 'utf-8').toString('latin1'),
          } as Express.Multer.File,
        ],
      };

      const result = await controller.createBatch(body, files, { user: mockTeacher });

      expect(result).toEqual({ batchId: 'batch-1' });
      expect(submissionsService.createBatchSubmissions).toHaveBeenCalledTimes(1);
      const passedFiles = submissionsService.createBatchSubmissions.mock.calls[0][1] as {
        images?: Express.Multer.File[];
        archive?: Express.Multer.File[];
      };
      expect(passedFiles.images?.[0]?.originalname).toBe(imageName);
      expect(passedFiles.archive?.[0]?.originalname).toBe(archiveName);
      expect(submissionsService.createBatchSubmissions).toHaveBeenCalledWith(body, passedFiles, mockTeacher);
    });
  });

  describe('batch management and exports', () => {
    it('should forward batch list requests with pagination options', async () => {
      const query: ListHomeworkSubmissionsQueryDto = {
        homeworkId: 'homework-1',
        cursor: 'cursor-1',
        limit: 20,
      };
      submissionsService.listBatchUploads.mockResolvedValue([{ id: 'batch-1' }]);

      const result = await controller.listBatches(query, { user: mockTeacher });

      expect(result).toEqual([{ id: 'batch-1' }]);
      expect(submissionsService.listBatchUploads).toHaveBeenCalledWith('homework-1', mockTeacher, {
        cursor: 'cursor-1',
        limit: 20,
      });
    });

    it('should forward batch detail requests', async () => {
      submissionsService.getBatchUploadDetail.mockResolvedValue({ id: 'batch-1' });

      const result = await controller.getBatch('batch-1', { user: mockTeacher });

      expect(result).toEqual({ id: 'batch-1' });
      expect(submissionsService.getBatchUploadDetail).toHaveBeenCalledWith('batch-1', mockTeacher);
    });

    it('should export homework csv with the expected headers', async () => {
      const query: ListHomeworkSubmissionsQueryDto = { homeworkId: 'homework-1', lang: 'zh-CN' };
      const res = { setHeader: jest.fn() } as unknown as Response;
      submissionsService.exportHomeworkCsv.mockResolvedValue('csv-content');

      const result = await controller.exportCsv(query, { user: mockTeacher }, res);

      expect(result).toBe('csv-content');
      expect(submissionsService.exportHomeworkCsv).toHaveBeenCalledWith('homework-1', mockTeacher, 'zh-CN');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="homework-homework-1-submissions.csv"',
      );
    });

    it('should export homework images zip with the expected headers', async () => {
      const query: ListHomeworkSubmissionsQueryDto = { homeworkId: 'homework-1' };
      const res = { setHeader: jest.fn() } as unknown as Response;
      const zip = Buffer.from('zip');
      submissionsService.exportHomeworkImagesZip.mockResolvedValue(zip);

      const result = await controller.exportImages(query, { user: mockTeacher }, res);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(submissionsService.exportHomeworkImagesZip).toHaveBeenCalledWith('homework-1', mockTeacher);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="homework-homework-1-images.zip"',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', zip.length);
    });

    it('should export homework reminders csv with the expected headers', async () => {
      const query: ListHomeworkSubmissionsQueryDto = { homeworkId: 'homework-1', lang: 'en' };
      const res = { setHeader: jest.fn() } as unknown as Response;
      submissionsService.exportHomeworkRemindersCsv.mockResolvedValue('reminder-csv');

      const result = await controller.exportReminders(query, { user: mockTeacher }, res);

      expect(result).toBe('reminder-csv');
      expect(submissionsService.exportHomeworkRemindersCsv).toHaveBeenCalledWith('homework-1', mockTeacher, 'en');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="homework-homework-1-reminders.csv"',
      );
    });

    it('should export homework grading sheets pdf with the expected headers', async () => {
      const query: ExportHomeworkPdfQueryDto = {
        homeworkId: 'homework-1',
        submissionIds: ['submission-1'],
        lang: 'zh-CN',
      };
      const res = { setHeader: jest.fn() } as unknown as Response;
      const pdf = Buffer.from('pdf');
      submissionsService.exportHomeworkSubmissionsPdf.mockResolvedValue(pdf);

      const result = await controller.exportPdf(query, { user: mockTeacher }, res);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(submissionsService.exportHomeworkSubmissionsPdf).toHaveBeenCalledWith(
        'homework-1',
        ['submission-1'],
        'zh-CN',
        mockTeacher,
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="homework-homework-1-grading-sheets.pdf"',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', pdf.length);
    });
  });

  describe('regrade and feedback actions', () => {
    it('should forward homework regrade requests', async () => {
      const body: RegradeHomeworkSubmissionsDto = {
        homeworkId: 'homework-1',
        mode: 'quality',
        needRewrite: true,
      };
      submissionsService.regradeHomeworkSubmissions.mockResolvedValue({ homeworkId: 'homework-1', count: 3 });

      const result = await controller.regradeHomework(body, { user: mockTeacher });

      expect(result).toEqual({ homeworkId: 'homework-1', count: 3 });
      expect(submissionsService.regradeHomeworkSubmissions).toHaveBeenCalledWith(body, mockTeacher);
    });

    it('should forward batch retry requests', async () => {
      submissionsService.regradeBatchSubmissions.mockResolvedValue({ batchId: 'batch-1', count: 2 });

      const result = await controller.retryBatch('batch-1', { user: mockTeacher });

      expect(result).toEqual({ batchId: 'batch-1', count: 2 });
      expect(submissionsService.regradeBatchSubmissions).toHaveBeenCalledWith('batch-1', mockTeacher);
    });

    it('should forward teacher feedback requests', async () => {
      const body: AddTeacherFeedbackDto = { comment: 'Nice work', manualScore: 92 };
      submissionsService.addTeacherFeedback.mockResolvedValue({ id: 'submission-1' });

      const result = await controller.addFeedback('submission-1', body, { user: mockTeacher });

      expect(result).toEqual({ id: 'submission-1' });
      expect(submissionsService.addTeacherFeedback).toHaveBeenCalledWith('submission-1', body, mockTeacher);
    });
  });

  describe('retrySkipped', () => {
    it('should forward retrySkipped requests to submissionsService with the authenticated user', async () => {
      const body: RetrySkippedDto = {
        homeworkId: 'homework-1',
        fileKey: 'image:0:page-2.jpg',
        filename: 'page-2.jpg',
        studentName: '张三',
        batchId: 'batch-1',
      };
      submissionsService.retrySkippedSubmission.mockResolvedValue({ submissionId: 'submission-1' });

      const result = await controller.retrySkipped(body, { user: mockTeacher });

      expect(result).toEqual({ submissionId: 'submission-1' });
      expect(submissionsService.retrySkippedSubmission).toHaveBeenCalledWith(body, mockTeacher);
    });
  });
});
