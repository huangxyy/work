import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RetentionRunDto } from './dto/retention-run.dto';
import { RetentionService } from './retention.service';

@Controller('admin/retention')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Post('run')
  @Roles(Role.ADMIN)
  async run(@Body() body: RetentionRunDto) {
    return this.retentionService.runRetentionJob({
      days: body.days,
      dryRun: body.dryRun,
      batchSize: body.batchSize,
      invokedBy: 'manual',
    });
  }

  @Get('status')
  @Roles(Role.ADMIN)
  async status() {
    return this.retentionService.getStatus();
  }
}
