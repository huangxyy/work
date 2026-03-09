import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HomeworkTemplateService } from './homework-template.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HomeworkTemplateService', () => {
  let service: HomeworkTemplateService;
  let prisma: any;

  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 'teacher1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin1', name: 'Admin' };
  const otherTeacher = { id: 'teacher-2', role: Role.TEACHER, account: 'teacher2', name: 'Other' };

  const mockTemplate = {
    id: 'tpl-1',
    title: 'Essay Template',
    desc: 'Write an essay',
    teacherId: 'teacher-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      homeworkTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworkTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<HomeworkTemplateService>(HomeworkTemplateService);
  });

  // ─── create ───

  describe('create', () => {
    it('should create a template for the teacher', async () => {
      prisma.homeworkTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.create(
        { title: 'Essay Template', desc: 'Write an essay' },
        mockTeacher,
      );

      expect(result).toEqual(mockTemplate);
      expect(prisma.homeworkTemplate.create).toHaveBeenCalledWith({
        data: { title: 'Essay Template', desc: 'Write an essay', teacherId: 'teacher-1' },
      });
    });
  });

  // ─── list ───

  describe('list', () => {
    it('should list templates for a teacher', async () => {
      prisma.homeworkTemplate.findMany.mockResolvedValue([mockTemplate]);

      const result = await service.list('teacher-1');

      expect(result).toHaveLength(1);
      expect(prisma.homeworkTemplate.findMany).toHaveBeenCalledWith({
        where: { teacherId: 'teacher-1' },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
    });

    it('should return empty array when no templates exist', async () => {
      prisma.homeworkTemplate.findMany.mockResolvedValue([]);

      const result = await service.list('teacher-1');

      expect(result).toEqual([]);
    });
  });

  // ─── update ───

  describe('update', () => {
    it('should update template owned by teacher', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.update.mockResolvedValue({ ...mockTemplate, title: 'Updated' });

      const result = await service.update('tpl-1', { title: 'Updated' }, mockTeacher);

      expect(result.title).toBe('Updated');
    });

    it('should allow admin to update any template', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.update.mockResolvedValue({ ...mockTemplate, title: 'Admin Edit' });

      const result = await service.update('tpl-1', { title: 'Admin Edit' }, mockAdmin);

      expect(result.title).toBe('Admin Edit');
    });

    it('should throw NotFoundException when template not found', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { title: 'X' }, mockTeacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when teacher does not own template', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);

      await expect(
        service.update('tpl-1', { title: 'X' }, otherTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should preserve existing desc when not provided in update', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.update.mockResolvedValue(mockTemplate);

      await service.update('tpl-1', { title: 'New Title' }, mockTeacher);

      expect(prisma.homeworkTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { title: 'New Title', desc: 'Write an essay' },
      });
    });

    it('should allow clearing desc by setting it to empty string', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.update.mockResolvedValue({ ...mockTemplate, desc: '' });

      await service.update('tpl-1', { desc: '' }, mockTeacher);

      expect(prisma.homeworkTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { title: 'Essay Template', desc: '' },
      });
    });
  });

  // ─── delete ───

  describe('delete', () => {
    it('should delete template owned by teacher', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.delete.mockResolvedValue(undefined);

      const result = await service.delete('tpl-1', mockTeacher);

      expect(result).toEqual({ ok: true });
      expect(prisma.homeworkTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
    });

    it('should allow admin to delete any template', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.homeworkTemplate.delete.mockResolvedValue(undefined);

      const result = await service.delete('tpl-1', mockAdmin);

      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException when template not found', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing', mockTeacher)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when teacher does not own template', async () => {
      prisma.homeworkTemplate.findUnique.mockResolvedValue(mockTemplate);

      await expect(service.delete('tpl-1', otherTeacher)).rejects.toThrow(ForbiddenException);
    });
  });
});
