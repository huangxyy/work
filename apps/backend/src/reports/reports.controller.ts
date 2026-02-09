import { Controller, Get, Param, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';

/**
 * Sanitize a value for use in Content-Disposition filenames.
 * Strips characters that could cause header injection or path traversal.
 */
function sanitizeFilenameParam(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '');
}

@Controller('teacher/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('class/:classId/overview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async classOverview(
    @Param('classId', ParseCuidPipe) classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportsService.getClassOverview(classId, query, req.user);
  }

  @Get('class/:classId/export')
  @Roles(Role.TEACHER, Role.ADMIN)
  async exportClass(
    @Param('classId', ParseCuidPipe) classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.reportsService.exportClassCsv(classId, query, req.user);
    const safeClassId = sanitizeFilenameParam(classId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="class-${safeClassId}-report.csv"`,
    );
    return csv;
  }

  @Get('class/:classId/pdf')
  @Roles(Role.TEACHER, Role.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportClassPdf(
    @Param('classId', ParseCuidPipe) classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.reportsService.exportClassPdf(classId, query, req.user);
    const safePdfClassId = sanitizeFilenameParam(classId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="class-${safePdfClassId}-report.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);
    return new StreamableFile(pdf);
  }

  @Get('student/:studentId/overview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async studentOverview(
    @Param('studentId', ParseCuidPipe) studentId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportsService.getStudentOverview(studentId, query, req.user);
  }

  @Get('student/:studentId/pdf')
  @Roles(Role.TEACHER, Role.ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportStudentPdf(
    @Param('studentId', ParseCuidPipe) studentId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.reportsService.exportStudentPdf(studentId, query, req.user);
    const safeStudentId = sanitizeFilenameParam(studentId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-${safeStudentId}-report.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length);
    return new StreamableFile(pdf);
  }
}
