import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 1,
        active: 2,
        delayed: 0,
        failed: 1,
        completed: 10,
        paused: 0,
      }),
      getJobs: jest.fn().mockResolvedValue([]),
      isPaused: jest.fn().mockResolvedValue(false),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken('grading'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  // ─── enqueueDemo ───

  describe('enqueueDemo', () => {
    it('should enqueue a demo job', async () => {
      const result = await service.enqueueDemo('hello');

      expect(result.id).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith('demo', expect.objectContaining({ message: 'hello' }));
    });

    it('should use default message when none provided', async () => {
      await service.enqueueDemo();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'demo',
        expect.objectContaining({ message: 'demo job from API' }),
      );
    });
  });

  // ─── enqueueGrading ───

  describe('enqueueGrading', () => {
    it('should enqueue a grading job', async () => {
      const result = await service.enqueueGrading('sub-1', { mode: 'quality' });

      expect(result.id).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'grading',
        expect.objectContaining({ submissionId: 'sub-1', mode: 'quality' }),
      );
    });
  });

  // ─── enqueueRegrade ───

  describe('enqueueRegrade', () => {
    it('should enqueue a regrade job', async () => {
      await service.enqueueRegrade('sub-2', { needRewrite: true });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'regrade',
        expect.objectContaining({ submissionId: 'sub-2', needRewrite: true }),
      );
    });
  });

  // ─── getQueueMetrics ───

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const result = await service.getQueueMetrics();

      expect(result.queue).toBe('grading');
      expect(result.isPaused).toBe(false);
      expect(result.counts).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should map jobs with safe state', async () => {
      const mockJob = {
        id: 'j1',
        name: 'grading',
        attemptsMade: 1,
        timestamp: Date.now(),
        processedOn: null,
        finishedOn: null,
        failedReason: null,
        data: { submissionId: 'sub-1', mode: 'cheap' },
        getState: jest.fn().mockResolvedValue('active'),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('active');
      expect(result.jobs[0].data).toEqual({ submissionId: 'sub-1', mode: 'cheap' });
    });

    it('should normalize wait state to waiting', async () => {
      const mockJob = {
        id: 'j1', name: 'grading', attemptsMade: 0, timestamp: Date.now(),
        processedOn: null, finishedOn: null, failedReason: null, data: {},
        getState: jest.fn().mockResolvedValue('wait'),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs[0].status).toBe('waiting');
    });

    it('should normalize waiting-children to waiting', async () => {
      const mockJob = {
        id: 'j1', name: 'grading', attemptsMade: 0, timestamp: Date.now(),
        processedOn: null, finishedOn: null, failedReason: null, data: {},
        getState: jest.fn().mockResolvedValue('waiting-children'),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs[0].status).toBe('waiting');
    });

    it('should handle getState error gracefully', async () => {
      const mockJob = {
        id: 'j1', name: 'grading', attemptsMade: 0, timestamp: Date.now(),
        processedOn: null, finishedOn: null, failedReason: null, data: {},
        getState: jest.fn().mockRejectedValue(new Error('state error')),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs[0].status).toBeDefined();
    });

    it('should handle isPaused error gracefully', async () => {
      mockQueue.isPaused.mockRejectedValue(new Error('paused error'));

      const result = await service.getQueueMetrics();

      expect(result.isPaused).toBe(false);
    });

    it('should filter jobs by status', async () => {
      await service.getQueueMetrics({ status: 'failed' });

      expect(mockQueue.getJobs).toHaveBeenCalledWith(['failed'], 0, 19, false);
    });

    it('should pick only allowed data fields', async () => {
      const mockJob = {
        id: 'j1', name: 'grading', attemptsMade: 0, timestamp: Date.now(),
        processedOn: null, finishedOn: null, failedReason: null,
        data: { submissionId: 'sub-1', mode: 'cheap', secretField: 'hidden' },
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs[0].data).toEqual({ submissionId: 'sub-1', mode: 'cheap' });
      expect((result.jobs[0].data as any).secretField).toBeUndefined();
    });

    it('should handle null job data', async () => {
      const mockJob = {
        id: 'j1', name: 'grading', attemptsMade: 0, timestamp: Date.now(),
        processedOn: null, finishedOn: null, failedReason: null, data: null,
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.getQueueMetrics();

      expect(result.jobs[0].data).toEqual({});
    });
  });

  // ─── retryFailedJobs ───

  describe('retryFailedJobs', () => {
    it('should retry failed jobs', async () => {
      const mockJob = {
        id: 'j1',
        getState: jest.fn().mockResolvedValue('failed'),
        retry: jest.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.retryFailedJobs();

      expect(result.retried).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip jobs no longer in failed state', async () => {
      const mockJob = {
        id: 'j1',
        getState: jest.fn().mockResolvedValue('completed'),
        retry: jest.fn(),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.retryFailedJobs();

      expect(result.retried).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockJob.retry).not.toHaveBeenCalled();
    });

    it('should skip on retry error', async () => {
      const mockJob = {
        id: 'j1',
        getState: jest.fn().mockResolvedValue('failed'),
        retry: jest.fn().mockRejectedValue(new Error('retry failed')),
      };
      mockQueue.getJobs.mockResolvedValue([mockJob]);

      const result = await service.retryFailedJobs();

      expect(result.skipped).toBe(1);
    });
  });

  // ─── cleanQueue ───

  describe('cleanQueue', () => {
    it('should clean all statuses by default', async () => {
      mockQueue.clean.mockResolvedValue(['j1', 'j2']);

      const result = await service.cleanQueue();

      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should clean specific status', async () => {
      mockQueue.clean.mockResolvedValue(['j1']);

      const result = await service.cleanQueue({ status: 'failed' });

      expect(result.details).toBeDefined();
    });

    it('should map waiting to wait for clean', async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanQueue({ status: 'waiting' });

      expect(mockQueue.clean).toHaveBeenCalledWith(0, 200, 'wait');
    });
  });

  // ─── pauseQueue / resumeQueue ───

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      const result = await service.pauseQueue();

      expect(result).toEqual({ paused: true });
      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      const result = await service.resumeQueue();

      expect(result).toEqual({ paused: false });
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });
});
