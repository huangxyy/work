import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigValidatorController } from './config-validator.controller';
import { ConfigValidatorService } from './config-validator.service';

@Module({
  imports: [ConfigModule],
  controllers: [ConfigValidatorController],
  providers: [ConfigValidatorService],
  exports: [ConfigValidatorService],
})
export class ConfigValidatorModule {}
