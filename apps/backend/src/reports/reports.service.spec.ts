import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter } from 'events';

// Mock pdfkit
jest.mock('pdfkit', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      const doc = Object.assign(emitter, {
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        font: jest.fn().mockReturnThis(),
        end: jest.fn(function (this: EventEmitter) {
          process.nextTick(() => {
            this.emit('data', Buffer.from('fake-pdf'));
            this.emit('end');
          });
        }),
      });
      return doc;
    }),
  };
});

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'a1', name: 'Admin' };
  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 't1', name: 'Teacher' };
  const mockStudent = { id: 'student-1', role: Role.STUDENT, account: 's1', name: 'Student' };

  const mockClass = { id: 'class-1', name: 'Class A' };

  const makeSubmission = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    createdAt: new Date(),
    totalScore: 85,
    gradingJson: { errors: [{ type: 'grammar' }], nextSteps: ['Study more'] },
    student: { id: 'student-1', name: 'Student A' },
    status: 'DONE',
    homework: { id: 'hw-1', title: 'HW1' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue(mockClass),
        findFirst: jest.fn().mockResolvedValue(mockClass),
      },
      enrollment: {
        count: jest.fn().mockResolvedValue(30),
        findMany: jest.fn().mockResolvedValue([]),
      },
      submission: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { totalScore: null }, _count: 0 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student-1', name: 'Student A' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ─── getClassOverview ───

  describe('getClassOverview', () => {
    it('should return overview for admin', async () => {
      prisma.submission.groupBy.mockResolvedValue([{ studentId: 's1' }]);
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ totalScore: 90 }),
        makeSubmission({ id: 'sub-2', totalScore: 70, student: { id: 's2', name: 'B' } }),
      ]);

      const result = await service.getClassOverview('class-1', {}, mockAdmin);

      expect(result.classId).toBe('class-1');
      expect(result.className).toBe('Class A');
      expect(result.totalStudents).toBe(30);
      expect(result.summary.count).toBe(2);
      expect(result.summary.avg).toBeGreaterThan(0);
      expect(result.distribution).toHaveLength(5);
      expect(result.trend).toBeDefined();
    });

    it('should return overview for teacher with access', async () => {
      const result = await service.getClassOverview('class-1', {}, mockTeacher);

      expect(result.classId).toBe('class-1');
    });

    it('should throw ForbiddenException for teacher without access', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.getClassOverview('class-1', {}, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for admin when class missing', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.getClassOverview('class-1', {}, mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for student role', async () => {
      await expect(
        service.getClassOverview('class-1', {}, mockStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should use cache on second call', async () => {
      prisma.submission.groupBy.mockResolvedValue([]);
      prisma.submission.findMany.mockResolvedValue([]);

      await service.getClassOverview('class-1', { days: 7 }, mockAdmin);
      const result = await service.getClassOverview('class-1', { days: 7 }, mockAdmin);

      expect(result.classId).toBe('class-1');
      // findMany called only once (second time from cache)
      expect(prisma.submission.findMany).toHaveBeenCalledTimes(1);
    });

    it('should handle zero submissions gracefully', async () => {
      const result = await service.getClassOverview('class-1', {}, mockAdmin);

      expect(result.summary).toEqual({ avg: 0, min: 0, max: 0, count: 0 });
      expect(result.submissionRate).toBe(0);
    });

    it('should build distribution buckets correctly', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ totalScore: 55 }),
        makeSubmission({ id: 'sub-2', totalScore: 65, student: { id: 's2', name: 'B' } }),
        makeSubmission({ id: 'sub-3', totalScore: 92, student: { id: 's3', name: 'C' } }),
      ]);

      const result = await service.getClassOverview('class-1', { days: 30 }, mockAdmin);

      const dist = result.distribution;
      expect(dist.find(d => d.bucket === '0-59')!.count).toBe(1);
      expect(dist.find(d => d.bucket === '60-69')!.count).toBe(1);
      expect(dist.find(d => d.bucket === '90-100')!.count).toBe(1);
    });

    it('should build top rank correctly', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ totalScore: 95, student: { id: 's1', name: 'Alice' } }),
        makeSubmission({ id: 'sub-2', totalScore: 80, student: { id: 's2', name: 'Bob' } }),
        makeSubmission({ id: 'sub-3', totalScore: 90, student: { id: 's1', name: 'Alice' } }),
      ]);

      const result = await service.getClassOverview('class-1', { topN: 2 }, mockAdmin);

      expect(result.topRank).toHaveLength(2);
      expect(result.topRank[0].name).toBe('Alice');
      expect(result.topRank[0].avgScore).toBe(92.5);
    });

    it('should extract error types from gradingJson', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({
          gradingJson: {
            errors: [
              { type: 'grammar' },
              { type: 'grammar' },
              { type: 'vocabulary' },
            ],
          },
        }),
      ]);

      const result = await service.getClassOverview('class-1', {}, mockAdmin);

      const grammar = result.errorTypes.find(e => e.type === 'grammar');
      expect(grammar!.count).toBe(2);
    });

    it('should handle null gradingJson', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ gradingJson: null }),
      ]);

      const result = await service.getClassOverview('class-1', {}, mockAdmin);

      expect(result.errorTypes.every(e => e.count === 0)).toBe(true);
    });
  });

  // ─── invalidateClassCache / invalidateAllClassCache ───

  describe('cache invalidation', () => {
    it('should invalidate specific class cache', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);

      await service.getClassOverview('class-1', {}, mockAdmin);
      service.invalidateClassCache('class-1');

      // Next call should hit DB again
      await service.getClassOverview('class-1', {}, mockAdmin);
      expect(prisma.submission.findMany).toHaveBeenCalledTimes(2);
    });

    it('should invalidate all class cache', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);

      await service.getClassOverview('class-1', {}, mockAdmin);
      service.invalidateAllClassCache();

      await service.getClassOverview('class-1', {}, mockAdmin);
      expect(prisma.submission.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getStudentOverview ───

  describe('getStudentOverview', () => {
    it('should return overview for student accessing own data', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ totalScore: 85 }),
      ]);

      const result = await service.getStudentOverview('student-1', {}, mockStudent);

      expect(result.studentId).toBe('student-1');
      expect(result.summary.count).toBe(1);
      expect(result.nextSteps).toBeDefined();
    });

    it('should return overview for admin', async () => {
      const result = await service.getStudentOverview('student-1', {}, mockAdmin);

      expect(result.studentId).toBe('student-1');
    });

    it('should return overview for teacher with enrollment access', async () => {
      prisma.enrollment.findMany.mockResolvedValue([{ classId: 'c1' }]);

      const result = await service.getStudentOverview('student-1', {}, mockTeacher);

      expect(result.studentId).toBe('student-1');
    });

    it('should throw ForbiddenException when student accesses other student', async () => {
      const otherStudent = { ...mockStudent, id: 'other-student' };

      await expect(
        service.getStudentOverview('student-1', {}, otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when teacher has no enrollment access', async () => {
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.getStudentOverview('student-1', {}, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when student not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudentOverview('missing', {}, mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should build nextSteps from gradingJson', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({
          gradingJson: { nextSteps: ['Practice grammar', 'Read more', 'Practice grammar'] },
        }),
        makeSubmission({
          id: 'sub-2',
          gradingJson: { nextSteps: ['Read more'] },
        }),
      ]);

      const result = await service.getStudentOverview('student-1', {}, mockStudent);

      expect(result.nextSteps.length).toBeGreaterThan(0);
      const grammarStep = result.nextSteps.find(s => s.text === 'Practice grammar');
      expect(grammarStep!.count).toBe(2);
    });
  });

  // ─── exportClassCsv ───

  describe('exportClassCsv', () => {
    it('should export CSV with headers', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission(),
      ]);

      const csv = await service.exportClassCsv('class-1', {}, mockAdmin);

      expect(csv).toContain('submissionId');
      expect(csv).toContain('sub-1');
    });

    it('should export Chinese headers when lang=zh', async () => {
      prisma.submission.findMany.mockResolvedValue([]);

      const csv = await service.exportClassCsv('class-1', { lang: 'zh' }, mockAdmin);

      expect(csv).toContain('提交ID');
    });

    it('should escape CSV values with commas', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({
          student: { id: 's1', name: 'Last, First' },
          homework: { id: 'hw-1', title: 'Test' },
        }),
      ]);

      const csv = await service.exportClassCsv('class-1', {}, mockAdmin);

      expect(csv).toContain('"Last, First"');
    });
  });

  // ─── getStudentClassComparison ───

  describe('getStudentClassComparison', () => {
    it('should return comparison for enrolled classes', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        { classId: 'c1', class: { id: 'c1', name: 'Class A' } },
      ]);
      prisma.submission.aggregate
        .mockResolvedValueOnce({ _avg: { totalScore: 80.5 }, _count: 10 })
        .mockResolvedValueOnce({ _avg: { totalScore: 85.0 }, _count: 5 });

      const result = await service.getStudentClassComparison('student-1', 7);

      expect(result).toHaveLength(1);
      expect(result[0].classAvg).toBe(80.5);
      expect(result[0].studentAvg).toBe(85.0);
    });

    it('should handle null averages', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        { classId: 'c1', class: { id: 'c1', name: 'Class A' } },
      ]);
      prisma.submission.aggregate.mockResolvedValue({
        _avg: { totalScore: null },
        _count: 0,
      });

      const result = await service.getStudentClassComparison('student-1', 30);

      expect(result[0].classAvg).toBeNull();
      expect(result[0].studentAvg).toBeNull();
    });
  });

  // ─── exportClassPdf / exportStudentPdf ───

  describe('exportClassPdf', () => {
    it('should generate a PDF buffer', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);

      const buffer = await service.exportClassPdf('class-1', {}, mockAdmin);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate Chinese PDF when lang=zh', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      prisma.submission.groupBy.mockResolvedValue([]);

      const buffer = await service.exportClassPdf('class-1', { lang: 'zh' }, mockAdmin);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should generate PDF with data', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ totalScore: 85 }),
      ]);
      prisma.submission.groupBy.mockResolvedValue([{ studentId: 's1' }]);

      const buffer = await service.exportClassPdf('class-1', {}, mockAdmin);

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('exportStudentPdf', () => {
    it('should generate a PDF buffer for student', async () => {
      prisma.submission.findMany.mockResolvedValue([]);

      const buffer = await service.exportStudentPdf('student-1', {}, mockStudent);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate student PDF with data', async () => {
      prisma.submission.findMany.mockResolvedValue([
        makeSubmission({ gradingJson: { errors: [{ type: 'grammar' }], nextSteps: ['Study'] } }),
      ]);

      const buffer = await service.exportStudentPdf('student-1', { lang: 'zh' }, mockStudent);

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
