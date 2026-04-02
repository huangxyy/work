import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Express, Response } from 'express';
import { Role, SubmissionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { isValidImageBuffer } from '../common/security';
import { StorageService } from '../storage/storage.service';
import { SubmissionsController } from './submissions.controller';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RegradeSubmissionDto } from './dto/regrade-submission.dto';
import { StudentSubmissionsQueryDto } from './dto/student-submissions-query.dto';
import { SubmissionsService } from './submissions.service';

jest.mock('../common/security', () => ({
  isValidImageBuffer: jest.fn(),
}));

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let submissionsService: {
    createSubmission: jest.Mock;
    listStudentSubmissionsWithQuery: jest.Mock;
    exportStudentSubmissionsCsv: jest.Mock;
    getSubmission: jest.Mock;
    requestRegrade: jest.Mock;
  };
  let storageService: {
    getPresignedUrl: jest.Mock;
  };

  const mockStudent: AuthUser = {
    id: 'student-1',
    account: 'student1',
    name: 'Test Student',
    role: Role.STUDENT,
  };

  const mockIsValidImageBuffer = isValidImageBuffer as jest.MockedFunction<typeof isValidImageBuffer>;

  beforeEach(async () => {
    submissionsService = {
      createSubmission: jest.fn(),
      listStudentSubmissionsWithQuery: jest.fn(),
      exportStudentSubmissionsCsv: jest.fn(),
      getSubmission: jest.fn(),
      requestRegrade: jest.fn(),
    };
    storageService = {
      getPresignedUrl: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SubmissionsController],
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

    controller = moduleRef.get(SubmissionsController);
    mockIsValidImageBuffer.mockReset();
  });

  it('should reject create requests without files', async () => {
    const body: CreateSubmissionDto = { homeworkId: 'homework-1' };

    await expect(controller.create(body, [], { user: mockStudent })).rejects.toThrow(BadRequestException);

    expect(submissionsService.createSubmission).not.toHaveBeenCalled();
  });

  it('should reject create requests with invalid image buffers', async () => {
    const body: CreateSubmissionDto = { homeworkId: 'homework-1' };
    const files = [
      {
        originalname: 'essay.jpg',
        buffer: Buffer.from('bad-file'),
      } as Express.Multer.File,
    ];
    mockIsValidImageBuffer.mockReturnValue(false);

    await expect(controller.create(body, files, { user: mockStudent })).rejects.toThrow(
      '文件 "essay.jpg" 不是有效的图片格式',
    );

    expect(submissionsService.createSubmission).not.toHaveBeenCalled();
  });

  it('should forward valid create requests to submissionsService', async () => {
    const body: CreateSubmissionDto = { homeworkId: 'homework-1', mode: 'quality', needRewrite: true };
    const files = [
      {
        originalname: 'essay.jpg',
        buffer: Buffer.from('valid-image'),
      } as Express.Multer.File,
    ];
    mockIsValidImageBuffer.mockReturnValue(true);
    submissionsService.createSubmission.mockResolvedValue({ submissionId: 'submission-1', status: SubmissionStatus.QUEUED });

    const result = await controller.create(body, files, { user: mockStudent });

    expect(result).toEqual({ submissionId: 'submission-1', status: SubmissionStatus.QUEUED });
    expect(submissionsService.createSubmission).toHaveBeenCalledWith(body, files, mockStudent);
  });

  it('should forward list requests for the authenticated student', async () => {
    const query: StudentSubmissionsQueryDto = { status: SubmissionStatus.DONE, keyword: 'essay' };
    submissionsService.listStudentSubmissionsWithQuery.mockResolvedValue([{ id: 'submission-1' }]);

    const result = await controller.listForStudent(query, { user: mockStudent });

    expect(result).toEqual([{ id: 'submission-1' }]);
    expect(submissionsService.listStudentSubmissionsWithQuery).toHaveBeenCalledWith(mockStudent, query);
  });

  it('should export student submissions with csv headers', async () => {
    const query: StudentSubmissionsQueryDto = { lang: 'zh-CN' };
    const res = { setHeader: jest.fn() } as unknown as Response;
    submissionsService.exportStudentSubmissionsCsv.mockResolvedValue('csv-content');

    const result = await controller.exportForStudent(query, { user: mockStudent }, res);

    expect(result).toBe('csv-content');
    expect(submissionsService.exportStudentSubmissionsCsv).toHaveBeenCalledWith(mockStudent, query);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="student-submissions.csv"');
  });

  it('should return submission details with presigned image urls', async () => {
    const createdAt = new Date('2026-03-07T00:00:00.000Z');
    const updatedAt = new Date('2026-03-07T01:00:00.000Z');
    submissionsService.getSubmission.mockResolvedValue({
      id: 'submission-1',
      status: SubmissionStatus.DONE,
      images: [{ id: 'image-1', objectKey: 'submissions/object-1' }],
      student: { id: 'student-1', name: 'Test Student', account: 'student1' },
      homework: { id: 'homework-1', title: 'Essay' },
      createdAt,
      updatedAt,
      ocrText: 'ocr-text',
      gradingJson: { totalScore: 95 },
      totalScore: 95,
      errorCode: null,
      errorMsg: null,
      teacherComment: 'great job',
      manualScore: 96,
      reviewedBy: 'teacher-1',
      reviewedAt: updatedAt,
    });
    storageService.getPresignedUrl.mockResolvedValue('https://example.com/presigned');

    const result = await controller.get('submission-1', { user: mockStudent });

    expect(result).toEqual({
      id: 'submission-1',
      status: SubmissionStatus.DONE,
      images: [{ id: 'image-1', url: 'https://example.com/presigned' }],
      student: { id: 'student-1', name: 'Test Student', account: 'student1' },
      homework: { id: 'homework-1', title: 'Essay' },
      createdAt,
      updatedAt,
      ocrText: 'ocr-text',
      gradingJson: { totalScore: 95 },
      totalScore: 95,
      errorCode: null,
      errorMsg: null,
      teacherComment: 'great job',
      manualScore: 96,
      reviewedBy: 'teacher-1',
      reviewedAt: updatedAt,
    });
    expect(submissionsService.getSubmission).toHaveBeenCalledWith('submission-1', mockStudent);
    expect(storageService.getPresignedUrl).toHaveBeenCalledWith('submissions/object-1');
  });

  it('should throw when a submission is not found', async () => {
    submissionsService.getSubmission.mockResolvedValue(null);

    await expect(controller.get('missing-submission', { user: mockStudent })).rejects.toThrow(NotFoundException);
  });

  it('should forward regrade requests', async () => {
    const body: RegradeSubmissionDto = { mode: 'cheap', needRewrite: false };
    submissionsService.requestRegrade.mockResolvedValue({ submissionId: 'submission-1', status: SubmissionStatus.QUEUED });

    const result = await controller.regrade('submission-1', body, { user: mockStudent });

    expect(result).toEqual({ submissionId: 'submission-1', status: SubmissionStatus.QUEUED });
    expect(submissionsService.requestRegrade).toHaveBeenCalledWith('submission-1', body, mockStudent);
  });
});
