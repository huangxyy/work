import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GradingService } from './grading.service';
import { CheapProvider } from './providers/cheap.provider';
import { BudgetTracker } from './utils/budget';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [ConfigModule, SystemConfigModule],
  providers: [GradingService, CheapProvider, BudgetTracker],
  exports: [GradingService],
})
export class GradingModule {}
