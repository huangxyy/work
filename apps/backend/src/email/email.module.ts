import { Global, Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [SystemConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
