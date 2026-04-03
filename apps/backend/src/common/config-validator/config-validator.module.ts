import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigValidatorService } from './config-validator.service';

@Module({
  imports: [ConfigModule],
  providers: [ConfigValidatorService],
  exports: [ConfigValidatorService],
})
export class ConfigValidatorModule {}
