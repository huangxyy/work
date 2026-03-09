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
    const startedAt = Date.now();
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

    let notifCount = 0;
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
      notifCount = notifs.length;
      await this.dispatchNotifications(notifs);
    }

    this.logger.debug(
      `Announcement created id=${announcement.id} authorId=${author.id} classId=${data.classId || 'global'} notifications=${notifCount} durationMs=${Date.now() - startedAt}`,
    );

    return announcement;
  }

  async listByClass(classId: string, limit = 20) {
    const startedAt = Date.now();
    const items = await this.prisma.announcement.findMany({
      where: { classId },
      include: {
        author: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    this.logger.debug(
      `Announcements listed by class classId=${classId} returned=${items.length} limit=${limit} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async listForStudent(studentId: string, limit = 20) {
    const startedAt = Date.now();
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      select: { classId: true },
    });
    const classIds = enrollments.map(e => e.classId);

    const items = await this.prisma.announcement.findMany({
      where: { OR: [{ classId: { in: classIds } }, { classId: null }] },
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    this.logger.debug(
      `Announcements listed for student studentId=${studentId} classes=${classIds.length} returned=${items.length} limit=${limit} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async listForTeacher(teacherId: string, classId?: string, limit = 20) {
    const startedAt = Date.now();
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

    const items = await this.prisma.announcement.findMany({
      where,
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    this.logger.debug(
      `Announcements listed for teacher teacherId=${teacherId} classId=${classId || 'all'} classes=${classIds.length} returned=${items.length} limit=${limit} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async listForAdmin(classId?: string, limit = 20) {
    const startedAt = Date.now();
    const items = await this.prisma.announcement.findMany({
      where: classId ? { classId } : {},
      include: { author: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    this.logger.debug(
      `Announcements listed for admin classId=${classId || 'all'} returned=${items.length} limit=${limit} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async delete(id: string, user: AuthUser) {
    const startedAt = Date.now();
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    if (announcement.authorId !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Not authorized');
    await this.prisma.announcement.delete({ where: { id } });

    this.logger.debug(
      `Announcement deleted id=${id} actorUserId=${user.id} authorId=${announcement.authorId} durationMs=${Date.now() - startedAt}`,
    );

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
