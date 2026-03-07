import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { StorageService } from './storage.service';

@Module({
  imports: [SystemConfigModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
