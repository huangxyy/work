import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GradingPolicyModule } from '../grading-policy/grading-policy.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { TeacherSettingsController } from './teacher-settings.controller';
import { TeacherSettingsService } from './teacher-settings.service';
import { TeacherPreferenceService } from './teacher-preference.service';

@Module({
  imports: [ConfigModule, PrismaModule, SystemConfigModule, LlmModule, GradingPolicyModule],
  controllers: [TeacherSettingsController],
  providers: [TeacherSettingsService, TeacherPreferenceService],
  exports: [TeacherSettingsService, TeacherPreferenceService],
})
export class TeacherSettingsModule {}
