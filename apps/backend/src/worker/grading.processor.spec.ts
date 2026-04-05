import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { SubmissionStatus } from '@prisma/client';
import { GradingProcessor } from './grading.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GradingService } from '../grading/grading.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { NotificationService } from '../notifications/notification.service';

describe('GradingProcessor', () => {
  let processor: GradingProcessor;
  let prisma: PrismaService;
  let storage: StorageService;
  let gradingService: GradingService;
  let systemConfigService: SystemConfigService;
  let baiduOcrService: BaiduOcrService;
  let notificationService: NotificationService;

  const mockPrisma = {
    submission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStorage = {
    getObject: jest.fn(),
  };

  const mockGradingService = {
    grade: jest.fn(),
  };

  const mockSystemConfigService = {
    getValue: jest.fn(),
  };

  const mockBaiduOcrService = {
    recognize: jest.fn(),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: GradingService, useValue: mockGradingService },
        { provide: SystemConfigService, useValue: mockSystemConfigService },
        { provide: BaiduOcrService, useValue: mockBaiduOcrService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    processor = module.get<GradingProcessor>(GradingProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);
    gradingService = module.get<GradingService>(GradingService);
    systemConfigService = module.get<SystemConfigService>(SystemConfigService);
    baiduOcrService = module.get<BaiduOcrService>(BaiduOcrService);
    notificationService = module.get<NotificationService>(NotificationService);

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'BAIDU_OCR_API_KEY') return 'test-api-key';
      if (key === 'BAIDU_OCR_SECRET_KEY') return 'test-secret-key';
      return undefined;
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkerOptions', () => {
    it('should return worker options with correct concurrency', () => {
      const options = processor['getWorkerOptions']();

      expect(options).toHaveProperty('concurrency');
      expect(options).toHaveProperty('lockDuration', 6 * 60 * 1000);
      expect(options).toHaveProperty('stalledInterval', 60 * 1000);
      expect(options).toHaveProperty('maxStalledCount', 2);
      expect(options.concurrency).toBeGreaterThan(0);
    });
  });

  describe('process - demo job', () => {
    it('should process demo job successfully', async () => {
      const job = {
        id: '1',
        name: 'demo',
        data: { message: 'test message' },
      } as unknown as Job<{ message?: string }>;

      const result = await processor.process(job);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('durationMs');
      expect((result as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(250);
    });

    it('should process demo job without message', async () => {
      const job = {
        id: '2',
        name: 'demo',
        data: {},
      } as unknown as Job<{ message?: string }>;

      const result = await processor.process(job);

      expect(result).toHaveProperty('durationMs');
    });
  });

  describe('process - unhandled job', () => {
    it('should return null for unknown job type', async () => {
      const job = {
        id: '3',
        name: 'unknown',
        data: {},
      } as unknown as Job;

      const result = await processor.process(job);

      expect(result).toBeNull();
    });

    it('should return null for grading job without submissionId', async () => {
      const job = {
        id: '4',
        name: 'grading',
        data: {},
      } as unknown as Job;

      const result = await processor.process(job);

      expect(result).toBeNull();
    });
  });

  describe('process - grading job', () => {
    const mockSubmission = {
      id: 'sub-1',
      studentId: 'student-1',
      status: SubmissionStatus.QUEUED,
      ocrText: null,
      images: [
        { id: 'img-1', objectKey: 'test-key-1', createdAt: new Date() },
        { id: 'img-2', objectKey: 'test-key-2', createdAt: new Date() },
      ],
    };

    const mockGradingResponse = {
      result: {
        totalScore: 85,
        content: {},
      },
      meta: {
        providerName: 'deepseek',
        model: 'deepseek-chat',
        degraded: false,
        degradeReason: null,
      },
    };

    beforeEach(() => {
      mockPrisma.submission.findUnique.mockResolvedValue(mockSubmission);
      mockPrisma.submission.update.mockResolvedValue(mockSubmission);
      mockStorage.getObject.mockResolvedValue(Buffer.from('test image'));
      mockBaiduOcrService.recognize.mockResolvedValue({
        text: 'This is a test essay.',
      });
      mockSystemConfigService.getValue.mockResolvedValue({});
      mockGradingService.grade.mockResolvedValue(mockGradingResponse);
      mockNotificationService.create.mockResolvedValue({});
    });

    it('should process grading job with OCR and LLM', async () => {
      const job = {
        id: '5',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      const result = await processor.process(job);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('ocrDurationMs');
      expect(result).toHaveProperty('llmDurationMs');
      expect((result as unknown as { degraded: boolean }).degraded).toBe(false);

      expect(mockPrisma.submission.update).toHaveBeenCalled();
      expect(mockBaiduOcrService.recognize).toHaveBeenCalledTimes(2);
      expect(mockGradingService.grade).toHaveBeenCalled();
      expect(mockNotificationService.create).toHaveBeenCalled();
    });

    it('should process grading job in quality mode', async () => {
      const job = {
        id: '6',
        name: 'grading',
        data: { submissionId: 'sub-1', mode: 'quality' as const },
      } as unknown as Job<{ submissionId: string; mode: 'quality' }>;

      await processor.process(job);

      expect(mockGradingService.grade).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ mode: 'quality' }),
      );
    });

    it('should process grading job with rewrite', async () => {
      const job = {
        id: '7',
        name: 'grading',
        data: { submissionId: 'sub-1', needRewrite: true },
      } as unknown as Job<{ submissionId: string; needRewrite: boolean }>;

      await processor.process(job);

      expect(mockGradingService.grade).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ needRewrite: true }),
      );
    });

    it('should skip if submission no longer exists', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(null);

      const job = {
        id: '8',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      const result = await processor.process(job);

      expect(result).toEqual(
        expect.objectContaining({
          skipped: true,
          reason: 'SUBMISSION_DELETED',
        }),
      );
      expect(mockGradingService.grade).not.toHaveBeenCalled();
    });

    it('should skip if submission is already DONE', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.DONE,
      });

      const job = {
        id: '9',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      const result = await processor.process(job);

      expect(result).toEqual(
        expect.objectContaining({
          skipped: true,
          reason: 'ALREADY_DONE',
        }),
      );
      expect(mockGradingService.grade).not.toHaveBeenCalled();
    });

    it('should use existing ocrText if available', async () => {
      const submissionWithText = {
        ...mockSubmission,
        ocrText: 'Existing OCR text',
      };
      mockPrisma.submission.findUnique.mockResolvedValue(submissionWithText);
      mockPrisma.submission.update.mockResolvedValue(submissionWithText);

      const job = {
        id: '10',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      await processor.process(job);

      expect(mockBaiduOcrService.recognize).not.toHaveBeenCalled();
      expect(mockGradingService.grade).toHaveBeenCalledWith('Existing OCR text', expect.any(Object));
    });

    it('should handle OCR errors gracefully', async () => {
      mockBaiduOcrService.recognize
        .mockResolvedValueOnce({ text: 'First image text' })
        .mockRejectedValueOnce(new Error('OCR failed'));

      const job = {
        id: '11',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      const result = await processor.process(job);

      expect(result).toHaveProperty('durationMs');
      expect(mockGradingService.grade).toHaveBeenCalled();
    });

    it('should fail when all OCR images return empty text', async () => {
      mockBaiduOcrService.recognize.mockResolvedValue({ text: '' });

      const job = {
        id: '12',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      await expect(processor.process(job)).rejects.toThrow();
    });

    it('should handle notification creation failure', async () => {
      mockNotificationService.create.mockRejectedValue(new Error('Notification failed'));

      const job = {
        id: '13',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      const result = await processor.process(job);

      expect(result).toHaveProperty('durationMs');
    });

    it('should process regrade job', async () => {
      const job = {
        id: '14',
        name: 'regrade',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      await processor.process(job);

      expect(mockGradingService.grade).toHaveBeenCalled();
    });

    it('should handle grading failure and update submission status', async () => {
      mockGradingService.grade.mockRejectedValue(new Error('LLM failed'));

      const job = {
        id: '15',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      await expect(processor.process(job)).rejects.toThrow();

      expect(mockPrisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubmissionStatus.FAILED,
            errorCode: 'UNKNOWN',
            errorMsg: 'LLM failed',
          }),
        }),
      );
    });

    it('should use custom OCR config from system config', async () => {
      mockSystemConfigService.getValue.mockResolvedValue({
        apiKey: 'custom-api-key',
        secretKey: 'custom-secret-key',
      });

      const job = {
        id: '16',
        name: 'grading',
        data: { submissionId: 'sub-1' },
      } as unknown as Job<{ submissionId: string }>;

      await processor.process(job);

      expect(mockBaiduOcrService.recognize).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          apiKey: 'custom-api-key',
          secretKey: 'custom-secret-key',
        }),
      );
    });
  });

  describe('getOcrConfig', () => {
    it('should return default config when system config is empty', async () => {
      mockSystemConfigService.getValue.mockResolvedValue({});

      const config = await processor['getOcrConfig']();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should return custom config from system config', async () => {
      mockSystemConfigService.getValue.mockResolvedValue({
        apiKey: 'custom-key',
        secretKey: 'custom-secret',
      });

      const config = await processor['getOcrConfig']();

      expect(config).toEqual({
        apiKey: 'custom-key',
        secretKey: 'custom-secret',
      });
    });

    it('should trim whitespace from config values', async () => {
      mockSystemConfigService.getValue.mockResolvedValue({
        apiKey: '  spaced-key  ',
        secretKey: '  spaced-secret  ',
      });

      const config = await processor['getOcrConfig']();

      expect(config).toEqual({
        apiKey: 'spaced-key',
        secretKey: 'spaced-secret',
      });
    });
  });
});
