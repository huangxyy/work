import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AnnouncementService } from './announcement.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let prisma: any;
  let notifications: any;

  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 't1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'a1', name: 'Admin' };

  const mockAnnouncement = {
    id: 'ann-1',
    title: 'Test',
    content: 'Content',
    classId: 'class-1',
    authorId: 'teacher-1',
    pinned: false,
    author: { id: 'teacher-1', name: 'Teacher' },
    class: { id: 'class-1', name: 'Class A' },
  };

  beforeEach(async () => {
    prisma = {
      class: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      announcement: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      enrollment: { findMany: jest.fn().mockResolvedValue([]) },
    };

    notifications = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AnnouncementService>(AnnouncementService);
  });

  // ─── create ───

  describe('create', () => {
    it('should create a global announcement (no classId)', async () => {
      prisma.announcement.create.mockResolvedValue({ ...mockAnnouncement, classId: null });

      const result = await service.create({ title: 'Global', content: 'Hi all' }, mockAdmin);

      expect(result.classId).toBeNull();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('should create class announcement and dispatch notifications', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.announcement.create.mockResolvedValue(mockAnnouncement);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 's1' },
        { studentId: 's2' },
      ]);

      await service.create(
        { title: 'Test', content: 'Content', classId: 'class-1' },
        mockTeacher,
      );

      expect(notifications.create).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when teacher has no access to class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ title: 'X', content: 'Y', classId: 'class-1' }, mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to create for any class', async () => {
      prisma.class.findFirst.mockResolvedValue(null);
      prisma.announcement.create.mockResolvedValue(mockAnnouncement);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await expect(
        service.create({ title: 'X', content: 'Y', classId: 'class-1' }, mockAdmin),
      ).resolves.toBeDefined();
    });

    it('should handle notification failures gracefully', async () => {
      prisma.class.findFirst.mockResolvedValue({ id: 'class-1' });
      prisma.announcement.create.mockResolvedValue(mockAnnouncement);
      prisma.enrollment.findMany.mockResolvedValue([{ studentId: 's1' }]);
      notifications.create.mockRejectedValue(new Error('fail'));

      await expect(
        service.create({ title: 'X', content: 'Y', classId: 'class-1' }, mockTeacher),
      ).resolves.toBeDefined();
    });
  });

  // ─── listByClass ───

  describe('listByClass', () => {
    it('should list announcements for a class', async () => {
      prisma.announcement.findMany.mockResolvedValue([mockAnnouncement]);

      const result = await service.listByClass('class-1');

      expect(result).toHaveLength(1);
      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classId: 'class-1' } }),
      );
    });

    it('should respect custom limit', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listByClass('class-1', 5);

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── listForStudent ───

  describe('listForStudent', () => {
    it('should list announcements for enrolled classes and global', async () => {
      prisma.enrollment.findMany.mockResolvedValue([
        { classId: 'c1' },
        { classId: 'c2' },
      ]);
      prisma.announcement.findMany.mockResolvedValue([mockAnnouncement]);

      const result = await service.listForStudent('student-1');

      expect(result).toHaveLength(1);
      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ classId: { in: ['c1', 'c2'] } }, { classId: null }] },
        }),
      );
    });
  });

  // ─── listForTeacher ───

  describe('listForTeacher', () => {
    it('should list announcements for teacher classes', async () => {
      prisma.class.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listForTeacher('teacher-1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ classId: { in: ['c1'] } }, { classId: null }] },
        }),
      );
    });

    it('should filter by specific classId when provided', async () => {
      prisma.class.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listForTeacher('teacher-1', 'c1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ classId: 'c1' }, { classId: null }] },
        }),
      );
    });

    it('should throw ForbiddenException when classId not in teacher classes', async () => {
      prisma.class.findMany.mockResolvedValue([{ id: 'c1' }]);

      await expect(
        service.listForTeacher('teacher-1', 'c-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── listForAdmin ───

  describe('listForAdmin', () => {
    it('should list all announcements for admin', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listForAdmin();

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by classId for admin', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listForAdmin('c1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classId: 'c1' } }),
      );
    });
  });

  // ─── delete ───

  describe('delete', () => {
    it('should delete announcement by author', async () => {
      prisma.announcement.findUnique.mockResolvedValue(mockAnnouncement);
      prisma.announcement.delete.mockResolvedValue(undefined);

      const result = await service.delete('ann-1', mockTeacher);

      expect(result).toEqual({ ok: true });
    });

    it('should allow admin to delete any announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(mockAnnouncement);
      prisma.announcement.delete.mockResolvedValue(undefined);

      const result = await service.delete('ann-1', mockAdmin);

      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException when announcement missing', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing', mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-author non-admin deletes', async () => {
      prisma.announcement.findUnique.mockResolvedValue(mockAnnouncement);
      const otherTeacher = { ...mockTeacher, id: 'teacher-other' };

      await expect(service.delete('ann-1', otherTeacher)).rejects.toThrow(ForbiddenException);
    });
  });
});
