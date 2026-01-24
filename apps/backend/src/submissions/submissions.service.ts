import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, SubmissionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Express } from 'express';
import { AuthUser } from '../auth/auth.types';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

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
        include: { images: true },
      });
    }

    if (user.role === Role.STUDENT) {
      return this.prisma.submission.findFirst({
        where: { id, studentId: user.id },
        include: { images: true },
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
        include: { images: true },
      });
    }

    throw new ForbiddenException('No access');
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
}
