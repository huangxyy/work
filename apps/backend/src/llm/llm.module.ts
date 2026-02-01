import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { LlmConfigService } from './llm-config.service';
import { LlmLogsService } from './llm-logs.service';

@Module({
  imports: [ConfigModule, PrismaModule, SystemConfigModule],
  providers: [LlmConfigService, LlmLogsService],
  exports: [LlmConfigService, LlmLogsService],
})
export class LlmModule {}
