import { StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { ReportsController } from './reports.controller';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: {
    getClassOverview: jest.Mock;
    exportClassCsv: jest.Mock;
    exportClassPdf: jest.Mock;
    getStudentOverview: jest.Mock;
    exportStudentPdf: jest.Mock;
  };

  const mockTeacher: AuthUser = {
    id: 'teacher-1',
    account: 'teacher1',
    name: 'Test Teacher',
    role: Role.TEACHER,
  };

  beforeEach(async () => {
    reportsService = {
      getClassOverview: jest.fn(),
      exportClassCsv: jest.fn(),
      exportClassPdf: jest.fn(),
      getStudentOverview: jest.fn(),
      exportStudentPdf: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(ReportsController);
  });

  it('should forward class overview requests', async () => {
    const query: ReportRangeQueryDto = { days: 7, topN: 5 };
    reportsService.getClassOverview.mockResolvedValue({ classId: 'class-1', summary: {} });

    const result = await controller.classOverview('class-1', query, { user: mockTeacher });

    expect(result).toEqual({ classId: 'class-1', summary: {} });
    expect(reportsService.getClassOverview).toHaveBeenCalledWith('class-1', query, mockTeacher);
  });

  it('should export class csv with the expected headers', async () => {
    const query: ReportRangeQueryDto = { days: 7, lang: 'zh-CN' };
    const res = { setHeader: jest.fn() } as unknown as Response;
    reportsService.exportClassCsv.mockResolvedValue('csv-content');

    const result = await controller.exportClass('class-1', query, { user: mockTeacher }, res);

    expect(result).toBe('csv-content');
    expect(reportsService.exportClassCsv).toHaveBeenCalledWith('class-1', query, mockTeacher);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="class-class-1-report.csv"',
    );
  });

  it('should export class pdf with the expected headers', async () => {
    const query: ReportRangeQueryDto = { days: 7, lang: 'zh-CN' };
    const res = { setHeader: jest.fn() } as unknown as Response;
    const pdf = Buffer.from('pdf');
    reportsService.exportClassPdf.mockResolvedValue(pdf);

    const result = await controller.exportClassPdf('class-1', query, { user: mockTeacher }, res);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(reportsService.exportClassPdf).toHaveBeenCalledWith('class-1', query, mockTeacher);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="class-class-1-report.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', pdf.length);
  });

  it('should forward student overview requests', async () => {
    const query: ReportRangeQueryDto = { days: 14 };
    reportsService.getStudentOverview.mockResolvedValue({ studentId: 'student-1', summary: {} });

    const result = await controller.studentOverview('student-1', query, { user: mockTeacher });

    expect(result).toEqual({ studentId: 'student-1', summary: {} });
    expect(reportsService.getStudentOverview).toHaveBeenCalledWith('student-1', query, mockTeacher);
  });

  it('should export student pdf with the expected headers', async () => {
    const query: ReportRangeQueryDto = { days: 14, lang: 'en' };
    const res = { setHeader: jest.fn() } as unknown as Response;
    const pdf = Buffer.from('student-pdf');
    reportsService.exportStudentPdf.mockResolvedValue(pdf);

    const result = await controller.exportStudentPdf('student-1', query, { user: mockTeacher }, res);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(reportsService.exportStudentPdf).toHaveBeenCalledWith('student-1', query, mockTeacher);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="student-student-1-report.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', pdf.length);
  });
});
