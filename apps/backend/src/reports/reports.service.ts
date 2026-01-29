import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, SubmissionStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { ReportRangeQueryDto } from './dto/report-range-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

type ScoreSummary = {
  avg: number;
  min: number;
  max: number;
  count: number;
};

type DistributionBucket = {
  bucket: string;
  count: number;
};

type TrendPoint = {
  date: string;
  avg: number;
  count: number;
};

type ErrorTypeStat = {
  type: string;
  count: number;
  ratio: number;
};

type TopRankItem = {
  studentId: string;
  name: string;
  avgScore: number;
  count: number;
};

type NextStepStat = {
  text: string;
  count: number;
};

type ClassSubmission = {
  id: string;
  createdAt: Date;
  totalScore: number | null;
  gradingJson: Prisma.JsonValue | null;
  student: { id: string; name: string };
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassOverview(
    classId: string,
    query: ReportRangeQueryDto,
    user: AuthUser,
  ) {
    const klass = await this.ensureClassAccess(classId, user);
    const days = query.days ?? 7;
    const topN = query.topN ?? 5;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const totalStudents = await this.prisma.enrollment.count({ where: { classId } });
    const submittedStudents = await this.prisma.submission.groupBy({
      by: ['studentId'],
      where: {
        homework: { classId },
        createdAt: { gte: cutoff },
      },
    });
    const submittedCount = submittedStudents.length;
    const pendingStudents = Math.max(0, totalStudents - submittedCount);
    const submissionRate = totalStudents ? this.roundRatio(submittedCount / totalStudents) : 0;

    const submissions = await this.prisma.submission.findMany({
      where: {
        homework: { classId },
        createdAt: { gte: cutoff },
        status: SubmissionStatus.DONE,
        totalScore: { not: null },
      },
      select: {
        id: true,
        createdAt: true,
        totalScore: true,
        gradingJson: true,
        student: { select: { id: true, name: true } },
      },
    });

    const scores = this.collectScores(submissions);

    return {
      classId: klass.id,
      className: klass.name,
      rangeDays: days,
      totalStudents,
      submittedStudents: submittedCount,
      pendingStudents,
      submissionRate,
      summary: this.buildSummary(scores),
      distribution: this.buildDistribution(scores),
      topRank: this.buildTopRank(submissions, topN),
      trend: this.buildTrend(submissions, days),
      errorTypes: this.buildErrorTypes(submissions),
    };
  }

  async exportClassCsv(classId: string, query: ReportRangeQueryDto, user: AuthUser) {
    const klass = await this.ensureClassAccess(classId, user);
    const days = query.days ?? 7;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const submissions = await this.prisma.submission.findMany({
      where: {
        homework: { classId },
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        createdAt: true,
        totalScore: true,
        status: true,
        student: { select: { id: true, name: true } },
        homework: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows: Array<Array<string | number | null>> = [
      [
        'submissionId',
        'classId',
        'className',
        'studentId',
        'studentName',
        'homeworkId',
        'homeworkTitle',
        'totalScore',
        'status',
        'createdAt',
      ],
    ];

    for (const submission of submissions) {
      rows.push([
        submission.id,
        klass.id,
        klass.name,
        submission.student.id,
        submission.student.name,
        submission.homework.id,
        submission.homework.title,
        submission.totalScore ?? '',
        submission.status,
        submission.createdAt.toISOString(),
      ]);
    }

    return rows.map((row) => this.toCsvRow(row)).join('\n');
  }

  async exportClassPdf(classId: string, query: ReportRangeQueryDto, user: AuthUser) {
    const report = await this.getClassOverview(classId, query, user);
    return this.renderPdf((doc) => {
      this.writeHeader(doc, 'Class Report', [
        `Class: ${report.className}`,
        `Class ID: ${report.classId}`,
        `Range: last ${report.rangeDays} days`,
        `Generated: ${this.formatDateTime(new Date())}`,
      ]);

      this.writeSection(doc, 'Summary', () => {
        const baseRows: Array<[string, number | string]> = [
          ['Total Students', report.totalStudents],
          ['Submitted Students', report.submittedStudents],
          ['Pending Students', report.pendingStudents],
          ['Submission Rate', this.formatRatio(report.submissionRate)],
        ];
        if (!report.summary.count) {
          this.writeKeyValues(doc, baseRows);
          doc.text('No completed submissions.');
          return;
        }
        this.writeKeyValues(doc, [
          ...baseRows,
          ['Average', report.summary.avg],
          ['Highest', report.summary.max],
          ['Lowest', report.summary.min],
          ['Submissions', report.summary.count],
        ]);
      });

      this.writeSection(doc, 'Score Distribution', () => {
        if (!report.distribution.length) {
          doc.text('No distribution data.');
          return;
        }
        report.distribution.forEach((item) => {
          doc.text(`${item.bucket}: ${item.count}`);
        });
      });

      this.writeSection(doc, 'Top Students', () => {
        if (!report.topRank.length) {
          doc.text('No ranking data.');
          return;
        }
        report.topRank.forEach((item, index) => {
          doc.text(`${index + 1}. ${item.name} - avg ${item.avgScore} (${item.count} submissions)`);
        });
      });

      this.writeSection(doc, 'Trend', () => {
        if (!report.trend.length) {
          doc.text('No trend data.');
          return;
        }
        report.trend.forEach((item) => {
          doc.text(`${item.date} - avg ${item.avg} (${item.count})`);
        });
      });

      this.writeSection(doc, 'Top Error Types', () => {
        if (!report.errorTypes.length) {
          doc.text('No error stats.');
          return;
        }
        report.errorTypes.forEach((item) => {
          doc.text(`${item.type}: ${item.count} (${this.formatRatio(item.ratio)})`);
        });
      });
    });
  }

  async getStudentOverview(
    studentId: string,
    query: ReportRangeQueryDto,
    user: AuthUser,
  ) {
    const { student, classIds } = await this.ensureStudentAccess(studentId, user);
    const days = query.days ?? 7;
    const cutoff = new Date(Date.now() - days * DAY_MS);

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId,
        createdAt: { gte: cutoff },
        status: SubmissionStatus.DONE,
        totalScore: { not: null },
        ...(classIds ? { homework: { classId: { in: classIds } } } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        totalScore: true,
        gradingJson: true,
      },
    });

    const scores = this.collectScores(submissions);

    return {
      studentId,
      studentName: student.name,
      rangeDays: days,
      summary: this.buildSummary(scores),
      trend: this.buildTrend(submissions, days),
      errorTypes: this.buildErrorTypes(submissions),
      nextSteps: this.buildNextSteps(submissions),
    };
  }

  async exportStudentPdf(studentId: string, query: ReportRangeQueryDto, user: AuthUser) {
    const report = await this.getStudentOverview(studentId, query, user);
    return this.renderPdf((doc) => {
      this.writeHeader(doc, 'Student Report', [
        `Student: ${report.studentName}`,
        `Student ID: ${report.studentId}`,
        `Range: last ${report.rangeDays} days`,
        `Generated: ${this.formatDateTime(new Date())}`,
      ]);

      this.writeSection(doc, 'Summary', () => {
        if (!report.summary.count) {
          doc.text('No completed submissions.');
          return;
        }
        this.writeKeyValues(doc, [
          ['Average', report.summary.avg],
          ['Highest', report.summary.max],
          ['Lowest', report.summary.min],
          ['Submissions', report.summary.count],
        ]);
      });

      this.writeSection(doc, 'Trend', () => {
        if (!report.trend.length) {
          doc.text('No trend data.');
          return;
        }
        report.trend.forEach((item) => {
          doc.text(`${item.date} - avg ${item.avg} (${item.count})`);
        });
      });

      this.writeSection(doc, 'Top Error Types', () => {
        if (!report.errorTypes.length) {
          doc.text('No error stats.');
          return;
        }
        report.errorTypes.forEach((item) => {
          doc.text(`${item.type}: ${item.count} (${this.formatRatio(item.ratio)})`);
        });
      });

      this.writeSection(doc, 'Next Steps', () => {
        if (!report.nextSteps.length) {
          doc.text('No next-step suggestions.');
          return;
        }
        report.nextSteps.forEach((item) => {
          doc.text(`- ${item.text} (${item.count})`);
        });
      });
    });
  }

  private async ensureClassAccess(classId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      const klass = await this.prisma.class.findUnique({ where: { id: classId } });
      if (!klass) {
        throw new NotFoundException('Class not found');
      }
      return klass;
    }

    if (user.role === Role.TEACHER) {
      const klass = await this.prisma.class.findFirst({
        where: { id: classId, teachers: { some: { id: user.id } } },
      });
      if (!klass) {
        throw new ForbiddenException('No access to this class');
      }
      return klass;
    }

    throw new ForbiddenException('Only teacher or admin can access class reports');
  }

  private async ensureStudentAccess(studentId: string, user: AuthUser) {
    const student = await this.prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (user.role === Role.ADMIN) {
      return { student, classIds: null as string[] | null };
    }

    if (user.role === Role.STUDENT) {
      if (user.id !== studentId) {
        throw new ForbiddenException('No access to this student');
      }
      return { student, classIds: null as string[] | null };
    }

    if (user.role === Role.TEACHER) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          studentId,
          class: { teachers: { some: { id: user.id } } },
        },
        select: { classId: true },
      });

      if (!enrollments.length) {
        throw new ForbiddenException('No access to this student');
      }

      return { student, classIds: enrollments.map((item) => item.classId) };
    }

    throw new ForbiddenException('Only teacher or admin can access student reports');
  }

  private collectScores(
    submissions: Array<{ totalScore: number | null }>,
  ): number[] {
    return submissions
      .map((submission) => submission.totalScore)
      .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));
  }

  private buildSummary(scores: number[]): ScoreSummary {
    if (!scores.length) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const total = scores.reduce((sum, score) => sum + score, 0);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = total / scores.length;

    return {
      avg: this.round(avg),
      min: this.round(min),
      max: this.round(max),
      count: scores.length,
    };
  }

  private buildDistribution(scores: number[]): DistributionBucket[] {
    const buckets = [
      { label: '0-59', min: 0, max: 59 },
      { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 },
      { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];

    const counts = new Map<string, number>();
    buckets.forEach((bucket) => counts.set(bucket.label, 0));

    for (const rawScore of scores) {
      const score = Math.max(0, Math.min(100, Math.round(rawScore)));
      const bucket = buckets.find((item) => score >= item.min && score <= item.max);
      if (bucket) {
        counts.set(bucket.label, (counts.get(bucket.label) || 0) + 1);
      }
    }

    return buckets.map((bucket) => ({
      bucket: bucket.label,
      count: counts.get(bucket.label) || 0,
    }));
  }

  private buildTrend(
    submissions: Array<{ createdAt: Date; totalScore: number | null }>,
    days: number,
  ): TrendPoint[] {
    const totals = new Map<string, { total: number; count: number }>();

    for (const submission of submissions) {
      if (typeof submission.totalScore !== 'number' || Number.isNaN(submission.totalScore)) {
        continue;
      }
      const key = this.toDateKey(submission.createdAt);
      const entry = totals.get(key) || { total: 0, count: 0 };
      entry.total += submission.totalScore;
      entry.count += 1;
      totals.set(key, entry);
    }

    const today = new Date();
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const trend: TrendPoint[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(start.getTime() - i * DAY_MS);
      const key = this.toDateKey(date);
      const entry = totals.get(key);
      const count = entry?.count || 0;
      trend.push({
        date: key,
        avg: count ? this.round(entry!.total / count) : 0,
        count,
      });
    }

    return trend;
  }

  private buildErrorTypes(
    submissions: Array<{ gradingJson: Prisma.JsonValue | null }>,
  ): ErrorTypeStat[] {
    const counts = new Map<string, number>();
    const baselineTypes = ['grammar', 'vocabulary', 'structure', 'content', 'coherence'];
    baselineTypes.forEach((type) => counts.set(type, 0));
    let totalErrors = 0;

    for (const submission of submissions) {
      const errors = this.extractErrors(submission.gradingJson);
      for (const error of errors) {
        const type = error.type || 'unknown';
        counts.set(type, (counts.get(type) || 0) + 1);
        totalErrors += 1;
      }
    }

    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        count,
        ratio: totalErrors ? this.roundRatio(count / totalErrors) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }

  private buildTopRank(submissions: ClassSubmission[], topN: number): TopRankItem[] {
    const stats = new Map<string, { name: string; total: number; count: number }>();

    for (const submission of submissions) {
      if (typeof submission.totalScore !== 'number' || Number.isNaN(submission.totalScore)) {
        continue;
      }
      const existing = stats.get(submission.student.id) || {
        name: submission.student.name,
        total: 0,
        count: 0,
      };
      existing.total += submission.totalScore;
      existing.count += 1;
      stats.set(submission.student.id, existing);
    }

    return Array.from(stats.entries())
      .map(([studentId, entry]) => ({
        studentId,
        name: entry.name,
        avgScore: entry.count ? this.round(entry.total / entry.count) : 0,
        count: entry.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count)
      .slice(0, topN);
  }

  private buildNextSteps(
    submissions: Array<{ gradingJson: Prisma.JsonValue | null }>,
  ): NextStepStat[] {
    const counts = new Map<string, number>();

    for (const submission of submissions) {
      const nextSteps = this.extractNextSteps(submission.gradingJson);
      for (const step of nextSteps) {
        const trimmed = step.trim();
        if (!trimmed) {
          continue;
        }
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private extractErrors(value: Prisma.JsonValue | null): Array<{ type?: string }> {
    const obj = this.asObject(value);
    if (!obj || !Array.isArray(obj.errors)) {
      return [];
    }
    return obj.errors
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return {};
        }
        const typeValue = (entry as { type?: unknown }).type;
        return { type: typeof typeValue === 'string' ? typeValue : undefined };
      });
  }

  private extractNextSteps(value: Prisma.JsonValue | null): string[] {
    const obj = this.asObject(value);
    if (!obj || !Array.isArray(obj.nextSteps)) {
      return [];
    }
    return obj.nextSteps.filter((entry): entry is string => typeof entry === 'string');
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private round(value: number): number {
    return Number(value.toFixed(1));
  }

  private roundRatio(value: number): number {
    return Number(value.toFixed(3));
  }

  private toCsvRow(values: Array<string | number | null>): string {
    return values
      .map((value) => {
        if (value === null || value === undefined) {
          return '';
        }
        const text = String(value);
        if (text.includes('"') || text.includes(',') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      })
      .join(',');
  }

  private renderPdf(build: (doc: PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));
      build(doc);
      doc.end();
    });
  }

  private writeHeader(doc: PDFDocument, title: string, lines: string[]) {
    doc.fontSize(18).text(title, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11);
    lines.forEach((line) => doc.text(line));
    doc.moveDown(1.2);
  }

  private writeSection(doc: PDFDocument, title: string, body: () => void) {
    doc.fontSize(14).text(title, { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11);
    body();
    doc.moveDown(0.8);
  }

  private writeKeyValues(doc: PDFDocument, rows: Array<[string, number | string]>) {
    rows.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`);
    });
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  private formatRatio(value: number): string {
    return `${Number((value * 100).toFixed(1))}%`;
  }
}
