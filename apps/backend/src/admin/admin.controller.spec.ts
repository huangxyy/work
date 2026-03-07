import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Express } from 'express';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: {
    getSystemConfig: jest.Mock;
    updateSystemConfig: jest.Mock;
    listLlmLogs: jest.Mock;
    clearLlmLogs: jest.Mock;
    getQueueMetrics: jest.Mock;
    retryFailedQueueJobs: jest.Mock;
    cleanQueue: jest.Mock;
    pauseQueue: jest.Mock;
    resumeQueue: jest.Mock;
    getSubmissionDiagnosis: jest.Mock;
    testOcrWithImage: jest.Mock;
    testLlmCall: jest.Mock;
  };

  const mockAdmin: AuthUser = {
    id: 'admin-1',
    account: 'admin1',
    name: 'Test Admin',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    adminService = {
      getSystemConfig: jest.fn(),
      updateSystemConfig: jest.fn(),
      listLlmLogs: jest.fn(),
      clearLlmLogs: jest.fn(),
      getQueueMetrics: jest.fn(),
      retryFailedQueueJobs: jest.fn(),
      cleanQueue: jest.fn(),
      pauseQueue: jest.fn(),
      resumeQueue: jest.fn(),
      getSubmissionDiagnosis: jest.fn(),
      testOcrWithImage: jest.fn(),
      testLlmCall: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: adminService,
        },
      ],
    }).compile();

    controller = moduleRef.get(AdminController);
  });

  it('should return system config', async () => {
    adminService.getSystemConfig.mockResolvedValue({ llm: {}, ocr: {} });

    const result = await controller.getConfig();

    expect(result).toEqual({ llm: {}, ocr: {} });
    expect(adminService.getSystemConfig).toHaveBeenCalledTimes(1);
  });

  it('should forward config updates', async () => {
    const body = { budget: { enabled: true, dailyCallLimit: 500, mode: 'soft' } };
    adminService.updateSystemConfig.mockResolvedValue({ budget: body.budget });

    const result = await controller.updateConfig(body as never);

    expect(result).toEqual({ budget: body.budget });
    expect(adminService.updateSystemConfig).toHaveBeenCalledWith(body);
  });

  it('should forward llm log list requests', async () => {
    const query = { page: 1, pageSize: 20, source: 'grading' };
    adminService.listLlmLogs.mockResolvedValue({ items: [], total: 0 });

    const result = await controller.listLlmLogs(query as never);

    expect(result).toEqual({ items: [], total: 0 });
    expect(adminService.listLlmLogs).toHaveBeenCalledWith(query);
  });

  it('should forward llm log clear requests', async () => {
    const body = { source: 'grading' };
    adminService.clearLlmLogs.mockResolvedValue({ count: 3 });

    const result = await controller.clearLlmLogs(body as never);

    expect(result).toEqual({ count: 3 });
    expect(adminService.clearLlmLogs).toHaveBeenCalledWith(body);
  });

  it('should forward queue metric requests', async () => {
    const query = { status: 'failed', limit: 10 };
    adminService.getQueueMetrics.mockResolvedValue({ items: [], summary: { failed: 0 } });

    const result = await controller.getQueueMetrics(query as never);

    expect(result).toEqual({ items: [], summary: { failed: 0 } });
    expect(adminService.getQueueMetrics).toHaveBeenCalledWith(query);
  });

  it('should forward retry-failed queue requests using only the limit field', async () => {
    adminService.retryFailedQueueJobs.mockResolvedValue({ count: 5 });

    const result = await controller.retryFailedJobs({ limit: 5 } as never);

    expect(result).toEqual({ count: 5 });
    expect(adminService.retryFailedQueueJobs).toHaveBeenCalledWith(5);
  });

  it('should forward queue clean, pause, and resume requests', async () => {
    adminService.cleanQueue.mockResolvedValue({ count: 2 });
    adminService.pauseQueue.mockResolvedValue({ paused: true });
    adminService.resumeQueue.mockResolvedValue({ paused: false });

    const cleanResult = await controller.cleanQueue({ status: 'failed', graceMs: 1000, limit: 10 } as never);
    const pauseResult = await controller.pauseQueue();
    const resumeResult = await controller.resumeQueue();

    expect(cleanResult).toEqual({ count: 2 });
    expect(pauseResult).toEqual({ paused: true });
    expect(resumeResult).toEqual({ paused: false });
    expect(adminService.cleanQueue).toHaveBeenCalledWith({ status: 'failed', graceMs: 1000, limit: 10 });
    expect(adminService.pauseQueue).toHaveBeenCalledTimes(1);
    expect(adminService.resumeQueue).toHaveBeenCalledTimes(1);
  });

  it('should forward submission diagnosis requests', async () => {
    adminService.getSubmissionDiagnosis.mockResolvedValue({ id: 'submission-1', pipeline: { status: 'DONE' } });

    const result = await controller.getSubmissionDiagnosis('submission-1');

    expect(result).toEqual({ id: 'submission-1', pipeline: { status: 'DONE' } });
    expect(adminService.getSubmissionDiagnosis).toHaveBeenCalledWith('submission-1');
  });

  it('should reject OCR test requests without an image buffer', async () => {
    await expect(controller.testOcr(undefined as never)).rejects.toThrow(BadRequestException);

    expect(adminService.testOcrWithImage).not.toHaveBeenCalled();
  });

  it('should forward OCR image buffers to the admin service', async () => {
    const buffer = Buffer.from('image');
    adminService.testOcrWithImage.mockResolvedValue({ text: 'hello' });

    const result = await controller.testOcr({ buffer } as Express.Multer.File);

    expect(result).toEqual({ text: 'hello' });
    expect(adminService.testOcrWithImage).toHaveBeenCalledWith(buffer);
  });

  it('should forward llm test requests with the authenticated admin', async () => {
    const body = { prompt: 'hello' };
    adminService.testLlmCall.mockResolvedValue({ text: 'world' });

    const result = await controller.testLlm(body as never, { user: mockAdmin });

    expect(result).toEqual({ text: 'world' });
    expect(adminService.testLlmCall).toHaveBeenCalledWith(body, mockAdmin);
  });
});
