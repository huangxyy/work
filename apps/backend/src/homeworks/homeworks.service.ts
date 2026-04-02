import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { lateSubmissionConfigKey } from './homework.constants';

type HomeworkWithId = { id: string };

@Injectable()
export class HomeworksService {
  private readonly logger = new Logger(HomeworksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  private async ensureClassAccess(classId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      const klass = await this.prisma.class.findUnique({ where: { id: classId } });
      if (!klass) {
        throw new NotFoundException('班级不存在');
      }
      return klass;
    }

    if (user.role === Role.TEACHER) {
      const klass = await this.prisma.class.findFirst({
        where: { id: classId, teachers: { some: { id: user.id } } },
      });
      if (!klass) {
        throw new ForbiddenException('无权访问该班级');
      }
      return klass;
    }

    throw new ForbiddenException('仅教师或管理员可以访问作业');
  }

  private async ensureHomeworkAccess(homeworkId: string, user: AuthUser) {
    if (user.role === Role.ADMIN) {
      const homework = await this.prisma.homework.findUnique({
        where: { id: homeworkId },
        select: { id: true, classId: true },
      });
      if (!homework) {
        throw new NotFoundException('作业不存在');
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
        throw new ForbiddenException('无权访问该作业');
      }
      return homework;
    }

    throw new ForbiddenException('仅教师或管理员可以访问作业');
  }

