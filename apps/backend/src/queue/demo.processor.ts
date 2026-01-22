import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';

const concurrency = Number(process.env.WORKER_CONCURRENCY || '5');

@Processor('grading')
export class DemoProcessor {
  private readonly logger = new Logger(DemoProcessor.name);

  @Process({ name: 'demo', concurrency })
  async handleDemo(job: Job<{ message?: string; requestedAt?: string }>) {
    const startedAt = Date.now();
    this.logger.log(`Processing demo job ${job.id} message=${job.data.message || ''}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const duration = Date.now() - startedAt;
    this.logger.log(`Completed demo job ${job.id} in ${duration}ms`);
    return { durationMs: duration };
  }
}