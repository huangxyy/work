import { Module } from '@nestjs/common';
import { GradingPolicyModule } from '../grading-policy/grading-policy.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { SubmissionsController } from './submissions.controller';
import { TeacherSubmissionsController } from './teacher-submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [PrismaModule, StorageModule, QueueModule, GradingPolicyModule, SystemConfigModule, LlmModule],
  controllers: [SubmissionsController, TeacherSubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
