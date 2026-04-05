import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicLandingQueryDto } from './dto/public-landing-query.dto';
import { PublicOverviewQueryDto } from './dto/public-overview-query.dto';
import { PublicService } from './public.service';
import { ConfigValidatorService } from '../common/config-validator';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly validator: ConfigValidatorService,
  ) {}

  @Get('overview')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async overview(@Query() query: PublicOverviewQueryDto) {
    return this.publicService.getOverview(query);
  }

  @Get('landing')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async landing(@Query() query: PublicLandingQueryDto) {
    return this.publicService.getLanding(query);
  }

  @Get('config/validate')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  validateConfig() {
    return this.validator.validate();
  }
}
