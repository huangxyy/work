import { Global, Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [SystemConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
