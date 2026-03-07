import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { AuthUser } from '../auth/auth.types';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async create(data: CreateAnnouncementDto, author: AuthUser) {
    if (data.classId) {
      const isTeacher = await this.prisma.class.findFirst({
        where: { id: data.classId, teachers: { some: { id: author.id } } },
      });
      if (!isTeacher && author.role !== Role.ADMIN) throw new ForbiddenException('Not authorized for this class');
    }

    const announcement = await this.prisma.announcement.create({
      data: { title: data.title, content: data.content, classId: data.classId, authorId: author.id, pinned: data.pinned || false },
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
    });

    if (data.classId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { classId: data.classId },
        select: { studentId: true },
      });
      const notifs = enrollments.map(e => ({
        userId: e.studentId,
        type: 'ANNOUNCEMENT',
        title: data.title,
        body: data.content.slice(0, 200),
        linkTo: `/student/announcements`,
      }));
      await this.dispatchNotifications(notifs);
    }

    return announcement;
  }

  async listByClass(classId: string, limit = 20) {
    return this.prisma.announcement.findMany({
      where: { classId },
      include: {
        author: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async listForStudent(studentId: string, limit = 20) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      select: { classId: true },
    });
    const classIds = enrollments.map(e => e.classId);

    return this.prisma.announcement.findMany({
      where: { OR: [{ classId: { in: classIds } }, { classId: null }] },
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async listForTeacher(teacherId: string, classId?: string, limit = 20) {
    const classes = await this.prisma.class.findMany({
      where: { teachers: { some: { id: teacherId } } },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    if (classId && !classIds.includes(classId)) {
      throw new ForbiddenException('Not authorized for this class');
    }

    const where = classId
      ? { OR: [{ classId }, { classId: null }] }
      : { OR: [{ classId: { in: classIds } }, { classId: null }] };

    return this.prisma.announcement.findMany({
      where,
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async listForAdmin(classId?: string, limit = 20) {
    return this.prisma.announcement.findMany({
      where: classId ? { classId } : {},
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async delete(id: string, user: AuthUser) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    if (announcement.authorId !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }

  private async dispatchNotifications(
    notifications: Array<{
      userId: string;
      type: string;
      title: string;
      body?: string;
      linkTo?: string;
    }>,
  ) {
    if (!notifications.length) {
      return;
    }

    const batchSize = 50;
    let failedCount = 0;

    for (let index = 0; index < notifications.length; index += batchSize) {
      const batch = notifications.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map((notification) => this.notifications.create(notification)),
      );
      failedCount += results.reduce(
        (count, result) => (result.status === 'rejected' ? count + 1 : count),
        0,
      );
    }

    if (failedCount > 0) {
      this.logger.warn(`Failed to create ${failedCount}/${notifications.length} announcement notifications`);
    }
  }
}
