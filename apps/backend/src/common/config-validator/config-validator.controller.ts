import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigValidatorService } from './config-validator.service';

@ApiTags('Config Validator')
@Controller('config-validator')
export class ConfigValidatorController {
  constructor(private readonly validator: ConfigValidatorService) {}

  @Get('validate')
  validate() {
    return this.validator.validate();
  }

  @Get('summary')
  getSummary() {
    return this.validator.getConfigSummary();
  }
}
