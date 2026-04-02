import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClassesService } from './classes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClassesService', () => {
  let service: ClassesService;
  let prisma: any;

  const mockTeacher = { id: 'teacher-1', role: Role.TEACHER, account: 'teacher1', name: 'Teacher' };
  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, account: 'admin1', name: 'Admin' };
  const mockStudent = { id: 'student-1', role: Role.STUDENT, account: 'student1', name: 'Student' };

  const mockClass = { id: 'class-1', name: 'Test Class', grade: '5', createdAt: new Date(), teachers: [], _count: { enrolls: 0 } };

  beforeEach(async () => {
    prisma = {
      class: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  // ─── createClass ───

  describe('createClass', () => {
    it('should create class with teacher auto-connected for teacher role', async () => {
      prisma.class.create.mockResolvedValue(mockClass);

      const result = await service.createClass({ name: 'New Class', grade: '5' }, mockTeacher);

      expect(result).toEqual(mockClass);
      expect(prisma.class.create).toHaveBeenCalledWith({
        data: {
          name: 'New Class',
          grade: '5',
          teachers: { connect: { id: 'teacher-1' } },
        },
      });
    });

    it('should create class with specified teacherId for admin', async () => {
      prisma.class.create.mockResolvedValue(mockClass);

      await service.createClass(
        { name: 'Class', grade: '3', teacherId: 'teacher-2' },
        mockAdmin,
      );

      expect(prisma.class.create).toHaveBeenCalledWith({
        data: {
          name: 'Class',
          grade: '3',
          teachers: { connect: { id: 'teacher-2' } },
        },
      });
    });

    it('should create class without teacher when admin provides no teacherId', async () => {
      prisma.class.create.mockResolvedValue(mockClass);

      await service.createClass({ name: 'Class', grade: '1' }, mockAdmin);

      expect(prisma.class.create).toHaveBeenCalledWith({
        data: { name: 'Class', grade: '1' },
      });
    });
  });

  // ─── listClasses ───

  describe('listClasses', () => {
    it('should list all classes for admin', async () => {
      prisma.class.findMany.mockResolvedValue([mockClass]);

      const result = await service.listClasses(mockAdmin);

      expect(result).toHaveLength(1);
    });

    it('should list only owned classes for teacher', async () => {
      prisma.class.findMany.mockResolvedValue([mockClass]);

      const result = await service.listClasses(mockTeacher);

      expect(result).toHaveLength(1);
      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teachers: { some: { id: 'teacher-1' } } },
        }),
      );
    });

    it('should throw ForbiddenException for student role', async () => {
      await expect(service.listClasses(mockStudent)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── updateTeachers ───

  describe('updateTeachers', () => {
    it('should reject non-admin users', async () => {
      await expect(
        service.updateTeachers('class-1', ['t1'], mockTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when class not found', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTeachers('missing', ['t1'], mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when teacher IDs are invalid', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.user.findMany.mockResolvedValue([{ id: 't1' }]);

      await expect(
        service.updateTeachers('class-1', ['t1', 't2'], mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update teachers when all IDs are valid', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.user.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      prisma.class.update.mockResolvedValue(mockClass);

      const result = await service.updateTeachers('class-1', ['t1', 't2'], mockAdmin);

      expect(prisma.class.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teachers: { set: [{ id: 't1' }, { id: 't2' }] } },
        }),
      );
    });

    it('should allow setting empty teacher list', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.class.update.mockResolvedValue(mockClass);

      await service.updateTeachers('class-1', [], mockAdmin);

      expect(prisma.class.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teachers: { set: [] } },
        }),
      );
    });

    it('should deduplicate teacher IDs', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.user.findMany.mockResolvedValue([{ id: 't1' }]);
      prisma.class.update.mockResolvedValue(mockClass);

      await service.updateTeachers('class-1', ['t1', 't1', 't1'], mockAdmin);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['t1'] }, role: Role.TEACHER },
        }),
      );
    });
  });

  // ─── ensureClassAccess ───

  describe('ensureClassAccess (via listStudents)', () => {
    it('should allow admin access to any class', async () => {
      prisma.class.findUnique.mockResolvedValue(mockClass);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await service.listStudents('class-1', mockAdmin);

      expect(prisma.class.findUnique).toHaveBeenCalledWith({ where: { id: 'class-1' } });
    });

    it('should throw NotFoundException for admin when class missing', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(service.listStudents('missing', mockAdmin)).rejects.toThrow(NotFoundException);
    });

    it('should allow teacher access to owned class', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.enrollment.findMany.mockResolvedValue([]);

      await service.listStudents('class-1', mockTeacher);
    });

    it('should throw ForbiddenException for teacher without access', async () => {
      prisma.class.findFirst.mockResolvedValue(null);

      await expect(service.listStudents('class-1', mockTeacher)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for student role', async () => {
      await expect(service.listStudents('class-1', mockStudent)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── listStudents ───

  describe('listStudents', () => {
    it('should map enrollment data to student list', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.enrollment.findMany.mockResolvedValue([
        { student: { id: 's1', account: 'alice', name: 'Alice' } },
        { student: { id: 's2', account: 'bob', name: 'Bob' } },
      ]);

      const result = await service.listStudents('class-1', mockTeacher);

      expect(result).toEqual([
        { id: 's1', account: 'alice', name: 'Alice' },
        { id: 's2', account: 'bob', name: 'Bob' },
      ]);
    });
  });

  // ─── removeStudent ───

  describe('removeStudent', () => {
    it('should remove student enrollment', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.enrollment.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeStudent('class-1', 'student-1', mockTeacher);

      expect(result).toEqual({ removed: 1 });
      expect(prisma.enrollment.deleteMany).toHaveBeenCalledWith({
        where: { classId: 'class-1', studentId: 'student-1' },
      });
    });

    it('should return zero when student not enrolled', async () => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.enrollment.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.removeStudent('class-1', 'unknown', mockTeacher);

      expect(result).toEqual({ removed: 0 });
    });
  });

  // ─── importStudents ───

  describe('importStudents', () => {
    beforeEach(() => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
    });

    it('should throw BadRequestException when no students provided', async () => {
      await expect(
        service.importStudents('class-1', {}, mockTeacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new students and enroll them', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue({
        id: 'new-1',
        account: 'alice',
        name: 'Alice',
        role: Role.STUDENT,
      });
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: 'alice', name: 'Alice' }] },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
      expect(result.created[0].account).toBe('alice');
      expect(result.enrolled).toBe(1);
    });

    it('should reuse existing students', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'existing-1', account: 'bob', name: 'Bob', role: Role.STUDENT },
      ]);
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: 'bob', name: 'Bob' }] },
        mockTeacher,
      );

      expect(result.existing).toHaveLength(1);
      expect(result.created).toHaveLength(0);
    });

    it('should reject non-student existing accounts', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 't1', account: 'teacher1', name: 'Teacher', role: Role.TEACHER },
      ]);
      prisma.enrollment.createMany.mockResolvedValue({ count: 0 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: 'teacher1', name: 'Teacher' }] },
        mockTeacher,
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('不是学生账号');
    });

    it('should fail accounts with invalid characters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.enrollment.createMany.mockResolvedValue({ count: 0 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: '!!!', name: 'Bad' }] },
        mockTeacher,
      );

      expect(result.failed).toHaveLength(1);
    });

    it('should fail when new account has no name', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.enrollment.createMany.mockResolvedValue({ count: 0 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: 'valid_acct', name: '' }] },
        mockTeacher,
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('需要提供学生姓名');
    });

    it('should handle database errors during user creation gracefully', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockRejectedValue(new Error('Unique constraint'));
      prisma.enrollment.createMany.mockResolvedValue({ count: 0 });

      const result = await service.importStudents(
        'class-1',
        { students: [{ account: 'dup', name: 'Dup' }] },
        mockTeacher,
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Unique constraint');
    });

    it('should use custom default password when provided', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue({
        id: 'new-1',
        account: 'alice',
        name: 'Alice',
        role: Role.STUDENT,
      });
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      await service.importStudents(
        'class-1',
        { students: [{ account: 'alice', name: 'Alice' }], defaultPassword: 'CustomPass1' },
        mockTeacher,
      );

      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  // ─── parseStudentText ───

  describe('parseStudentText (via importStudents with text)', () => {
    beforeEach(() => {
      prisma.class.findFirst.mockResolvedValue(mockClass);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.enrollment.createMany.mockResolvedValue({ count: 0 });
    });

    it('should parse tab-separated account and name', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { text: 'alice\tAlice Wang' },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
      expect(result.created[0].account).toBe('alice');
      expect(result.created[0].name).toBe('Alice Wang');
    });

    it('should generate account from Chinese name when no account provided', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { text: '张三' },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
      expect(result.created[0].account).toMatch(/^[a-z]+$/);
    });

    it('should handle multiple lines with mixed formats', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 2 });

      const text = 'alice\tAlice\nbob,Bob Smith';
      const result = await service.importStudents(
        'class-1',
        { text },
        mockTeacher,
      );

      expect(result.created).toHaveLength(2);
    });

    it('should skip empty lines', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const text = '\n\nalice\tAlice\n\n';
      const result = await service.importStudents(
        'class-1',
        { text },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
    });

    it('should detect account-like vs name-like tokens', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { text: '张三\talice' },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
      expect(result.created[0].account).toBe('alice');
      expect(result.created[0].name).toBe('张三');
    });

    it('should handle 3+ part lines with all non-account tokens', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { text: '张 三 丰' },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
    });

    it('should handle 3+ part lines with account-like first token', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importStudents(
        'class-1',
        { text: 'alice Wang Mei' },
        mockTeacher,
      );

      expect(result.created).toHaveLength(1);
      expect(result.created[0].account).toBe('alice');
      expect(result.created[0].name).toBe('Wang Mei');
    });

    it('should merge text-parsed students with dto.students', async () => {
      prisma.user.create.mockImplementation(({ data }: any) => ({
        id: `new-${data.account}`,
        account: data.account,
        name: data.name,
        role: Role.STUDENT,
      }));
      prisma.enrollment.createMany.mockResolvedValue({ count: 2 });

      const result = await service.importStudents(
        'class-1',
        {
          students: [{ account: 'bob', name: 'Bob' }],
          text: 'alice\tAlice',
        },
        mockTeacher,
      );

      expect(result.created).toHaveLength(2);
    });
  });
});
