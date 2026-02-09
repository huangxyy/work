import { Controller, Get, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';

@Controller('student/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class StudentReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async overview(@Query() query: ReportRangeQueryDto, @Req() req: { user: AuthUser }) {
    return this.reportsService.getStudentOverview(req.user.id, query, req.user);
  }

  @Get('pdf')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportPdf(
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.reportsService.exportStudentPdf(req.user.id, query, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="student-${req.user.id}-report.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return new StreamableFile(pdf);
  }
}
