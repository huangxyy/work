import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SubmissionStatus } from '@prisma/client';
import AdmZip = require('adm-zip');
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, promises as fs } from 'fs';
import type { Express } from 'express';
import PDFDocument from 'pdfkit';
import { basename, extname, isAbsolute, resolve } from 'path';
import { Readable } from 'stream';
import * as unzipper from 'unzipper';
import { AuthUser } from '../auth/auth.types';
import { GradingPolicyService } from '../grading-policy/grading-policy.service';
import { lateSubmissionConfigKey } from '../homeworks/homework.constants';
import { BaiduOcrService } from '../ocr/baidu-ocr.service';
import { BaiduOcrConfig } from '../ocr/ocr.types';
import { LlmConfigService, type LlmRuntimeConfig } from '../llm/llm-config.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RegradeHomeworkSubmissionsDto } from './dto/regrade-homework-submissions.dto';
import { StudentSubmissionsQueryDto } from './dto/student-submissions-query.dto';

type BatchImage = {
  fileKey: string;
  filename: string;
  mimeType?: string;
  path?: string;
  buffer?: Buffer;
};

type BatchSkip = {
  file: string;
  reason: string;
  fileKey?: string;
  analysisZh?: string;
  analysisEn?: string;
  confidence?: number;
  matchedAccount?: string | null;
  matchedBy?: string;
};

type BatchMatchResult = {
  file: string;
  fileKey: string;
  matchedAccount?: string | null;
  matchedName?: string | null;
  matchedBy?: string;
  confidence?: number;
  analysisZh?: string;
  analysisEn?: string;
  reason?: string;
};

type MatchOutcome = {
  account: string | null;
  matchedBy?: 'override' | 'filename' | 'ocr' | 'ai';
  confidence?: number;
  analysisZh?: string;
  analysisEn?: string;
  reason?: string;
};

type StudentCandidate = {
  id: string;
  account: string;
  name: string;
  normalized: string;
};

type PDFDocumentInstance = InstanceType<typeof PDFDocument>;

type PrintPacketOptions = {
  lang?: string;
  submissionIds?: string[];
};

type PrintPacketExport = {
  filename: string;
  mimeType: 'application/pdf' | 'application/zip';
  buffer: Buffer;
  totalStudents: number;
  files: number;
};

type PrintPacketEntry = {
  submissionId: string;
  studentName: string;
  studentAccount: string;
  totalScore: number | null;
  updatedAt: Date;
  summary: string;
  nextSteps: string[];
  rewrite: string;
  sampleEssay: string;
  errors: Array<{ type: string; message: string; original: string; suggestion: string }>;
};

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);
const MAX_BATCH_IMAGES = 100;
const DEFAULT_ZIP_MAX_BYTES = 104857600;
const DEFAULT_ZIP_UNCOMPRESSED_BYTES = 314572800;
const DEFAULT_ZIP_ENTRY_BYTES = 15728640;
const DEFAULT_PRINT_PACKET_MAX_PER_FILE = 30;
const DEFAULT_PRINT_PACKET_MAX_TOTAL = 120;
const PRINT_PACKET_MAX_PAGES_PER_STUDENT = 2;
const PRINT_PACKET_SUMMARY_MAX_CHARS = 700;
const PRINT_PACKET_REWRITE_MAX_CHARS = 1000;
const PRINT_PACKET_SAMPLE_MAX_CHARS = 1200;
const PRINT_PACKET_MAX_ERRORS = 8;
const PRINT_PACKET_MAX_NEXT_STEPS = 6;
const PRINT_PACKET_LINE_GAP = 6;
const MAX_ZIP_BYTES = Number.isFinite(Number(process.env.BATCH_ZIP_MAX_BYTES))
  ? Number(process.env.BATCH_ZIP_MAX_BYTES)
  : DEFAULT_ZIP_MAX_BYTES;
const MAX_ZIP_UNCOMPRESSED_BYTES = Number.isFinite(
  Number(process.env.BATCH_ZIP_MAX_UNCOMPRESSED_BYTES),
)
  ? Number(process.env.BATCH_ZIP_MAX_UNCOMPRESSED_BYTES)
  : DEFAULT_ZIP_UNCOMPRESSED_BYTES;
const MAX_ZIP_ENTRY_BYTES = Number.isFinite(Number(process.env.BATCH_ZIP_MAX_ENTRY_BYTES))
  ? Number(process.env.BATCH_ZIP_MAX_ENTRY_BYTES)
  : DEFAULT_ZIP_ENTRY_BYTES;
const PRINT_PACKET_MAX_PER_FILE = Number.isFinite(Number(process.env.PRINT_PACKET_MAX_PER_FILE))
  ? Number(process.env.PRINT_PACKET_MAX_PER_FILE)
  : DEFAULT_PRINT_PACKET_MAX_PER_FILE;
