import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SubmissionStatus } from '@prisma/client';
import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import type { Express } from 'express';
import { basename, extname } from 'path';
import { Readable } from 'stream';
import * as unzipper from 'unzipper';
import { AuthUser } from '../auth/auth.types';
import { GradingPolicyService } from '../grading-policy/grading-policy.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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
};

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_BATCH_IMAGES = 100;
const DEFAULT_ZIP_MAX_BYTES = 104857600;
const DEFAULT_ZIP_UNCOMPRESSED_BYTES = 314572800;
const DEFAULT_ZIP_ENTRY_BYTES = 15728640;
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

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queueService: QueueService,
    private readonly gradingPolicyService: GradingPolicyService,
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

    const submission = await this.prisma.submission.create({
      data: {
        homeworkId: dto.homeworkId,
        studentId: user.id,
        status: SubmissionStatus.QUEUED,
      },
    });

    const images = [];

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

    const accountMap = new Map(
      enrollments.map((enrollment) => [enrollment.student.account, enrollment.student]),
    );
    const accountList = Array.from(accountMap.keys()).sort((a, b) => b.length - a.length);

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
          skipped.push({ file: file.originalname, reason: 'NON_IMAGE', fileKey });
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
      let matchedImages = 0;
      for (const image of images) {
        const resolved = this.resolveAccountWithOverrides(
          image,
          accountMap,
          accountList,
          mappingOverrides,
        );
        if (!resolved) {
          unmatched.push({ file: image.filename, reason: 'ACCOUNT_NOT_FOUND', fileKey: image.fileKey });
          continue;
        }
        const bucket = grouped.get(resolved);
        if (bucket) {
          bucket.push(image);
        } else {
          grouped.set(resolved, [image]);
        }
        matchedImages += 1;
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

        const imageRecords = [];

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

  private resolveAccount(
    filename: string,
    accountMap: Map<string, { id: string; account: string; name: string }>,
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
    accountMap: Map<string, { id: string; account: string; name: string }>,
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
        options.skipped.push({ file: entryName, reason: 'NON_IMAGE', fileKey });
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
        const entrySize =
          declaredSize !== null
            ? declaredSize
            : await this.drainEntry(entry, MAX_ZIP_ENTRY_BYTES);
        options.totalUncompressed.value += entrySize;
        if (options.totalUncompressed.value > MAX_ZIP_UNCOMPRESSED_BYTES) {
          throw new BadRequestException('Zip exceeds uncompressed size limit');
        }
        if (declaredSize !== null) {
          entry.autodrain();
        }
        options.images.push({
          fileKey,
          filename: entryName,
          mimeType: this.mapImageMimeType(extension),
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
