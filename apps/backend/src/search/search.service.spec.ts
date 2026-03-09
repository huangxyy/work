import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;

  const mockStudent = { id: 'student-1', role: Role.STUDENT, account: 'student1', name: 'Student' };
  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 'teacher1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin1', name: 'Admin' };

  beforeEach(async () => {
    prisma = {
      homework: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      class: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  // ─── empty / short queries ───

  describe('query validation', () => {
    it('should return empty for empty query', async () => {
      expect(await service.search('', mockStudent)).toEqual([]);
    });

    it('should return empty for single-character query', async () => {
      expect(await service.search('a', mockTeacher)).toEqual([]);
    });

    it('should return empty for whitespace-only query', async () => {
      expect(await service.search('   ', mockAdmin)).toEqual([]);
    });
  });

  // ─── student search ───

  describe('student role', () => {
    it('should search homeworks for enrolled student', async () => {
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'Essay Writing', class: { name: 'Class A' } },
      ]);

      const results = await service.search('Essay', mockStudent);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('homework');
      expect(results[0].linkTo).toBe('/student/homeworks/hw-1');
      expect(results[0].subtitle).toBe('Class A');
    });

    it('should not search users or classes for student', async () => {
      prisma.homework.findMany.mockResolvedValue([]);

      await service.search('test', mockStudent);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.class.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── teacher search ───

  describe('teacher role', () => {
    it('should search homeworks and students for teacher', async () => {
      prisma.homework.findMany.mockResolvedValue([
        { id: 'hw-1', title: 'Math Quiz', class: { name: 'Class B' } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 's1', name: 'Alice', account: 'alice' },
      ]);

      const results = await service.search('al', mockTeacher);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('homework');
      expect(results[0].linkTo).toBe('/teacher/homeworks/hw-1');
      expect(results[1].type).toBe('student');
      expect(results[1].linkTo).toBe('/teacher/reports/student/s1');
    });

    it('should not search classes for teacher', async () => {
      await service.search('test', mockTeacher);

      expect(prisma.class.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── admin search ───

  describe('admin role', () => {
    it('should search users and classes for admin', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Bob', account: 'bob', role: Role.STUDENT },
      ]);
      prisma.class.findMany.mockResolvedValue([
        { id: 'c1', name: 'Test Class' },
      ]);

      const results = await service.search('Test', mockAdmin);

      expect(results).toHaveLength(2);
      const userResult = results.find((r: any) => r.type === 'student')!;
      expect(userResult.title).toBe('Bob (STUDENT)');
      expect(userResult.linkTo).toBe('/admin/users');

      const classResult = results.find((r: any) => r.type === 'class')!;
      expect(classResult.linkTo).toBe('/admin/classes');
    });

    it('should not search homeworks for admin', async () => {
      await service.search('test', mockAdmin);

      expect(prisma.homework.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── limit ───

  describe('result limit', () => {
    it('should respect custom limit', async () => {
      prisma.homework.findMany.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          id: `hw-${i}`,
          title: `Homework ${i}`,
          class: { name: 'Class' },
        })),
      );

      const results = await service.search('Homework', mockStudent, 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });
});