  private async getLateSubmissionMap(homeworkIds: string[]): Promise<Map<string, boolean>> {
    const uniqueIds = Array.from(new Set(homeworkIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map();
    }

    const configEntries = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: uniqueIds.map((homeworkId) => lateSubmissionConfigKey(homeworkId)),
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const configuredValues = new Map(
      configEntries.map((entry) => [entry.key, typeof entry.value === 'boolean' ? entry.value : false]),
    );

    return new Map(
      uniqueIds.map((homeworkId) => [
        homeworkId,
        configuredValues.get(lateSubmissionConfigKey(homeworkId)) === true,
      ]),
    );
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

  async updateHomework(
    id: string,
    data: UpdateHomeworkDto,
    user: AuthUser,
  ) {
    await this.ensureHomeworkAccess(id, user);

    const updateData: Partial<{ title: string; desc: string | null; dueAt: Date | null }> = {};
    if (data.title?.trim()) updateData.title = data.title.trim();
    if (data.desc !== undefined) updateData.desc = data.desc || null;
    if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;

    return this.prisma.homework.update({ where: { id }, data: updateData });
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

  async getHomeworkById(homeworkId: string, user: AuthUser) {
    const startedAt = Date.now();
    await this.ensureHomeworkAccess(homeworkId, user);
    
    const homeworkDetail = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!homeworkDetail) {
      throw new NotFoundException('作业不存在');
    }

    const [totalStudents, statusGroups, studentGroups, lateSubmissionMap] = await Promise.all([
      this.prisma.enrollment.count({ where: { classId: homeworkDetail.classId } }),
      this.prisma.submission.groupBy({
        by: ['homeworkId', 'status'],
        where: { homeworkId },
        _count: { _all: true },
      }),
      this.prisma.submission.groupBy({
        by: ['homeworkId', 'studentId'],
        where: { homeworkId },
        _count: { _all: true },
      }),
      this.getLateSubmissionMap([homeworkId]),
    ]);

    const counts = { total: 0, queued: 0, processing: 0, done: 0, failed: 0 };
    for (const group of statusGroups) {
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
    }

    const submittedStudents = studentGroups.length;
    const pendingStudents = Math.max(0, totalStudents - submittedStudents);

    const result = {
      ...homeworkDetail,
      allowLateSubmission: lateSubmissionMap.get(homeworkId) === true,
      studentCount: totalStudents,
      submissionCount: submittedStudents,
      pendingStudents,
      submissionsTotal: counts.total,
      queuedCount: counts.queued,
      processingCount: counts.processing,
      doneCount: counts.done,
      failedCount: counts.failed,
    };

    this.logger.debug(
      `Homework fetched by id homeworkId=${homeworkId} userId=${user.id} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async listByClass(classId: string, user: AuthUser) {
    const startedAt = Date.now();
    await this.ensureClassAccess(classId, user);
    const homeworks = await this.prisma.homework.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const items = await this.withLateSubmissionFlag(homeworks);
    this.logger.debug(
      `Homeworks listed by class classId=${classId} userId=${user.id} returned=${items.length} durationMs=${Date.now() - startedAt}`,
    );
    return items;
  }

  async listByClassSummary(classId: string, user: AuthUser) {
    const startedAt = Date.now();
    await this.ensureClassAccess(classId, user);

    const homeworks = await this.prisma.homework.findMany({
      where: { classId },
      select: {
        id: true,
        title: true,
        desc: true,
        dueAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    if (!homeworks.length) {
      this.logger.debug(
        `Homework class summary listed classId=${classId} userId=${user.id} returned=0 durationMs=${Date.now() - startedAt}`,
      );
      return [];
    }

    const homeworkIds = homeworks.map((homework) => homework.id);

    const [totalStudents, statusGroups, studentGroups, lateSubmissionMap] = await Promise.all([
      this.prisma.enrollment.count({ where: { classId } }),
      this.prisma.submission.groupBy({
        by: ['homeworkId', 'status'],
        where: { homeworkId: { in: homeworkIds } },
        _count: { _all: true },
      }),
      this.prisma.submission.groupBy({
        by: ['homeworkId', 'studentId'],
        where: { homeworkId: { in: homeworkIds } },
        _count: { _all: true },
      }),
      this.getLateSubmissionMap(homeworkIds),
    ]);

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
        studentCount: totalStudents,
        submissionCount: submittedStudents,
        pendingStudents,
        submissionsTotal: counts.total,
        queuedCount: counts.queued,
        processingCount: counts.processing,
        doneCount: counts.done,
        failedCount: counts.failed,
      };
    });

    const items = summary.map((item) => ({
      ...item,
      allowLateSubmission: lateSubmissionMap.get(item.id) === true,
    }));

    this.logger.debug(
      `Homework class summary listed classId=${classId} userId=${user.id} returned=${items.length} totalStudents=${totalStudents} statusGroups=${statusGroups.length} studentGroups=${studentGroups.length} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async listForStudent(user: AuthUser) {
    const startedAt = Date.now();
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
      take: 500,
    });

    const items = await this.withLateSubmissionFlag(homeworks);
    this.logger.debug(
      `Homeworks listed for student userId=${user.id} returned=${items.length} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async getDeletePreview(homeworkId: string, user: AuthUser) {
    const startedAt = Date.now();
    const homework = await this.ensureHomeworkAccess(homeworkId, user);
    const [submissionCount, imageCount] = await this.prisma.$transaction([
      this.prisma.submission.count({ where: { homeworkId: homework.id } }),
      this.prisma.submissionImage.count({ where: { submission: { homeworkId: homework.id } } }),
    ]);

    this.logger.debug(
      `Homework delete preview fetched homeworkId=${homework.id} userId=${user.id} submissionCount=${submissionCount} imageCount=${imageCount} durationMs=${Date.now() - startedAt}`,
    );

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

  async deleteHomework(homeworkId: string, user: AuthUser, force = false) {
    const homework = await this.ensureHomeworkAccess(homeworkId, user);

    // Check for in-flight submissions that would be silently dropped
    const activeCount = await this.prisma.submission.count({
      where: {
        homeworkId: homework.id,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });

    if (activeCount > 0 && !force) {
      throw new BadRequestException(
        `Cannot delete homework: ${activeCount} submission(s) are still queued or being graded. ` +
        `Wait for grading to finish, or use force=true to delete anyway.`,
      );
    }

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
      droppedActiveSubmissions: activeCount,
    };
  }
}
