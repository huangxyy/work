import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { ConfigValidatorModule } from '../common/config-validator';
import { ConfigValidatorService } from '../common/config-validator';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [PrismaModule, SystemConfigModule, LlmModule, ConfigValidatorModule],
  controllers: [PublicController],
  providers: [PublicService, ConfigValidatorService],
})
export class PublicModule {}
