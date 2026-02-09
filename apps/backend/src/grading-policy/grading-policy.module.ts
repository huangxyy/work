import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GradingPolicyService } from './grading-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [GradingPolicyService],
  exports: [GradingPolicyService],
})
export class GradingPolicyModule {}
