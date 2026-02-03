import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly statusList = ['waiting', 'active', 'delayed', 'failed', 'completed', 'paused'] as const;

  constructor(@InjectQueue('grading') private readonly gradingQueue: Queue) {}

  async enqueueDemo(message?: string) {
    const payload = {
      message: message || 'demo job from API',
      requestedAt: new Date().toISOString(),
    };
    const job = await this.gradingQueue.add('demo', payload);
    this.logger.log(`Enqueued demo job ${job.id}`);
    return job;
  }

  async enqueueGrading(
    submissionId: string,
    options: { mode?: 'cheap' | 'quality'; needRewrite?: boolean } = {},
  ) {
    const payload = { submissionId, ...options };
    const job = await this.gradingQueue.add('grading', payload);
    this.logger.log(`Enqueued grading job ${job.id} for submission ${submissionId}`);
    return job;
  }

  async enqueueRegrade(
    submissionId: string,
    options: { mode?: 'cheap' | 'quality'; needRewrite?: boolean } = {},
  ) {
    const payload = { submissionId, ...options };
    const job = await this.gradingQueue.add('regrade', payload);
    this.logger.log(`Enqueued regrade job ${job.id} for submission ${submissionId}`);
    return job;
  }

  async getQueueMetrics(options: { status?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const counts = await this.gradingQueue.getJobCounts(...this.statusList);
    const statuses = this.normalizeStatuses(options.status);
    const jobs = await this.gradingQueue.getJobs(statuses, 0, limit - 1, false);
    const isPaused = await this.safeIsPaused();

    const mapped = await Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        status: await this.safeJobState(job, statuses),
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn || null,
        finishedOn: job.finishedOn || null,
        failedReason: job.failedReason || null,
        data: this.pickJobData(job.data as Record<string, unknown>),
      })),
    );

    return {
      queue: 'grading',
      isPaused,
      counts: this.withDefaults(counts),
      jobs: mapped,
      updatedAt: new Date().toISOString(),
    };
  }

  async retryFailedJobs(limit = 50) {
    const bounded = Math.min(Math.max(limit, 1), 200);
    const failedJobs = await this.gradingQueue.getJobs(['failed'], 0, bounded - 1, false);
    let retried = 0;
    let skipped = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retried += 1;
      } catch {
        skipped += 1;
      }
    }
    return { retried, skipped, total: failedJobs.length };
  }

  async cleanQueue(options: { status?: string; graceMs?: number; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 2000);
    const graceMs = Math.max(options.graceMs ?? 0, 0);
    const statuses = this.resolveCleanStatuses(options.status);
    let total = 0;
    const details: Record<string, number> = {};
    for (const status of statuses) {
      const cleaned = await this.gradingQueue.clean(graceMs, limit, status);
      details[status] = cleaned.length;
      total += cleaned.length;
    }
    return { total, details };
  }

  async pauseQueue() {
    await this.gradingQueue.pause();
    return { paused: true };
  }

  async resumeQueue() {
    await this.gradingQueue.resume();
    return { paused: false };
  }

  private normalizeStatuses(status?: string) {
    if (status && this.statusList.includes(status as (typeof this.statusList)[number])) {
      return [status] as Array<(typeof this.statusList)[number]>;
    }
    return ['active', 'waiting', 'delayed', 'failed', 'completed'] as Array<
      (typeof this.statusList)[number]
    >;
  }

  private resolveCleanStatuses(status?: string) {
    if (!status || status === 'all') {
      return ['completed', 'failed', 'delayed', 'wait', 'paused'] as const;
    }
    if (status === 'waiting') {
      return ['wait'] as const;
    }
    if (status === 'completed' || status === 'failed' || status === 'delayed' || status === 'paused') {
      return [status] as const;
    }
    if (status === 'active') {
      return ['active'] as const;
    }
    return ['completed'] as const;
  }

  private async safeIsPaused() {
    try {
      return await this.gradingQueue.isPaused();
    } catch {
      return false;
    }
  }

  private async safeJobState(
    job: Job,
    fallback: Array<(typeof this.statusList)[number]>,
  ): Promise<string> {
    try {
      const state = (await job.getState()) as string;
      if (state === 'wait') {
        return 'waiting';
      }
      if (state === 'waiting-children') {
        return 'waiting';
      }
      return state;
    } catch {
      return fallback[0] || 'unknown';
    }
  }

  private pickJobData(data: Record<string, unknown> | null) {
    if (!data) {
      return {};
    }
    const selected: Record<string, unknown> = {};
    ['submissionId', 'mode', 'needRewrite', 'message'].forEach((key) => {
      if (data[key] !== undefined) {
        selected[key] = data[key];
      }
    });
    return selected;
  }

  private withDefaults(counts: Record<string, number>) {
    const result: Record<string, number> = {};
    this.statusList.forEach((status) => {
      const fallbackKey = status === 'waiting' ? 'wait' : status;
      result[status] = counts[status] ?? counts[fallbackKey] ?? 0;
    });
    return result;
  }
}
