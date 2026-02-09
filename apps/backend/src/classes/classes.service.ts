import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import pinyin from 'pinyin';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateClassDto } from './dto/create-class.dto';
import { ImportStudentsDto, StudentInputDto } from './dto/import-students.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async createClass(dto: CreateClassDto, user: AuthUser) {
    let teacherRelation: { connect: { id: string } } | undefined;

    if (user.role === Role.TEACHER) {
      teacherRelation = { connect: { id: user.id } };
    } else if (dto.teacherId) {
      teacherRelation = { connect: { id: dto.teacherId } };
    }

    return this.prisma.class.create({
      data: {
        name: dto.name,
        grade: dto.grade,
        ...(teacherRelation ? { teachers: teacherRelation } : {}),
      },
    });
  }

  async listClasses(user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return this.prisma.class.findMany({
        include: { teachers: { select: { id: true, name: true, account: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === Role.TEACHER) {
      return this.prisma.class.findMany({
        where: { teachers: { some: { id: user.id } } },
        include: { teachers: { select: { id: true, name: true, account: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    throw new ForbiddenException('Only teacher or admin can list classes');
  }

  async updateTeachers(classId: string, teacherIds: string[], user: AuthUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can update teachers');
    }

    const klass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!klass) {
      throw new NotFoundException('Class not found');
    }

    const uniqueIds = Array.from(new Set(teacherIds || []));
    if (uniqueIds.length) {
      const teachers = await this.prisma.user.findMany({
        where: { id: { in: uniqueIds }, role: Role.TEACHER },
        select: { id: true },
      });
      if (teachers.length !== uniqueIds.length) {
        throw new BadRequestException('Invalid teacher selection');
      }
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        teachers: {
          set: uniqueIds.map((id) => ({ id })),
        },
      },
      include: { teachers: { select: { id: true, name: true, account: true } } },
    });
  }

  private parseStudentText(text: string): {
    students: StudentInputDto[];
    invalid: Array<{ account: string; name: string; error: string }>;
  } {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const result: StudentInputDto[] = [];
    const invalid: Array<{ account: string; name: string; error: string }> = [];

    for (const line of lines) {
      const parts = line.split(/[\t,，\s]+/).filter(Boolean);
      if (parts.length === 0) {
        continue;
      }

      let account: string | undefined;
      let name: string | undefined;

      if (parts.length === 1) {
        const token = parts[0].trim();
        if (this.looksLikeAccount(token)) {
          account = token;
          name = token;
        } else {
          name = token;
          account = this.generateAccountFromName(token);
        }
      } else if (parts.length === 2) {
        const [part1, part2] = parts;
        if (this.looksLikeAccount(part1) && !this.looksLikeAccount(part2)) {
          account = part1;
          name = part2;
        } else if (!this.looksLikeAccount(part1) && this.looksLikeAccount(part2)) {
          name = part1;
          account = part2;
        } else {
          account = part1;
          name = part2;
        }
      } else {
        const hasAccountLike = parts.some((part) => this.looksLikeAccount(part));
        if (!hasAccountLike) {
          name = parts.join(' ');
          account = this.generateAccountFromName(name);
        } else {
          account = parts[0];
          name = parts.slice(1).join(' ');
        }
      }

      const normalizedAccount = this.normalizeAccount(account || '');
      const normalizedName = (name || '').trim();
      if (!normalizedName) {
        invalid.push({ account: normalizedAccount || '-', name: '-', error: `Invalid line: ${line}` });
        continue;
      }
      if (!normalizedAccount || !this.looksLikeAccount(normalizedAccount)) {
        invalid.push({
          account: normalizedAccount || '-',
          name: normalizedName,
          error: `Cannot resolve a valid account from line: ${line}`,
        });
        continue;
      }
      result.push({ account: normalizedAccount, name: normalizedName });
    }

    return { students: result, invalid };
  }

  private generateAccountFromName(name: string): string {
    const source = name.replace(/\s+/g, '').trim();
    if (!source) {
      return '';
    }
    try {
      const pinyinArray = pinyin(source, { style: 'normal' });
      const merged = pinyinArray.map((item: string[]) => item[0] || '').join('');
      return this.normalizeAccount(merged);
    } catch {
      return this.normalizeAccount(source);
    }
  }

  private normalizeAccount(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  private looksLikeAccount(str: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(str);
  }

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

    throw new ForbiddenException('Only teacher or admin can access class');
  }

  async importStudents(classId: string, dto: ImportStudentsDto, user: AuthUser) {
    await this.ensureClassAccess(classId, user);

    const parsedText = dto.text ? this.parseStudentText(dto.text) : { students: [], invalid: [] };

    const students = [
      ...(dto.students || []),
      ...parsedText.students,
    ];

    if (students.length === 0 && parsedText.invalid.length === 0) {
      throw new BadRequestException('No students provided');
    }

    // Match the seed default password; '123456' was too weak
    const defaultPassword = dto.defaultPassword || 'Test1234';

    const studentIds: string[] = [];
    const result = {
      total: students.length + parsedText.invalid.length,
      created: [] as Array<{ account: string; name: string }>,
      existing: [] as Array<{ account: string; name: string }>,
      failed: [] as Array<{ account: string; name: string; error: string }>,
      enrolled: 0,
    };

    if (parsedText.invalid.length) {
      result.failed.push(...parsedText.invalid);
    }

    for (const student of students) {
      const account = this.normalizeAccount(student.account || '');
      const name = (student.name || '').trim();

      if (!name) {
        result.failed.push({ account: account || '-', name: '-', error: 'Student name is required' });
        continue;
      }

      if (!account || !this.looksLikeAccount(account)) {
        result.failed.push({
          account: account || '-',
          name,
          error: 'Account must contain only letters, numbers, or underscore',
        });
        continue;
      }

      try {
        const existing = await this.prisma.user.findUnique({
          where: { account },
        });

        if (existing) {
          studentIds.push(existing.id);
          result.existing.push({ account, name });
          continue;
        }

        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const created = await this.prisma.user.create({
          data: {
            account,
            name,
            role: Role.STUDENT,
            passwordHash,
          },
        });
        studentIds.push(created.id);
        result.created.push({ account, name });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.failed.push({ account, name, error: errorMessage });
      }
    }

    const enrollmentData = studentIds.map((studentId) => ({
      classId,
      studentId,
    }));

    const enrollments = await this.prisma.enrollment.createMany({
      data: enrollmentData,
      skipDuplicates: true,
    });

    result.enrolled = enrollments.count;

    return result;
  }

  async listStudents(classId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: { student: true },
    });

    return enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      account: enrollment.student.account,
      name: enrollment.student.name,
    }));
  }

  async removeStudent(classId: string, studentId: string, user: AuthUser) {
    await this.ensureClassAccess(classId, user);
    const result = await this.prisma.enrollment.deleteMany({
      where: { classId, studentId },
    });
    return { removed: result.count };
  }
}
