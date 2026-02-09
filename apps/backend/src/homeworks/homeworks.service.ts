import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { lateSubmissionConfigKey } from './homework.constants';

type HomeworkWithId = { id: string };

@Injectable()
export class HomeworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

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

    throw new ForbiddenException('Only teacher or admin can access homework');
  }

  private async ensureHomeworkAccess(homeworkId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      const homework = await this.prisma.homework.findUnique({
        where: { id: homeworkId },
        select: { id: true, classId: true },
      });
      if (!homework) {
        throw new NotFoundException('Homework not found');
      }
      return homework;
    }

    if (user.role === Role.TEACHER) {
      const homework = await this.prisma.homework.findFirst({
        where: {
          id: homeworkId,
          class: { teachers: { some: { id: user.id } } },
        },
        select: { id: true, classId: true },
      });
      if (!homework) {
        throw new ForbiddenException('No access to this homework');
      }
      return homework;
    }

    throw new ForbiddenException('Only teacher or admin can access homework');
  }

  private async isLateSubmissionAllowed(homeworkId: string): Promise<boolean> {
    const value = await this.systemConfigService.getValue<boolean>(lateSubmissionConfigKey(homeworkId));
    return value === true;
  }

  private async getLateSubmissionMap(homeworkIds: string[]): Promise<Map<string, boolean>> {
    const uniqueIds = Array.from(new Set(homeworkIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map();
    }

    const entries = await Promise.all(
      uniqueIds.map(async (homeworkId) => [homeworkId, await this.isLateSubmissionAllowed(homeworkId)] as const),
    );
    return new Map(entries);
  }

  private async withLateSubmissionFlag<T extends HomeworkWithId>(
    homeworks: T[],
  ): Promise<Array<T & { allowLateSubmission: boolean }>> {
    const lateSubmissionMap = await this.getLateSubmissionMap(homeworks.map((item) => item.id));
    return homeworks.map((homework) => ({
      ...homework,
      allowLateSubmission: lateSubmissionMap.get(homework.id) === true,
    }));
  }

  async createHomework(dto: CreateHomeworkDto, user: AuthUser) {
    await this.ensureClassAccess(dto.classId, user);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;

    const homework = await this.prisma.homework.create({
      data: {
        classId: dto.classId,
        title: dto.title,
        desc: dto.desc,
        dueAt,
      },
    });

    return {
      ...homework,
      allowLateSubmission: false,
    };
  }

  async listByClass(classId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);
    const homeworks = await this.prisma.homework.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
    });
    return this.withLateSubmissionFlag(homeworks);
  }

  async listByClassSummary(classId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);

    const homeworks = await this.prisma.homework.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
    });

    if (!homeworks.length) {
      return [];
    }

    const totalStudents = await this.prisma.enrollment.count({ where: { classId } });
    const homeworkIds = homeworks.map((homework) => homework.id);

    const statusGroups = await this.prisma.submission.groupBy({
      by: ['homeworkId', 'status'],
      where: { homeworkId: { in: homeworkIds } },
      _count: { _all: true },
    });

    const studentGroups = await this.prisma.submission.groupBy({
      by: ['homeworkId', 'studentId'],
      where: { homeworkId: { in: homeworkIds } },
    });

    const statusMap = new Map<
      string,
      { total: number; queued: number; processing: number; done: number; failed: number }
    >();

    for (const group of statusGroups) {
      const counts = statusMap.get(group.homeworkId) || {
        total: 0,
        queued: 0,
        processing: 0,
        done: 0,
        failed: 0,
      };
      const count = group._count._all;
      counts.total += count;
      if (group.status === 'QUEUED') {
        counts.queued += count;
      } else if (group.status === 'PROCESSING') {
        counts.processing += count;
      } else if (group.status === 'DONE') {
        counts.done += count;
      } else if (group.status === 'FAILED') {
        counts.failed += count;
      }
      statusMap.set(group.homeworkId, counts);
    }

    const submittedMap = new Map<string, number>();
    for (const group of studentGroups) {
      submittedMap.set(group.homeworkId, (submittedMap.get(group.homeworkId) || 0) + 1);
    }

    const summary = homeworks.map((homework) => {
      const counts = statusMap.get(homework.id) || {
        total: 0,
        queued: 0,
        processing: 0,
        done: 0,
        failed: 0,
      };
      const submittedStudents = submittedMap.get(homework.id) || 0;
      const pendingStudents = Math.max(0, totalStudents - submittedStudents);
      return {
        id: homework.id,
        title: homework.title,
        desc: homework.desc,
        dueAt: homework.dueAt,
        createdAt: homework.createdAt,
        totalStudents,
        submittedStudents,
        pendingStudents,
        submissionsTotal: counts.total,
        queuedCount: counts.queued,
        processingCount: counts.processing,
        doneCount: counts.done,
        failedCount: counts.failed,
      };
    });

    const lateSubmissionMap = await this.getLateSubmissionMap(summary.map((item) => item.id));
    return summary.map((item) => ({
      ...item,
      allowLateSubmission: lateSubmissionMap.get(item.id) === true,
    }));
  }

  async listForStudent(user: AuthUser) {
    const homeworks = await this.prisma.homework.findMany({
      where: {
        class: {
          enrolls: { some: { studentId: user.id } },
        },
      },
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.withLateSubmissionFlag(homeworks);
  }

  async getDeletePreview(homeworkId: string, user: AuthUser) {
    const homework = await this.ensureHomeworkAccess(homeworkId, user);
    const [submissionCount, imageCount] = await this.prisma.$transaction([
      this.prisma.submission.count({ where: { homeworkId: homework.id } }),
      this.prisma.submissionImage.count({ where: { submission: { homeworkId: homework.id } } }),
    ]);

    return {
      homeworkId: homework.id,
      submissionCount,
      imageCount,
    };
  }

  async updateLateSubmission(homeworkId: string, allowLateSubmission: boolean, user: AuthUser) {
    const homework = await this.ensureHomeworkAccess(homeworkId, user);
    await this.systemConfigService.setValue(lateSubmissionConfigKey(homework.id), allowLateSubmission);
    return { homeworkId: homework.id, allowLateSubmission };
  }

  async deleteHomework(homeworkId: string, user: AuthUser) {
    const homework = await this.ensureHomeworkAccess(homeworkId, user);

    const images = await this.prisma.submissionImage.findMany({
      where: { submission: { homeworkId: homework.id } },
      select: { objectKey: true },
    });
    const objectKeys = Array.from(
      new Set(images.map((item) => item.objectKey).filter((key): key is string => Boolean(key))),
    );

    const deletedObjects = await this.storage.deleteObjects(objectKeys);

    await this.prisma.homework.delete({ where: { id: homework.id } });
    await this.systemConfigService.deleteValue(lateSubmissionConfigKey(homework.id));

    return {
      homeworkId: homework.id,
      deleted: true,
      removedObjects: deletedObjects.ok,
      failedObjectDeletes: deletedObjects.failed.length,
    };
  }
}
