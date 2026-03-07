import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    linkTo?: string;
  }) {
    const startedAt = Date.now();
    const notification = await this.prisma.notification.create({ data });

    this.logger.debug(
      `Notification created userId=${data.userId} type=${data.type} id=${notification.id} durationMs=${Date.now() - startedAt}`,
    );

    return notification;
  }

  async listForUser(userId: string, limit = 30, unreadOnly = false) {
    const startedAt = Date.now();
    const take = Math.min(limit, 100);
    const notifications = await this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    });

    this.logger.debug(
      `Notifications listed userId=${userId} returned=${notifications.length} limit=${take} unreadOnly=${unreadOnly} durationMs=${Date.now() - startedAt}`,
    );

    return notifications;
  }

  async countUnread(userId: string) {
    const startedAt = Date.now();
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.logger.debug(
      `Notification unread count fetched userId=${userId} count=${count} durationMs=${Date.now() - startedAt}`,
    );

    return count;
  }

  async markAsRead(id: string, userId: string) {
    const startedAt = Date.now();
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    this.logger.debug(
      `Notification marked as read userId=${userId} id=${id} updated=${result.count} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }

  async markAllRead(userId: string) {
    const startedAt = Date.now();
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    this.logger.debug(
      `Notifications marked all read userId=${userId} updated=${result.count} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }
}
