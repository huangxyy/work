import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

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
}