const PRINT_PACKET_MAX_TOTAL = Number.isFinite(Number(process.env.PRINT_PACKET_MAX_TOTAL))
  ? Number(process.env.PRINT_PACKET_MAX_TOTAL)
  : DEFAULT_PRINT_PACKET_MAX_TOTAL;

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queueService: QueueService,
    private readonly gradingPolicyService: GradingPolicyService,
    private readonly baiduOcrService: BaiduOcrService,
    private readonly systemConfigService: SystemConfigService,
    private readonly llmConfigService: LlmConfigService,
  ) {}

  async createSubmission(
    dto: CreateSubmissionDto,
    files: Express.Multer.File[],
    user: AuthUser,
  ) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can submit');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('Please upload at least 1 image');
    }

    if (files.length > 3) {
      throw new BadRequestException('Up to 3 images are allowed');
    }

    const nonImages = files.filter((file) => !file.mimetype.startsWith('image/'));
    if (nonImages.length > 0) {
      throw new BadRequestException('Only image files are allowed');
    }

    const homework = await this.prisma.homework.findFirst({
      where: {
        id: dto.homeworkId,
        class: {
          enrolls: { some: { studentId: user.id } },
        },
      },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    if (homework.dueAt && homework.dueAt.getTime() < Date.now()) {
      const allowLateSubmission = await this.isLateSubmissionAllowed(homework.id);
      if (!allowLateSubmission) {
        throw new BadRequestException(
          'Homework is overdue and submission is closed. Ask your teacher to allow late submission.',
        );
      }
    }

    const submission = await this.prisma.submission.create({
      data: {
        homeworkId: dto.homeworkId,
        studentId: user.id,
        status: SubmissionStatus.QUEUED,
      },
    });

    const images: Array<{ submissionId: string; objectKey: string }> = [];

    for (const file of files) {
      const objectKey = `submissions/${submission.id}/${randomUUID()}.jpg`;
      await this.storage.putObject(objectKey, file.buffer, file.mimetype);
      images.push({ submissionId: submission.id, objectKey });
    }

    if (images.length) {
      await this.prisma.submissionImage.createMany({ data: images });
    }

    // Resolve grading policy with DTO parameters, falling back to class/homework policy
    const resolvedPolicy = await this.resolveGradingOptions({
      classId: homework.classId,
      homeworkId: homework.id,
      mode: dto.mode,
      needRewrite: dto.needRewrite,
    });

    await this.queueService.enqueueGrading(submission.id, resolvedPolicy);

    return { submissionId: submission.id, status: submission.status };
  }

  async getSubmission(id: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return this.prisma.submission.findUnique({
        where: { id },
        include: {
          images: true,
          student: { select: { id: true, name: true, account: true } },
          homework: { select: { id: true, title: true } },
        },
      });
    }

    if (user.role === Role.STUDENT) {
      return this.prisma.submission.findFirst({
        where: { id, studentId: user.id },
        include: {
          images: true,
          student: { select: { id: true, name: true, account: true } },
          homework: { select: { id: true, title: true } },
        },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.submission.findFirst({
        where: {
          id,
          homework: {
            class: { teachers: { some: { id: user.id } } },
          },
        },
        include: {
          images: true,
          student: { select: { id: true, name: true, account: true } },
          homework: { select: { id: true, title: true } },
        },
      });
    }

    throw new ForbiddenException('No access');
  }

  async listStudentSubmissions(user: AuthUser) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can list submissions');
    }
    return this.listStudentSubmissionsWithQuery(user, {});
  }

  async listStudentSubmissionsWithQuery(user: AuthUser, query: StudentSubmissionsQueryDto) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can list submissions');
    }

    const where: Prisma.SubmissionWhereInput = {
      studentId: user.id,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.homeworkId) {
      where.homeworkId = query.homeworkId;
    }

    if (query.keyword) {
      where.homework = { title: { contains: query.keyword.trim() } };
    }

    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.totalScore = {
        ...(query.minScore !== undefined ? { gte: query.minScore } : {}),
        ...(query.maxScore !== undefined ? { lte: query.maxScore } : {}),
      };
    }

    if (query.from || query.to) {
      where.updatedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const submissions = await this.prisma.submission.findMany({
      where,
      include: { homework: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return submissions.map((submission) => ({
      id: submission.id,
      homeworkId: submission.homework.id,
      homeworkTitle: submission.homework.title,
      status: submission.status,
      totalScore: submission.totalScore,
      errorCode: submission.errorCode,
      errorMsg: submission.errorMsg,
      updatedAt: submission.updatedAt.toISOString(),
    }));
  }

  async exportStudentSubmissionsCsv(user: AuthUser, query: StudentSubmissionsQueryDto) {
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can export submissions');
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId: user.id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.keyword
          ? { homework: { title: { contains: query.keyword.trim() } } }
          : {}),
        ...(query.homeworkId ? { homeworkId: query.homeworkId } : {}),
        ...(query.minScore !== undefined || query.maxScore !== undefined
          ? {
              totalScore: {
                ...(query.minScore !== undefined ? { gte: query.minScore } : {}),
                ...(query.maxScore !== undefined ? { lte: query.maxScore } : {}),
              },
            }
          : {}),
        ...(query.from || query.to
          ? {
              updatedAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: { homework: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const rows: Array<Array<string | number | null>> = [
      this.getStudentExportHeaders(query.lang),
    ];

    for (const submission of submissions) {
      rows.push([
        submission.id,
        submission.homework.id,
        submission.homework.title,
        submission.status,
        submission.totalScore ?? '',
        submission.errorCode ?? '',
        submission.errorMsg ?? '',
        submission.updatedAt.toISOString(),
      ]);
    }

    return rows.map((row) => this.toCsvRow(row)).join('\n');
  }

  async listHomeworkSubmissions(homeworkId: string, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can access homework submissions');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { homeworkId },
      include: { student: { select: { id: true, name: true, account: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return submissions.map((submission) => ({
      id: submission.id,
      studentName: submission.student.name,
      studentAccount: submission.student.account,
      status: submission.status,
      totalScore: submission.totalScore,
      errorCode: submission.errorCode,
      errorMsg: submission.errorMsg,
      updatedAt: submission.updatedAt.toISOString(),
    }));
  }

  async exportHomeworkCsv(homeworkId: string, user: AuthUser, lang?: string) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can export');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true, title: true, classId: true, class: { select: { name: true } } },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { homeworkId },
      include: { student: { select: { id: true, name: true, account: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const rows: Array<Array<string | number | null>> = [
      this.getHomeworkExportHeaders(lang),
    ];

    for (const submission of submissions) {
      const extracted = this.extractGrading(submission.gradingJson);
      rows.push([
        submission.id,
        homework.classId,
        homework.class.name,
        homework.id,
        homework.title,
        submission.student.id,
        submission.student.name,
        submission.student.account,
        submission.status,
        submission.totalScore ?? '',
        submission.errorCode ?? '',
        submission.errorMsg ?? '',
        extracted.errorCount,
        extracted.summary,
        extracted.nextSteps.join('; '),
        extracted.rewrite,
        extracted.sampleEssay,
        submission.updatedAt.toISOString(),
      ]);
    }

    return rows.map((row) => this.toCsvRow(row)).join('\n');
  }

  async exportHomeworkImagesZip(homeworkId: string, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can export');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { homeworkId },
      include: {
        images: true,
        student: { select: { account: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const zip = new AdmZip();
    for (const submission of submissions) {
      for (const image of submission.images) {
        const buffer = await this.storage.getObject(image.objectKey);
        const filename = basename(image.objectKey);
        const entry = `${submission.student.account}/${submission.id}/${filename}`;
        zip.addFile(entry, buffer);
      }
    }

    return zip.toBuffer();
  }

  async exportHomeworkRemindersCsv(homeworkId: string, user: AuthUser, lang?: string) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can export');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: {
        id: true,
        title: true,
        classId: true,
        class: { select: { name: true } },
      },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: homework.classId },
      include: { student: { select: { id: true, name: true, account: true } } },
    });
    const submissions = await this.prisma.submission.findMany({
      where: { homeworkId },
      select: { studentId: true },
    });

    const submitted = new Set(submissions.map((item) => item.studentId));
    const rows: Array<Array<string | number | null>> = [
      this.getReminderExportHeaders(lang),
    ];

    for (const enrollment of enrollments) {
      if (submitted.has(enrollment.studentId)) {
        continue;
      }
      rows.push([
        homework.classId,
        homework.class.name,
        homework.id,
        homework.title,
        enrollment.student.id,
        enrollment.student.name,
        enrollment.student.account,
      ]);
    }

    return rows.map((row) => this.toCsvRow(row)).join('\n');
  }

  async exportHomeworkPrintPacket(
    homeworkId: string,
    user: AuthUser,
    options: PrintPacketOptions = {},
  ): Promise<PrintPacketExport> {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can export');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true, title: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const submissionIdSet = new Set(
      (options.submissionIds || [])
        .map((id) => id.trim())
        .filter(Boolean),
    );

    const where: Prisma.SubmissionWhereInput = {
      homeworkId,
      status: SubmissionStatus.DONE,
      ...(submissionIdSet.size ? { id: { in: Array.from(submissionIdSet) } } : {}),
    };

    const submissions = await this.prisma.submission.findMany({
      where,
      select: {
        id: true,
        totalScore: true,
        updatedAt: true,
        gradingJson: true,
        student: { select: { id: true, name: true, account: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!submissions.length) {
      throw new BadRequestException('No completed submissions found for print packet export');
    }

    const latestByStudent = new Map<string, (typeof submissions)[number]>();
    for (const submission of submissions) {
      if (!latestByStudent.has(submission.student.id)) {
        latestByStudent.set(submission.student.id, submission);
      }
    }

    const entries = Array.from(latestByStudent.values()).map((submission) => {
      const parsed = this.extractPrintPacketGrading(submission.gradingJson);
      return {
        submissionId: submission.id,
        studentName: submission.student.name,
        studentAccount: submission.student.account,
        totalScore: submission.totalScore,
        updatedAt: submission.updatedAt,
        summary: parsed.summary,
        nextSteps: parsed.nextSteps,
        rewrite: parsed.rewrite,
        sampleEssay: parsed.sampleEssay,
        errors: parsed.errors,
      } as PrintPacketEntry;
    });

    if (entries.length > PRINT_PACKET_MAX_TOTAL) {
      throw new BadRequestException(
        `Too many students (${entries.length}). Please export no more than ${PRINT_PACKET_MAX_TOTAL} at once.`,
      );
    }

    const perFile = Math.max(1, PRINT_PACKET_MAX_PER_FILE);
    const chunks = this.chunkArray(entries, perFile);
    const isZh = this.isZhLang(options.lang);

    if (chunks.length === 1) {
      const pdf = await this.renderPrintPacketPdf(chunks[0], {
        homeworkTitle: homework.title,
        homeworkId: homework.id,
        lang: options.lang,
      });
      return {
        filename: `homework-${homework.id}-print-packet.pdf`,
        mimeType: 'application/pdf',
        buffer: pdf,
        totalStudents: entries.length,
        files: 1,
      };
    }

    const zip = new AdmZip();
    for (let index = 0; index < chunks.length; index += 1) {
      const pdf = await this.renderPrintPacketPdf(chunks[index], {
        homeworkTitle: homework.title,
        homeworkId: homework.id,
        lang: options.lang,
      });
      const filename = isZh
        ? `作业批改单-${index + 1}.pdf`
        : `homework-print-packet-${index + 1}.pdf`;
      zip.addFile(filename, pdf);
    }

    return {
      filename: `homework-${homework.id}-print-packets.zip`,
      mimeType: 'application/zip',
      buffer: zip.toBuffer(),
      totalStudents: entries.length,
      files: chunks.length,
    };
  }

  async regradeHomeworkSubmissions(dto: RegradeHomeworkSubmissionsDto, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can regrade');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: dto.homeworkId }
          : { id: dto.homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true, classId: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { homeworkId: dto.homeworkId, status: SubmissionStatus.FAILED },
      select: { id: true },
    });

    if (!submissions.length) {
      return { homeworkId: dto.homeworkId, count: 0 };
    }

    const resolvedPolicy = await this.resolveGradingOptions({
      classId: homework.classId,
      homeworkId: homework.id,
      mode: dto.mode,
      needRewrite: dto.needRewrite,
    });

    const ids = submissions.map((item) => item.id);
    await this.prisma.submission.updateMany({
      where: { id: { in: ids } },
      data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
    });

    for (const id of ids) {
      await this.queueService.enqueueRegrade(id, {
        mode: resolvedPolicy.mode,
        needRewrite: resolvedPolicy.needRewrite,
      });
    }

    return { homeworkId: dto.homeworkId, count: ids.length };
  }

  async listBatchUploads(homeworkId: string, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can access batches');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: homeworkId }
          : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const batches = await this.prisma.batchUpload.findMany({
      where: { homeworkId },
      include: { uploader: { select: { id: true, name: true, account: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!batches.length) {
      return [];
    }

    const batchIds = batches.map((batch) => batch.id);
    const statusGroups = await this.prisma.submission.groupBy({
      by: ['batchId', 'status'],
      where: { batchId: { in: batchIds } },
      _count: { _all: true },
    });

    const statusMap = new Map<
      string,
      { queued: number; processing: number; done: number; failed: number }
    >();
    for (const group of statusGroups) {
      if (!group.batchId) {
        continue;
      }
      const entry = statusMap.get(group.batchId) || {
        queued: 0,
        processing: 0,
        done: 0,
        failed: 0,
      };
      const count = group._count._all;
      if (group.status === 'QUEUED') {
        entry.queued += count;
      } else if (group.status === 'PROCESSING') {
        entry.processing += count;
      } else if (group.status === 'DONE') {
        entry.done += count;
      } else if (group.status === 'FAILED') {
        entry.failed += count;
      }
      statusMap.set(group.batchId, entry);
    }

    return batches.map((batch) => {
      const counts = statusMap.get(batch.id) || {
        queued: 0,
        processing: 0,
        done: 0,
        failed: 0,
      };
      const totalSubmissions = batch.createdSubmissions || 0;
      let status = 'EMPTY';
      if (totalSubmissions > 0) {
        if (counts.done === totalSubmissions) {
          status = 'DONE';
        } else if (counts.failed === totalSubmissions) {
          status = 'FAILED';
        } else if (counts.processing > 0 || counts.queued > 0) {
          status = 'PROCESSING';
        } else {
          status = 'PARTIAL';
        }
      }

      return {
        id: batch.id,
        homeworkId: batch.homeworkId,
        uploader: batch.uploader,
        totalImages: batch.totalImages,
        matchedImages: batch.matchedImages,
        unmatchedCount: batch.unmatchedCount,
        createdSubmissions: batch.createdSubmissions,
        skipped: batch.skipped,
        mode: batch.mode,
        needRewrite: batch.needRewrite,
        createdAt: batch.createdAt.toISOString(),
        status,
        statusCounts: counts,
      };
    });
  }

  async getBatchUploadDetail(batchId: string, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can access batches');
    }

    const batch = await this.prisma.batchUpload.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: batchId }
          : { id: batchId, homework: { class: { teachers: { some: { id: user.id } } } } },
      include: {
        uploader: { select: { id: true, name: true, account: true } },
        homework: { select: { id: true, title: true } },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { batchId },
      include: { student: { select: { id: true, name: true, account: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const statusGroups = await this.prisma.submission.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });

    const counts = { queued: 0, processing: 0, done: 0, failed: 0 };
    for (const group of statusGroups) {
      const count = group._count._all;
      if (group.status === 'QUEUED') {
        counts.queued += count;
      } else if (group.status === 'PROCESSING') {
        counts.processing += count;
      } else if (group.status === 'DONE') {
        counts.done += count;
      } else if (group.status === 'FAILED') {
        counts.failed += count;
      }
    }

    let status = 'EMPTY';
    if (batch.createdSubmissions > 0) {
      if (counts.done === batch.createdSubmissions) {
        status = 'DONE';
      } else if (counts.failed === batch.createdSubmissions) {
        status = 'FAILED';
      } else if (counts.processing > 0 || counts.queued > 0) {
        status = 'PROCESSING';
      } else {
        status = 'PARTIAL';
      }
    }

    return {
      id: batch.id,
      homework: batch.homework,
      uploader: batch.uploader,
      totalImages: batch.totalImages,
      matchedImages: batch.matchedImages,
      unmatchedCount: batch.unmatchedCount,
      createdSubmissions: batch.createdSubmissions,
      skipped: batch.skipped,
      mode: batch.mode,
      needRewrite: batch.needRewrite,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      status,
      statusCounts: counts,
      submissions: submissions.map((submission) => ({
        id: submission.id,
        studentName: submission.student.name,
        studentAccount: submission.student.account,
        status: submission.status,
        totalScore: submission.totalScore,
        errorCode: submission.errorCode,
        errorMsg: submission.errorMsg,
        updatedAt: submission.updatedAt.toISOString(),
      })),
    };
  }

  async regradeBatchSubmissions(batchId: string, user: AuthUser) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can regrade batch');
    }

    const batch = await this.prisma.batchUpload.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: batchId }
          : { id: batchId, homework: { class: { teachers: { some: { id: user.id } } } } },
      select: { id: true, homeworkId: true, mode: true, needRewrite: true },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found or no access');
    }

    const submissions = await this.prisma.submission.findMany({
      where: { batchId, status: SubmissionStatus.FAILED },
      select: { id: true },
    });

    if (!submissions.length) {
      return { batchId, count: 0 };
    }

    const resolvedPolicy = await this.resolveGradingOptions({
      homeworkId: batch.homeworkId,
      mode: (batch.mode as 'cheap' | 'quality' | null) || undefined,
      needRewrite: batch.needRewrite,
    });

    const ids = submissions.map((item) => item.id);
    await this.prisma.submission.updateMany({
      where: { id: { in: ids } },
      data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
    });

    for (const id of ids) {
      await this.queueService.enqueueRegrade(id, {
        mode: resolvedPolicy.mode,
        needRewrite: resolvedPolicy.needRewrite,
      });
    }

    return { batchId, count: ids.length };
  }

  async createBatchSubmissions(
    dto: CreateBatchSubmissionsDto,
    files: { images?: Express.Multer.File[]; archive?: Express.Multer.File[] },
    user: AuthUser,
  ) {
    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('Only teacher or admin can upload');
    }

    const homework = await this.prisma.homework.findFirst({
      where:
        user.role === Role.ADMIN
          ? { id: dto.homeworkId }
          : { id: dto.homeworkId, class: { teachers: { some: { id: user.id } } } },
      select: { id: true, classId: true },
    });

    if (!homework) {
      throw new NotFoundException('Homework not found or no access');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: homework.classId },
      include: { student: { select: { id: true, account: true, name: true } } },
    });

    const candidates: StudentCandidate[] = enrollments
      .map((enrollment) => enrollment.student)
      .filter((student) => student.account)
      .map((student) => ({
        id: student.id,
        account: student.account,
        name: student.name,
        normalized: this.normalizeAccountValue(student.account),
      }))
      .filter((student) => student.normalized);
    const accountMap = new Map(candidates.map((student) => [student.account, student]));
    const accountList = candidates.map((student) => student.account).sort((a, b) => b.length - a.length);

    const mappingOverrides = this.parseMappingOverrides(dto.mappingOverrides);
    const dryRun = Boolean(dto.dryRun);

    const tempPaths = new Set<string>();
    const skipped: BatchSkip[] = [];
    const images: BatchImage[] = [];
    const totalUncompressed = { value: 0 };

    const uploadImages = files?.images || [];
    const archiveFiles = files?.archive || [];

    try {
      for (let index = 0; index < uploadImages.length; index += 1) {
        const file = uploadImages[index];
        if (file.path) {
          tempPaths.add(file.path);
        }
        const fileKey = `image:${index}:${file.originalname}`;
        if (!file.mimetype?.startsWith('image/')) {
          skipped.push({
            file: file.originalname,
            reason: 'NON_IMAGE',
            fileKey,
            ...this.buildMatchAnalysis(
              `文件类型不支持（${file.mimetype || 'unknown'}），请上传 JPG/PNG/WebP/TIFF 或 ZIP。`,
              `Unsupported file type (${file.mimetype || 'unknown'}). Please upload JPG/PNG/WebP/TIFF or ZIP.`,
            ),
          });
          continue;
        }
        images.push({
          fileKey,
          filename: file.originalname,
          mimeType: file.mimetype,
          path: file.path,
          buffer: file.buffer,
        });
      }

      for (const file of archiveFiles) {
        if (file.path) {
          tempPaths.add(file.path);
        }
        const archiveSize = file.size || file.buffer?.length || 0;
        if (archiveSize > MAX_ZIP_BYTES) {
          throw new BadRequestException(`Zip file too large (max ${MAX_ZIP_BYTES} bytes)`);
        }
        await this.extractZipEntries(file, {
          images,
          skipped,
          totalUncompressed,
          dryRun,
        });
      }

      if (images.length === 0) {
        throw new BadRequestException('Please upload at least 1 image');
      }

      if (images.length > MAX_BATCH_IMAGES) {
        throw new BadRequestException(`Up to ${MAX_BATCH_IMAGES} images are allowed`);
      }

      const grouped = new Map<string, BatchImage[]>();
      const unmatched: BatchSkip[] = [];
      const matchResults: BatchMatchResult[] = [];
      const ocrConfig = await this.getOcrConfig();
      const llmRuntime = await this.llmConfigService.resolveRuntimeConfig();
      let matchedImages = 0;
      for (const image of images) {
        const outcome = await this.resolveAccountForImage({
          image,
          candidates,
          accountMap,
          accountList,
          overrides: mappingOverrides,
          ocrConfig,
          llmRuntime,
        });
        const matchedStudent = outcome.account ? accountMap.get(outcome.account) : undefined;
        matchResults.push({
          file: image.filename,
          fileKey: image.fileKey,
          matchedAccount: outcome.account,
          matchedName: matchedStudent?.name,
          matchedBy: outcome.matchedBy,
          confidence: outcome.confidence,
          analysisZh: outcome.analysisZh,
          analysisEn: outcome.analysisEn,
          reason: outcome.reason,
        });
        if (!outcome.account || !matchedStudent) {
          unmatched.push({
            file: image.filename,
            reason: outcome.reason || 'ACCOUNT_NOT_FOUND',
            fileKey: image.fileKey,
            analysisZh: outcome.analysisZh,
            analysisEn: outcome.analysisEn,
            confidence: outcome.confidence,
            matchedAccount: outcome.account,
            matchedBy: outcome.matchedBy,
          });
          continue;
        }
        const bucket = grouped.get(outcome.account);
        if (bucket) {
          bucket.push(image);
        } else {
          grouped.set(outcome.account, [image]);
        }
        matchedImages += 1;
        if (dryRun && image.buffer) {
          image.buffer = undefined;
        }
      }

      if (dryRun) {
        const groups = Array.from(grouped.entries()).map(([account, items]) => {
          const student = accountMap.get(account);
          return {
            account,
            name: student?.name || account,
            imageCount: items.length,
          };
        });
        return {
          preview: true,
          totalImages: images.length,
          matchedImages,
          unmatchedCount: unmatched.length,
          groups,
          unmatched,
          skipped,
          matchResults,
        };
      }

      const skippedForRecord = unmatched.length ? [...skipped, ...unmatched] : [...skipped];

      if (grouped.size === 0) {
        throw new BadRequestException('No images matched enrolled students');
      }

      // Resolve grading policy with DTO parameters, falling back to class/homework policy
      const resolvedPolicy = await this.resolveGradingOptions({
        classId: homework.classId,
        homeworkId: homework.id,
        mode: dto.mode,
        needRewrite: dto.needRewrite,
      });

      const batch = await this.prisma.batchUpload.create({
        data: {
          homeworkId: homework.id,
          uploaderId: user.id,
          totalImages: images.length,
          matchedImages,
          unmatchedCount: unmatched.length,
          createdSubmissions: 0,
          skipped: skippedForRecord as Prisma.InputJsonValue,
          mode: resolvedPolicy.mode,
          needRewrite: resolvedPolicy.needRewrite,
        },
      });

      const submissions: Array<{
        submissionId: string;
        studentAccount: string;
        studentName: string;
        imageCount: number;
      }> = [];
      let acceptedImages = 0;

      for (const [account, batchImages] of grouped) {
        const student = accountMap.get(account);
        if (!student) {
          skipped.push({ file: account, reason: 'STUDENT_NOT_FOUND' });
          continue;
        }

        const submission = await this.prisma.submission.create({
          data: {
            homeworkId: homework.id,
            studentId: student.id,
            batchId: batch.id,
            status: SubmissionStatus.QUEUED,
          },
        });

        const imageRecords: Array<{ submissionId: string; objectKey: string }> = [];

        for (const image of batchImages) {
          const buffer = await this.loadImageBuffer(image);
          const extension = this.resolveImageExtension(image);
          const objectKey = `submissions/${submission.id}/${randomUUID()}.${extension}`;
          const contentType = image.mimeType || this.mapImageMimeType(`.${extension}`);
          await this.storage.putObject(objectKey, buffer, contentType);
          imageRecords.push({ submissionId: submission.id, objectKey });
          acceptedImages += 1;
        }

        if (imageRecords.length) {
          await this.prisma.submissionImage.createMany({ data: imageRecords });
        }

        await this.queueService.enqueueGrading(submission.id, {
          mode: resolvedPolicy.mode,
          needRewrite: resolvedPolicy.needRewrite,
        });

        submissions.push({
          submissionId: submission.id,
          studentAccount: student.account,
          studentName: student.name,
          imageCount: imageRecords.length,
        });
      }

      await this.prisma.batchUpload.update({
        where: { id: batch.id },
        data: { createdSubmissions: submissions.length },
      });

      return {
        homeworkId: homework.id,
        totalImages: images.length,
        acceptedImages,
        createdSubmissions: submissions.length,
        skipped: skippedForRecord,
        submissions,
        batchId: batch.id,
        matchResults,
      };
    } finally {
      await this.cleanupTempFiles(tempPaths);
    }
  }

  async requestRegrade(
    id: string,
    options: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
    user: AuthUser,
  ) {
    const submission = await this.getSubmission(id, user);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    await this.prisma.submission.update({
      where: { id },
      data: {
        status: SubmissionStatus.QUEUED,
        errorCode: null,
        errorMsg: null,
      },
    });

    const scope = await this.prisma.submission.findUnique({
      where: { id },
      select: { homeworkId: true, homework: { select: { classId: true } } },
    });
    const resolvedPolicy = await this.resolveGradingOptions({
      classId: scope?.homework?.classId,
      homeworkId: scope?.homeworkId,
      mode: options.mode,
      needRewrite: options.needRewrite,
    });

    await this.queueService.enqueueRegrade(id, resolvedPolicy);
    return { submissionId: id, status: SubmissionStatus.QUEUED };
  }

  private async resolveGradingOptions(params: {
    classId?: string | null;
    homeworkId?: string | null;
    mode?: 'cheap' | 'quality';
    needRewrite?: boolean;
  }) {
    if (params.mode !== undefined && params.needRewrite !== undefined) {
      return { mode: params.mode, needRewrite: params.needRewrite };
    }
    const resolved = await this.gradingPolicyService.resolvePolicy({
      classId: params.classId || undefined,
      homeworkId: params.homeworkId || undefined,
    });
    return {
      mode: params.mode ?? resolved.mode,
      needRewrite: params.needRewrite ?? resolved.needRewrite,
    };
  }

  private async getOcrConfig(): Promise<Partial<BaiduOcrConfig>> {
    const stored = await this.systemConfigService.getValue<{
      apiKey?: string;
      secretKey?: string;
    }>('ocr');
    return {
      apiKey: stored?.apiKey?.trim(),
      secretKey: stored?.secretKey?.trim(),
    };
  }

  private async isLateSubmissionAllowed(homeworkId: string): Promise<boolean> {
    const value = await this.systemConfigService.getValue<boolean>(lateSubmissionConfigKey(homeworkId));
    return value === true;
  }

  private resolveAccount(
    filename: string,
    accountMap: Map<string, StudentCandidate>,
    accounts: string[],
  ): string | null {
    const normalized = filename.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length > 1) {
      const folder = segments[0];
      if (accountMap.has(folder)) {
        return folder;
      }
    }

    const baseName = basename(normalized, extname(normalized));
    if (accountMap.has(baseName)) {
      return baseName;
    }

    for (const account of accounts) {
      if (baseName.startsWith(account)) {
        const nextChar = baseName.slice(account.length, account.length + 1);
        if (!nextChar || nextChar === '_' || nextChar === '-' || nextChar === '.') {
          return account;
        }
      }
    }

    return null;
  }

  private resolveAccountWithOverrides(
    image: BatchImage,
    accountMap: Map<string, StudentCandidate>,
    accounts: string[],
    overrides: Map<string, string> | null,
  ): string | null {
    if (overrides && overrides.size) {
      const override = overrides.get(image.fileKey);
      if (override) {
        return accountMap.has(override) ? override : null;
      }
    }
    return this.resolveAccount(image.filename, accountMap, accounts);
  }

  private normalizeAccountValue(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private buildMatchAnalysis(analysisZh: string, analysisEn: string) {
    return { analysisZh, analysisEn };
  }

  private selectLongestMatches(matches: StudentCandidate[]): StudentCandidate[] {
    if (!matches.length) {
      return [];
    }
    const maxLength = Math.max(...matches.map((match) => match.normalized.length));
    return matches.filter((match) => match.normalized.length === maxLength);
  }

  private findAccountMatches(text: string, candidates: StudentCandidate[]): StudentCandidate[] {
    const normalizedText = this.normalizeAccountValue(text);
    if (!normalizedText) {
      return [];
    }
    return candidates.filter((candidate) => candidate.normalized && normalizedText.includes(candidate.normalized));
  }

  private async resolveAccountForImage(params: {
    image: BatchImage;
    candidates: StudentCandidate[];
    accountMap: Map<string, StudentCandidate>;
    accountList: string[];
    overrides: Map<string, string> | null;
    ocrConfig: Partial<BaiduOcrConfig>;
    llmRuntime: LlmRuntimeConfig;
  }): Promise<MatchOutcome> {
    const { image, candidates, accountMap, accountList, overrides, ocrConfig, llmRuntime } = params;
    if (!candidates.length) {
      return {
        account: null,
        reason: 'ACCOUNT_NOT_FOUND',
        ...this.buildMatchAnalysis('未找到班级学生名单，无法匹配学号。', 'No student roster available; unable to match.'),
      };
    }

    if (overrides && overrides.size) {
      const override = overrides.get(image.fileKey);
      if (override) {
        if (accountMap.has(override)) {
          return {
            account: override,
            matchedBy: 'override',
            confidence: 1,
            ...this.buildMatchAnalysis(
              `已使用老师手动指定的学生账号 ${override}。`,
              `Used teacher override to assign account ${override}.`,
            ),
          };
        }
        return {
          account: null,
          reason: 'OVERRIDE_NOT_FOUND',
          ...this.buildMatchAnalysis(
            `手动指定的账号 ${override} 不在班级学生名单内。`,
            `Override account ${override} is not in the class roster.`,
          ),
        };
      }
    }

    const filenameMatch = this.resolveAccount(image.filename, accountMap, accountList);
    if (filenameMatch) {
      return {
        account: filenameMatch,
        matchedBy: 'filename',
        confidence: 0.9,
        ...this.buildMatchAnalysis(
          `从文件名或文件夹识别到学号 ${filenameMatch}。`,
          `Matched account ${filenameMatch} from filename or folder.`,
        ),
      };
    }

    const ocrResult = await this.extractOcrText(image, ocrConfig);
    if (!ocrResult.text) {
      if (ocrResult.error) {
        const detail = ocrResult.error.length > 160
          ? `${ocrResult.error.slice(0, 160)}...`
          : ocrResult.error;
        return {
          account: null,
          reason: 'OCR_FAILED',
          ...this.buildMatchAnalysis(
            `OCR 识别失败：${detail}，无法匹配学号。`,
            `OCR failed: ${detail}; unable to match an account.`,
          ),
        };
      }
      return {
        account: null,
        reason: 'OCR_EMPTY',
        ...this.buildMatchAnalysis('OCR 文本为空，无法匹配学号。', 'OCR text is empty; unable to match an account.'),
      };
    }

    const directMatches = this.findAccountMatches(ocrResult.text, candidates);
    if (directMatches.length) {
      const bestMatches = this.selectLongestMatches(directMatches);
      if (bestMatches.length === 1) {
        return {
          account: bestMatches[0].account,
          matchedBy: 'ocr',
          confidence: 0.9,
          ...this.buildMatchAnalysis(
            `OCR 文本中识别到学号 ${bestMatches[0].account}。`,
            `Detected account ${bestMatches[0].account} in OCR text.`,
          ),
        };
      }
    }

    return this.matchWithLlm({
      text: ocrResult.text,
      candidates: directMatches.length ? this.selectLongestMatches(directMatches) : candidates,
      accountMap,
      llmRuntime,
    });
  }

  private async extractOcrText(image: BatchImage, ocrConfig: Partial<BaiduOcrConfig>): Promise<{
    text?: string;
    error?: string;
  }> {
    try {
      const buffer = await this.loadImageBuffer(image);
      const result = await this.baiduOcrService.recognize(buffer, ocrConfig);
      const text = result.text?.trim() || '';
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OCR error';
      this.logger.warn(`OCR failed for ${image.filename}: ${message}`);
      return { text: '', error: message };
    }
  }

  private async matchWithLlm(params: {
    text: string;
    candidates: StudentCandidate[];
    accountMap: Map<string, StudentCandidate>;
    llmRuntime: LlmRuntimeConfig;
  }): Promise<MatchOutcome> {
    const { text, candidates, accountMap, llmRuntime } = params;
    if (!llmRuntime.baseUrl || !llmRuntime.model) {
      return {
        account: null,
        reason: 'AI_NOT_CONFIGURED',
        ...this.buildMatchAnalysis('未配置 AI 模型，无法进一步匹配。', 'LLM is not configured; unable to match further.'),
      };
    }

    const prompt = this.buildMatchPrompt(text, candidates);
    const payload: Record<string, unknown> = {
      model: llmRuntime.model,
      messages: [
        { role: 'system', content: this.buildMatchSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      max_tokens: Math.min(llmRuntime.maxTokens ?? 400, 500),
      temperature: 0,
    };

    const topP = llmRuntime.topP;
    const presencePenalty = llmRuntime.presencePenalty;
    const frequencyPenalty = llmRuntime.frequencyPenalty;
    const stop = llmRuntime.stop;

    if (typeof topP === 'number') {
      payload.top_p = topP;
    }
    if (typeof presencePenalty === 'number') {
      payload.presence_penalty = presencePenalty;
    }
    if (typeof frequencyPenalty === 'number') {
      payload.frequency_penalty = frequencyPenalty;
    }
    if (stop?.length) {
      payload.stop = stop;
    }

    payload.response_format = { type: 'json_object' };

    const apiUrl = this.resolveLlmApiUrl(llmRuntime);
    let response: {
      ok: boolean;
      status: number;
      errorText: string;
      data: { choices?: Array<{ message?: { content?: string }; text?: string }> } | null;
    };
    try {
      response = await this.fetchCompletion(apiUrl, payload, llmRuntime);
      if (!response.ok && this.isResponseFormatUnsupported(response.status, response.errorText)) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as { response_format?: unknown }).response_format;
        response = await this.fetchCompletion(apiUrl, fallbackPayload, llmRuntime);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown LLM error';
      this.logger.warn(`LLM match request failed: ${message}`);
      const detail = message.length > 160 ? `${message.slice(0, 160)}...` : message;
      return {
        account: null,
        reason: 'AI_FAILED',
        ...this.buildMatchAnalysis(
          `AI 请求失败：${detail}，无法匹配学号。`,
          `AI request failed: ${detail}; unable to match an account.`,
        ),
      };
    }

    if (!response.ok) {
      this.logger.warn(`LLM match failed: ${response.status} ${response.errorText}`);
      const detail = `${response.status} ${response.errorText || ''}`.trim();
      const brief = detail.length > 160 ? `${detail.slice(0, 160)}...` : detail;
      return {
        account: null,
        reason: 'AI_FAILED',
        ...this.buildMatchAnalysis(
          `AI 请求失败：${brief || 'unknown error'}，无法匹配学号。`,
          `AI request failed: ${brief || 'unknown error'}; unable to match an account.`,
        ),
      };
    }

    let content = '';
    try {
      content = this.extractLlmContent(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LLM response missing content';
      this.logger.warn(`LLM match parse failed: ${message}`);
      return {
        account: null,
        reason: 'AI_PARSE_FAILED',
        ...this.buildMatchAnalysis('AI 返回内容为空或缺失。', 'AI response content is missing.'),
      };
    }

    const parsed = this.parseMatchResponse(content);
    if (!parsed) {
      return {
        account: null,
        reason: 'AI_PARSE_FAILED',
        ...this.buildMatchAnalysis('AI 返回格式无法解析。', 'AI response format could not be parsed.'),
      };
    }

    const account = typeof parsed.matchedAccount === 'string' ? parsed.matchedAccount.trim() : null;
    const confidence = this.normalizeConfidence(parsed.confidence);
    const analysisZh = typeof parsed.analysisZh === 'string' ? parsed.analysisZh.trim() : '';
    const analysisEn = typeof parsed.analysisEn === 'string' ? parsed.analysisEn.trim() : '';
    const fallbackAnalysis = this.buildMatchAnalysis(
      account ? `AI 识别结果：${account}。` : 'AI 未能确定学号，建议人工指定。',
      account ? `AI matched account ${account}.` : 'AI could not determine the account; manual assignment recommended.',
    );
    const mergedAnalysis = {
      analysisZh: analysisZh || fallbackAnalysis.analysisZh,
      analysisEn: analysisEn || fallbackAnalysis.analysisEn,
    };

    if (account && accountMap.has(account)) {
      if (confidence !== undefined && confidence < 0.6) {
        return {
          account: null,
          reason: 'AI_AMBIGUOUS',
          confidence,
          ...mergedAnalysis,
        };
      }
      return {
        account,
        matchedBy: 'ai',
        confidence,
        ...mergedAnalysis,
      };
    }

    return {
      account: null,
      reason: 'AI_NO_MATCH',
      confidence,
      ...mergedAnalysis,
    };
  }

  private buildMatchSystemPrompt() {
    return [
      'You are a careful assistant that matches student accounts from OCR text.',
      'Return ONLY valid JSON with keys: matchedAccount, confidence, analysisZh, analysisEn.',
      'If you are not confident, set matchedAccount to null and confidence to 0.',
      'analysisZh must be Chinese, analysisEn must be English.',
    ].join('\n');
  }

  private buildMatchPrompt(text: string, candidates: StudentCandidate[]) {
    const snippet = text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
    const candidateLines = candidates.map((candidate, index) => {
      const name = candidate.name || candidate.account;
      return `${index + 1}. ${candidate.account} - ${name}`;
    });
    return [
      'OCR TEXT:',
      snippet,
      '',
      'STUDENT CANDIDATES (account - name):',
      ...candidateLines,
    ].join('\n');
  }

  private normalizeConfidence(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(1, Math.max(0, value));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return Math.min(1, Math.max(0, parsed));
      }
    }
    return undefined;
  }

  private parseMatchResponse(raw: string): {
    matchedAccount?: unknown;
    confidence?: unknown;
    analysisZh?: unknown;
    analysisEn?: unknown;
  } | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    const fenced = this.extractCodeFence(trimmed);
    const candidates = [trimmed, fenced].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      const parsed = this.tryParseJson(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as {
          matchedAccount?: unknown;
          confidence?: unknown;
          analysisZh?: unknown;
          analysisEn?: unknown;
        };
      }
    }
    return null;
  }

  private extractCodeFence(input: string): string | null {
    const match = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!match) {
      return null;
    }
    return match[1].trim();
  }

  private tryParseJson(input: string): unknown | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  private resolveLlmApiUrl(runtime: LlmRuntimeConfig): string {
    const base = (runtime.baseUrl || '').replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      return base;
    }
    const customPath = this.normalizeText(runtime.path || '');
    if (customPath) {
      if (customPath.startsWith('http://') || customPath.startsWith('https://')) {
        return customPath;
      }
      return `${base}${customPath.startsWith('/') ? '' : '/'}${customPath}`;
    }
    return `${base}/v1/chat/completions`;
  }

  private async fetchCompletion(
    url: string,
    payload: Record<string, unknown>,
    runtime: LlmRuntimeConfig,
  ): Promise<{
    ok: boolean;
    status: number;
    errorText: string;
    data: {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
    } | null;
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...runtime.headers,
    };
    if (runtime.apiKey) {
      headers.Authorization = `Bearer ${runtime.apiKey}`;
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }, runtime.timeoutMs ?? 20000);

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, errorText: text, data: null };
    }

    let data: { choices?: Array<{ message?: { content?: string }; text?: string }> } | null = null;
    try {
      data = text ? (JSON.parse(text) as typeof data) : null;
    } catch {
      data = null;
    }
    return { ok: true, status: response.status, errorText: '', data };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractLlmContent(data: {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  } | null): string {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (!content) {
      throw new Error('LLM response missing content');
    }
    return content.trim();
  }

  private isResponseFormatUnsupported(status: number, errorText: string): boolean {
    if (status !== 400 && status !== 422) {
      return false;
    }
    const text = errorText.toLowerCase();
    return text.includes('response_format') || text.includes('json_object') || text.includes('unsupported');
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }

  private parseMappingOverrides(raw?: string): Map<string, string> | null {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const entries = Object.entries(parsed || {})
        .map(([key, value]) => [String(key), String(value).trim()] as [string, string])
        .filter(([, value]) => value);
      return new Map(entries);
    } catch {
      return null;
    }
  }

  private async loadImageBuffer(image: BatchImage): Promise<Buffer> {
    if (image.buffer) {
      return image.buffer;
    }
    if (image.path) {
      return fs.readFile(image.path);
    }
    throw new Error('Missing image buffer');
  }

  private resolveImageExtension(image: BatchImage): string {
    const extension = extname(image.filename).toLowerCase();
    if (extension && ALLOWED_IMAGE_EXTS.has(extension)) {
      return extension.replace('.', '') || 'jpg';
    }
    return image.mimeType === 'image/png' ? 'png' : 'jpg';
  }

  private mapImageMimeType(extension: string): string {
    switch (extension.toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.tif':
      case '.tiff':
        return 'image/tiff';
      case '.jpeg':
      case '.jpg':
      default:
        return 'image/jpeg';
    }
  }

  private isHiddenZipEntry(entryName: string): boolean {
    const normalized = entryName.replace(/\\/g, '/');
    if (normalized.startsWith('__MACOSX') || normalized.includes('/__MACOSX')) {
      return true;
    }
    const base = basename(normalized);
    return base.startsWith('.');
  }

  private async extractZipEntries(
    file: Express.Multer.File,
    options: {
      images: BatchImage[];
      skipped: BatchSkip[];
      totalUncompressed: { value: number };
      dryRun: boolean;
    },
  ) {
    const source = file.buffer
      ? Readable.from([file.buffer])
      : file.path
        ? createReadStream(file.path)
        : null;
    if (!source) {
      return;
    }

    const parser = source.pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of parser) {
      if (entry.type === 'Directory') {
        entry.autodrain();
        continue;
      }

      const entryName = entry.path.replace(/\\/g, '/');
      if (this.isHiddenZipEntry(entryName)) {
        entry.autodrain();
        continue;
      }

      const fileKey = `zip:${entryName}`;
      const extension = extname(entryName).toLowerCase();
      if (!ALLOWED_IMAGE_EXTS.has(extension)) {
        options.skipped.push({
          file: entryName,
          reason: 'NON_IMAGE',
          fileKey,
          ...this.buildMatchAnalysis(
            `压缩包内文件格式 ${extension || 'unknown'} 不支持，仅支持 JPG/PNG/WebP/TIFF。`,
            `Unsupported zip entry format ${extension || 'unknown'}. Supported: JPG/PNG/WebP/TIFF.`,
          ),
        });
        entry.autodrain();
        continue;
      }

      if (options.images.length >= MAX_BATCH_IMAGES) {
        entry.autodrain();
        throw new BadRequestException(`Up to ${MAX_BATCH_IMAGES} images are allowed`);
      }

      const declaredSize = this.getZipEntrySize(entry);
      if (declaredSize !== null && declaredSize > MAX_ZIP_ENTRY_BYTES) {
        entry.autodrain();
        throw new BadRequestException(`Zip entry too large (max ${MAX_ZIP_ENTRY_BYTES} bytes)`);
      }
      if (
        declaredSize !== null &&
        options.totalUncompressed.value + declaredSize > MAX_ZIP_UNCOMPRESSED_BYTES
      ) {
        entry.autodrain();
        throw new BadRequestException('Zip exceeds uncompressed size limit');
      }

      if (options.dryRun) {
        const buffer = await this.readEntryBuffer(entry, MAX_ZIP_ENTRY_BYTES);
        options.totalUncompressed.value += buffer.length;
        if (options.totalUncompressed.value > MAX_ZIP_UNCOMPRESSED_BYTES) {
          throw new BadRequestException('Zip exceeds uncompressed size limit');
        }
        options.images.push({
          fileKey,
          filename: entryName,
          mimeType: this.mapImageMimeType(extension),
          buffer,
        });
        continue;
      }

      const buffer = await this.readEntryBuffer(entry, MAX_ZIP_ENTRY_BYTES);
      options.totalUncompressed.value += buffer.length;
      if (options.totalUncompressed.value > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new BadRequestException('Zip exceeds uncompressed size limit');
      }
      options.images.push({
        fileKey,
        filename: entryName,
        mimeType: this.mapImageMimeType(extension),
        buffer,
      });
    }
  }

  private async readEntryBuffer(entry: unzipper.Entry, limitBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of entry) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > limitBytes) {
        entry.autodrain();
        throw new BadRequestException(`Zip entry too large (max ${limitBytes} bytes)`);
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, total);
  }

  private async drainEntry(entry: unzipper.Entry, limitBytes: number): Promise<number> {
    let total = 0;
    for await (const chunk of entry) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > limitBytes) {
        entry.autodrain();
        throw new BadRequestException(`Zip entry too large (max ${limitBytes} bytes)`);
      }
    }
    return total;
  }

  private getZipEntrySize(entry: unzipper.Entry): number | null {
    const size = (entry as { vars?: { uncompressedSize?: number } }).vars?.uncompressedSize;
    if (typeof size === 'number' && Number.isFinite(size)) {
      return size;
    }
    return null;
  }

  private async cleanupTempFiles(paths: Set<string>) {
    const tasks = Array.from(paths).map((filePath) => fs.unlink(filePath).catch(() => undefined));
    await Promise.all(tasks);
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    if (!items.length) {
      return [];
    }
    const chunkSize = Math.max(1, size);
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
  }

  private extractPrintPacketGrading(value: Prisma.JsonValue | null): {
    summary: string;
    nextSteps: string[];
    rewrite: string;
    sampleEssay: string;
    errors: Array<{ type: string; message: string; original: string; suggestion: string }>;
  } {
    const obj = this.asObject(value);
    const suggestions = this.asObject(obj?.suggestions as Prisma.JsonValue | null);
    const summary = this.trimText(this.readString(obj?.summary), PRINT_PACKET_SUMMARY_MAX_CHARS);
    const rewrite = this.trimText(
      this.readString(suggestions?.rewrite),
      PRINT_PACKET_REWRITE_MAX_CHARS,
    );
    const sampleEssay = this.trimText(
      this.readString(suggestions?.sampleEssay),
      PRINT_PACKET_SAMPLE_MAX_CHARS,
    );

    const nextSteps = Array.isArray(obj?.nextSteps)
      ? (obj.nextSteps as unknown[])
          .filter((item) => typeof item === 'string')
          .map((item) => this.trimText(String(item), 180))
          .filter(Boolean)
          .slice(0, PRINT_PACKET_MAX_NEXT_STEPS)
      : [];

    const errorsRaw = Array.isArray(obj?.errors) ? (obj.errors as unknown[]) : [];
    const errors = errorsRaw
      .filter((item) => typeof item === 'object' && item !== null)
      .slice(0, PRINT_PACKET_MAX_ERRORS)
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          type: this.trimText(this.readString(row.type), 40),
          message: this.trimText(this.readString(row.message), 180),
          original: this.trimText(this.readString(row.original), 120),
          suggestion: this.trimText(this.readString(row.suggestion), 120),
        };
      })
      .filter((item) => item.message || item.original || item.suggestion);

    return {
      summary,
      nextSteps,
      rewrite,
      sampleEssay,
      errors,
    };
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private trimText(value: string, limit: number): string {
    if (!value) {
      return '';
    }
    const text = value.trim();
    if (text.length <= limit) {
      return text;
    }
    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
  }

  private async renderPrintPacketPdf(
    entries: PrintPacketEntry[],
    options: { homeworkTitle: string; homeworkId: string; lang?: string },
  ): Promise<Buffer> {
    const isZh = this.isZhLang(options.lang);
    const font = this.resolvePdfFont(options.lang);

    return new Promise<Buffer>((resolvePromise, rejectPromise) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
      doc.on('error', (error) => rejectPromise(error));

      doc.font(font);
      entries.forEach((entry, index) => {
        if (index > 0) {
          doc.addPage();
          doc.font(font);
        }
        this.renderStudentPrintPage(doc, entry, {
          isZh,
          font,
          homeworkId: options.homeworkId,
          homeworkTitle: options.homeworkTitle,
        });
      });

      doc.end();
    });
  }

  private renderStudentPrintPage(
    doc: PDFDocumentInstance,
    entry: PrintPacketEntry,
    options: { isZh: boolean; font: string; homeworkId: string; homeworkTitle: string },
  ) {
    const { isZh, font } = options;
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;
    let pagesUsed = 1;
    let truncated = false;

    const ensureSpace = (height: number): boolean => {
      if (doc.y + height <= pageBottom()) {
        return true;
      }
      if (pagesUsed >= PRINT_PACKET_MAX_PAGES_PER_STUDENT) {
        return false;
      }
      doc.addPage();
      doc.font(font);
      pagesUsed += 1;
      return true;
    };

    const writeText = (
      text: string,
      config: { size?: number; bold?: boolean; color?: string; indent?: number; gap?: number } = {},
    ): boolean => {
      const content = text.trim();
      if (!content) {
        return true;
      }
      const indent = config.indent ?? 0;
      const size = config.size ?? 11;
      const lineGap = 2;
      const blockWidth = width - indent;

      doc.font(font);
      doc.fontSize(size);
      doc.fillColor(config.color || '#111827');
      const estimated = doc.heightOfString(content, { width: blockWidth, lineGap });
      if (!ensureSpace(estimated + (config.gap ?? PRINT_PACKET_LINE_GAP))) {
        return false;
      }
      doc.text(content, left + indent, doc.y, { width: blockWidth, lineGap });
      doc.moveDown((config.gap ?? PRINT_PACKET_LINE_GAP) / 12);
      return true;
    };

    const writeSectionTitle = (title: string) =>
      writeText(title, { size: 12, bold: true, color: '#0f172a', gap: 4 });

    const writeBullets = (items: string[]) => {
      for (const item of items) {
        if (!writeText(`- ${item}`, { indent: 12, size: 10 })) {
          return false;
        }
      }
      return true;
    };

    const updatedAtText = this.formatPrintDate(entry.updatedAt);
    if (!writeText(isZh ? '作业批改单' : 'Homework Feedback Sheet', { size: 18, bold: true, color: '#0f172a' })) {
      truncated = true;
    }
    if (
      !writeText(
        isZh
          ? `作业：${options.homeworkTitle}（${options.homeworkId}）`
          : `Homework: ${options.homeworkTitle} (${options.homeworkId})`,
        { size: 11, color: '#374151', gap: 2 },
      )
    ) {
      truncated = true;
    }
    if (
      !writeText(
        isZh
          ? `学生：${entry.studentName}（${entry.studentAccount}）    提交ID：${entry.submissionId}`
          : `Student: ${entry.studentName} (${entry.studentAccount})    Submission: ${entry.submissionId}`,
        { size: 11, color: '#374151', gap: 2 },
      )
    ) {
      truncated = true;
    }
    if (
      !writeText(
        isZh
          ? `分数：${entry.totalScore ?? '--'}    更新时间：${updatedAtText}`
          : `Score: ${entry.totalScore ?? '--'}    Updated: ${updatedAtText}`,
        { size: 11, color: '#374151' },
      )
    ) {
      truncated = true;
    }

    if (!truncated && writeSectionTitle(isZh ? '批改总结' : 'Summary')) {
      if (!writeText(entry.summary || (isZh ? '暂无总结。' : 'No summary.'), { size: 10 })) {
        truncated = true;
      }
    }

    if (!truncated && entry.errors.length && writeSectionTitle(isZh ? '关键错误定位' : 'Key Errors')) {
      for (const [index, item] of entry.errors.entries()) {
        const line = isZh
          ? `${index + 1}. ${item.type ? `${item.type}：` : ''}${item.message || ''}`
          : `${index + 1}. ${item.type ? `${item.type}: ` : ''}${item.message || ''}`;
        const detail = isZh
          ? `原文：${item.original || '--'} -> 建议：${item.suggestion || '--'}`
          : `Original: ${item.original || '--'} -> Suggestion: ${item.suggestion || '--'}`;
        if (!writeText(line, { size: 10, indent: 8, gap: 2 })) {
          truncated = true;
          break;
        }
        if (!writeText(detail, { size: 10, indent: 18 })) {
          truncated = true;
          break;
        }
      }
    }

    if (!truncated && writeSectionTitle(isZh ? '下一步建议' : 'Next Steps')) {
      const steps = entry.nextSteps.length ? entry.nextSteps : [isZh ? '暂无下一步建议。' : 'No next-step suggestions.'];
      if (!writeBullets(steps)) {
        truncated = true;
      }
    }

    if (!truncated && entry.rewrite && writeSectionTitle(isZh ? '改写建议' : 'Rewrite Suggestion')) {
      if (!writeText(entry.rewrite, { size: 10 })) {
        truncated = true;
      }
    }

    if (!truncated && entry.sampleEssay && writeSectionTitle(isZh ? '范文参考' : 'Sample Essay')) {
      if (!writeText(entry.sampleEssay, { size: 10 })) {
        truncated = true;
      }
    }

    if (truncated) {
      writeText(
        isZh
          ? '注：内容过长，已按“每位学生最多 2 页”规则截断。完整内容请在系统中查看。'
          : 'Note: Content is truncated to keep max 2 pages per student. See full details in the system.',
        { size: 9, color: '#6b7280' },
      );
    }
  }

  private formatPrintDate(date: Date): string {
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  }

  private resolvePdfFont(lang?: string): string {
    if (!this.isZhLang(lang)) {
      return 'Helvetica';
    }
    const envFont = process.env.REPORT_PDF_FONT || process.env.PDF_FONT_PATH || '';
    const resolvedEnv = envFont
      ? isAbsolute(envFont)
        ? envFont
        : resolve(process.cwd(), envFont)
      : '';
    const candidates = [
      resolvedEnv,
      'C:\\Windows\\Fonts\\msyh.ttc',
      'C:\\Windows\\Fonts\\msyh.ttf',
      'C:\\Windows\\Fonts\\simhei.ttf',
      'C:\\Windows\\Fonts\\simsun.ttc',
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
      '/System/Library/Fonts/STHeiti Medium.ttc',
      '/Library/Fonts/Arial Unicode.ttf',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
      '/usr/share/fonts/truetype/arphic/uming.ttc',
      '/usr/share/fonts/truetype/arphic/ukai.ttc',
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        return candidate;
      }
    }
    return 'Helvetica';
  }

  private extractGrading(value: Prisma.JsonValue | null): {
    summary: string;
    nextSteps: string[];
    rewrite: string;
    sampleEssay: string;
    errorCount: number;
  } {
    const obj = this.asObject(value);
    const summary = typeof obj?.summary === 'string' ? obj.summary : '';
    const nextSteps = Array.isArray(obj?.nextSteps)
      ? (obj?.nextSteps as unknown[]).filter((item) => typeof item === 'string')
      : [];
    const suggestions = this.asObject(obj?.suggestions as Prisma.JsonValue | null);
    const rewrite = typeof suggestions?.rewrite === 'string' ? suggestions.rewrite : '';
    const sampleEssay = typeof suggestions?.sampleEssay === 'string' ? suggestions.sampleEssay : '';
    const errors = Array.isArray(obj?.errors) ? (obj?.errors as unknown[]) : [];
    return { summary, nextSteps, rewrite, sampleEssay, errorCount: errors.length };
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private isZhLang(lang?: string) {
    return (lang || '').toLowerCase().startsWith('zh');
  }

  private getStudentExportHeaders(lang?: string): string[] {
    if (this.isZhLang(lang)) {
      return ['提交ID', '作业ID', '作业标题', '状态', '总分', '错误码', '错误信息', '更新时间'];
    }
    return [
      'submissionId',
      'homeworkId',
      'homeworkTitle',
      'status',
      'totalScore',
      'errorCode',
      'errorMsg',
      'updatedAt',
    ];
  }

  private getHomeworkExportHeaders(lang?: string): string[] {
    if (this.isZhLang(lang)) {
      return [
        '提交ID',
        '班级ID',
        '班级名称',
        '作业ID',
        '作业标题',
        '学生ID',
        '学生姓名',
        '学生账号',
        '状态',
        '总分',
        '错误码',
        '错误信息',
        '错误数',
        '总结',
        '下一步建议',
        '改写建议',
        '范文参考',
        '更新时间',
      ];
    }
    return [
      'submissionId',
      'classId',
      'className',
      'homeworkId',
      'homeworkTitle',
      'studentId',
      'studentName',
      'studentAccount',
      'status',
      'totalScore',
      'errorCode',
      'errorMsg',
      'errorCount',
      'summary',
      'nextSteps',
      'rewrite',
      'sampleEssay',
      'updatedAt',
    ];
  }

  private getReminderExportHeaders(lang?: string): string[] {
    if (this.isZhLang(lang)) {
      return ['班级ID', '班级名称', '作业ID', '作业标题', '学生ID', '学生姓名', '学生账号'];
    }
    return [
      'classId',
      'className',
      'homeworkId',
      'homeworkTitle',
      'studentId',
      'studentName',
      'studentAccount',
    ];
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
}
