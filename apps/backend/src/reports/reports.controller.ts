import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthUser } from '../auth/auth.types';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';

@Controller('teacher/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('class/:classId/overview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async classOverview(
    @Param('classId') classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportsService.getClassOverview(classId, query, req.user);
  }

  @Get('class/:classId/export')
  @Roles(Role.TEACHER, Role.ADMIN)
  async exportClass(
    @Param('classId') classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.reportsService.exportClassCsv(classId, query, req.user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="class-${classId}-report.csv"`,
    );
    return csv;
  }

  @Get('class/:classId/pdf')
  @Roles(Role.TEACHER, Role.ADMIN)
  async exportClassPdf(
    @Param('classId') classId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.reportsService.exportClassPdf(classId, query, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="class-${classId}-report.pdf"`,
    );
    return pdf;
  }

  @Get('student/:studentId/overview')
  @Roles(Role.TEACHER, Role.ADMIN)
  async studentOverview(
    @Param('studentId') studentId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.reportsService.getStudentOverview(studentId, query, req.user);
  }

  @Get('student/:studentId/pdf')
  @Roles(Role.TEACHER, Role.ADMIN)
  async exportStudentPdf(
    @Param('studentId') studentId: string,
    @Query() query: ReportRangeQueryDto,
    @Req() req: { user: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.reportsService.exportStudentPdf(studentId, query, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-${studentId}-report.pdf"`,
    );
    return pdf;
  }
}
