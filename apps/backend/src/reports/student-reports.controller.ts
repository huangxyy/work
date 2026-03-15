import { Controller, Get, Query, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';

/**
 * Sanitize a value for use in Content-Disposition filenames.
 */
function sanitizeFilenameParam(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

@ApiTags('Student Reports')
@Controller('student/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class StudentReportsController {
  private readonly logger = new Logger(StudentReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  async overview(@Query() query: ReportRangeQueryDto, @Req() req: { user: AuthUser }) {
    return this.reportsService.getStudentOverview(req.user.id, query, req.user);
  }

  @Get('class-comparison')
  async getClassComparison(@Req() req: { user: AuthUser }, @Query() query: ReportRangeQueryDto) {
    return this.reportsService.getStudentClassComparison(req.user.id, query.days ?? 7);
  }

  @Get('pdf')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async exportPdf(
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      this.logger.log(`[exportPdf] studentId=${req.user.id} lang=${query.lang}`);
      const pdf = await this.reportsService.exportStudentPdf(req.user.id, query, req.user);
      const safeId = sanitizeFilenameParam(req.user.id);
      // 使用 RFC 5987 编码格式，确保中文文件名在微信小程序中正确处理
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="student-report-${safeId}.pdf"; filename*=UTF-8''student-report-${safeId}.pdf`);
      res.setHeader('Content-Length', pdf.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      this.logger.log(`[exportPdf] PDF generated successfully size=${pdf.length}`);
      res.send(pdf);
    } catch (error) {
      this.logger.error(`[exportPdf] PDF generation failed for student ${req.user.id}:`, error);
      throw error;
    }
  }
}
