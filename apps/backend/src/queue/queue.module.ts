import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { DemoProcessor } from './demo.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'grading' })],
  controllers: [QueueController],
  providers: [QueueService, DemoProcessor],
  exports: [QueueService],
})
export class QueueModule {}