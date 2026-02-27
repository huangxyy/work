import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class HomeworkTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { title: string; desc?: string }, teacher: AuthUser) {
    return this.prisma.homeworkTemplate.create({
      data: { title: data.title, desc: data.desc, teacherId: teacher.id },
    });
  }

  async list(teacherId: string) {
    return this.prisma.homeworkTemplate.findMany({
      where: { teacherId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async update(id: string, data: { title?: string; desc?: string }, teacher: AuthUser) {
    const template = await this.prisma.homeworkTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.teacherId !== teacher.id && teacher.role !== 'ADMIN') throw new ForbiddenException();
    return this.prisma.homeworkTemplate.update({
      where: { id },
      data: { title: data.title ?? template.title, desc: data.desc !== undefined ? data.desc : template.desc },
    });
  }

  async delete(id: string, teacher: AuthUser) {
    const template = await this.prisma.homeworkTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.teacherId !== teacher.id && teacher.role !== 'ADMIN') throw new ForbiddenException();
    await this.prisma.homeworkTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
