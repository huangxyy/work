import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateDemoJobDto } from './dto/create-demo-job.dto';
import { QueueService } from './queue.service';

@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('demo')
  @Roles(Role.ADMIN)
  async enqueueDemoJob(@Body() body: CreateDemoJobDto) {
    const job = await this.queueService.enqueueDemo(body.message);
    return { jobId: job.id };
  }
}
