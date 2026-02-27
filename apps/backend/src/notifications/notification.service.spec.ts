import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;
    service = new NotificationService(prisma);
  });

  describe('create', () => {
    it('should create a notification with required fields', async () => {
      const data = { userId: 'u1', type: 'GRADING_DONE', title: 'Graded' };
      prisma.notification.create = jest.fn().mockResolvedValue({ id: 'n1', ...data });
      const result = await service.create(data);
      expect(result.id).toBe('n1');
      expect(prisma.notification.create).toHaveBeenCalledWith({ data });
    });

    it('should create a notification with optional fields', async () => {
      const data = {
        userId: 'u1',
        type: 'GRADING_DONE',
        title: 'Graded',
        body: 'Your homework has been graded',
        linkTo: '/submissions/s1',
      };
      prisma.notification.create = jest.fn().mockResolvedValue({ id: 'n2', ...data });
      const result = await service.create(data);
      expect(result.id).toBe('n2');
      expect(prisma.notification.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('listForUser', () => {
    it('should list notifications with default limit', async () => {
      prisma.notification.findMany = jest.fn().mockResolvedValue([]);
      await service.listForUser('u1');
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    });

    it('should cap limit at 100', async () => {
      prisma.notification.findMany = jest.fn().mockResolvedValue([]);
      await service.listForUser('u1', 500);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter unread only when specified', async () => {
      prisma.notification.findMany = jest.fn().mockResolvedValue([]);
      await service.listForUser('u1', 30, true);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', isRead: false },
        }),
      );
    });
  });

  describe('countUnread', () => {
    it('should count unread notifications for user', async () => {
      prisma.notification.count = jest.fn().mockResolvedValue(5);
      const result = await service.countUnread('u1');
      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read for the user', async () => {
      prisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      await service.markAsRead('n1', 'u1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
        data: { isRead: true },
      });
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 3 });
      await service.markAllRead('u1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isRead: false },
        data: { isRead: true },
      });
    });
  });
});
