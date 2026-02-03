import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { LlmModule } from '../llm/llm.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ConfigModule, PrismaModule, SystemConfigModule, LlmModule, QueueModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
