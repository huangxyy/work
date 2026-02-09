import { Body, Controller, Post } from '@nestjs/common';
import { CreateDemoJobDto } from './dto/create-demo-job.dto';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('demo')
  async enqueueDemoJob(@Body() body: CreateDemoJobDto) {
    const job = await this.queueService.enqueueDemo(body.message);
    return { jobId: job.id };
  }
}