import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, SubmissionStatus } from '@prisma/client';
import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import type { Express } from 'express';
import { basename, extname } from 'path';
import { AuthUser } from '../auth/auth.types';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateBatchSubmissionsDto } from './dto/create-batch-submissions.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RegradeHomeworkSubmissionsDto } from './dto/regrade-homework-submissions.dto';

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

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queueService: QueueService,
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

    await this.queueService.enqueueGrading(submission.id);

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

    const submissions = await this.prisma.submission.findMany({
      where: { studentId: user.id },
      include: { homework: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return submissions.map((submission) => ({
      id: submission.id,
      homeworkTitle: submission.homework.title,
      status: submission.status,
      totalScore: submission.totalScore,
      updatedAt: submission.updatedAt.toISOString(),
    }));
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
      updatedAt: submission.updatedAt.toISOString(),
    }));
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
      select: { id: true },
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

    const ids = submissions.map((item) => item.id);
    await this.prisma.submission.updateMany({
      where: { id: { in: ids } },
      data: { status: SubmissionStatus.QUEUED, errorCode: null, errorMsg: null },
    });

    for (const id of ids) {
      await this.queueService.enqueueRegrade(id, {
        mode: dto.mode,
        needRewrite: dto.needRewrite,
      });
    }

    return { homeworkId: dto.homeworkId, count: ids.length };
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
        const archiveBuffer = file.buffer ? file.buffer : file.path ? await fs.readFile(file.path) : null;
        if (!archiveBuffer) {
          continue;
        }
        const zip = new AdmZip(archiveBuffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (entry.isDirectory) {
            continue;
          }
          const entryName = entry.entryName.replace(/\\/g, '/');
          if (this.isHiddenZipEntry(entryName)) {
            continue;
          }
          const fileKey = `zip:${entryName}`;
          const extension = extname(entryName).toLowerCase();
          if (!ALLOWED_IMAGE_EXTS.has(extension)) {
            skipped.push({ file: entryName, reason: 'NON_IMAGE', fileKey });
            continue;
          }
          images.push({
            fileKey,
            filename: entryName,
            mimeType: this.mapImageMimeType(extension),
            buffer: entry.getData(),
          });
        }
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

      if (unmatched.length) {
        skipped.push(...unmatched);
      }

      if (grouped.size === 0) {
        throw new BadRequestException('No images matched enrolled students');
      }

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
          mode: dto.mode,
          needRewrite: dto.needRewrite,
        });

        submissions.push({
          submissionId: submission.id,
          studentAccount: student.account,
          studentName: student.name,
          imageCount: imageRecords.length,
        });
      }

      return {
        homeworkId: homework.id,
        totalImages: images.length,
        acceptedImages,
        createdSubmissions: submissions.length,
        skipped,
        submissions,
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

    await this.queueService.enqueueRegrade(id, options);
    return { submissionId: id, status: SubmissionStatus.QUEUED };
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
        .map(([key, value]) => [String(key), String(value).trim()])
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

  private async cleanupTempFiles(paths: Set<string>) {
    const tasks = Array.from(paths).map((filePath) => fs.unlink(filePath).catch(() => undefined));
    await Promise.all(tasks);
  }
}
