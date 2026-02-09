import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GradingService } from './grading.service';
import { CheapProvider } from './providers/cheap.provider';
import { BudgetTracker } from './utils/budget';
import { SystemConfigModule } from '../system-config/system-config.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [ConfigModule, SystemConfigModule, LlmModule],
  providers: [GradingService, CheapProvider, BudgetTracker],
  exports: [GradingService],
})
export class GradingModule {}
