import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';

@Injectable()
export class HomeworksService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createHomework(dto: CreateHomeworkDto, user: AuthUser) {
    await this.ensureClassAccess(dto.classId, user);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;

    return this.prisma.homework.create({
      data: {
        classId: dto.classId,
        title: dto.title,
        desc: dto.desc,
        dueAt,
      },
    });
  }

  async listByClass(classId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);
    return this.prisma.homework.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
    });
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

    return homeworks.map((homework) => {
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
  }

  async listForStudent(user: AuthUser) {
    return this.prisma.homework.findMany({
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
  }
}
