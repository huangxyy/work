import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';
import { StudentReportsController } from './student-reports.controller';

describe('StudentReportsController', () => {
  let controller: StudentReportsController;
  let reportsService: {
    getStudentOverview: jest.Mock;
    getStudentClassComparison: jest.Mock;
    exportStudentPdf: jest.Mock;
  };

  const mockStudent: AuthUser = {
    id: 'student-1',
    account: 'student1',
    name: 'Test Student',
    role: Role.STUDENT,
  };

  beforeEach(async () => {
    reportsService = {
      getStudentOverview: jest.fn(),
      getStudentClassComparison: jest.fn(),
      exportStudentPdf: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StudentReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(StudentReportsController);
  });

  it('should forward student overview requests using the authenticated student id', async () => {
    const query: ReportRangeQueryDto = { days: 7 };
    reportsService.getStudentOverview.mockResolvedValue({ studentId: 'student-1', summary: {} });

    const result = await controller.overview(query, { user: mockStudent });

    expect(result).toEqual({ studentId: 'student-1', summary: {} });
    expect(reportsService.getStudentOverview).toHaveBeenCalledWith('student-1', query, mockStudent);
  });

  it('should default class comparison range days to 7', async () => {
    reportsService.getStudentClassComparison.mockResolvedValue({ rank: 1 });

    const result = await controller.getClassComparison({ user: mockStudent }, {} as ReportRangeQueryDto);

    expect(result).toEqual({ rank: 1 });
    expect(reportsService.getStudentClassComparison).toHaveBeenCalledWith('student-1', 7);
  });

  it('should export student pdf with the expected headers', async () => {
    const query: ReportRangeQueryDto = { days: 30, lang: 'zh-CN' };
    const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;
    const pdf = Buffer.from('student-report');
    reportsService.exportStudentPdf.mockResolvedValue(pdf);

    await controller.exportPdf(query, { user: mockStudent }, res);

    expect(reportsService.exportStudentPdf).toHaveBeenCalledWith('student-1', query, mockStudent);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="student-report-student-1.pdf"'),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', pdf.length);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
    expect(res.send).toHaveBeenCalledWith(pdf);
  });
});
