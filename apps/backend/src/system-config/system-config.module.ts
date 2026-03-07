import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeConfigService } from './runtime-config.service';
import { SystemConfigService } from './system-config.service';

@Module({
  imports: [PrismaModule],
  providers: [SystemConfigService, RuntimeConfigService],
  exports: [SystemConfigService, RuntimeConfigService],
})
export class SystemConfigModule {}
