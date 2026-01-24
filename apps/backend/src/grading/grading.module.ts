import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GradingService } from './grading.service';
import { CheapProvider } from './providers/cheap.provider';
import { BudgetTracker } from './utils/budget';

@Module({
  imports: [ConfigModule],
  providers: [GradingService, CheapProvider, BudgetTracker],
  exports: [GradingService],
})
export class GradingModule {}
