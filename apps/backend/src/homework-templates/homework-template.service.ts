import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateHomeworkTemplateDto } from './dto/create-homework-template.dto';
import { UpdateHomeworkTemplateDto } from './dto/update-homework-template.dto';

@Injectable()
export class HomeworkTemplateService {
  private readonly logger = new Logger(HomeworkTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateHomeworkTemplateDto, teacher: AuthUser) {
    const startedAt = Date.now();
    const template = await this.prisma.homeworkTemplate.create({
      data: { title: data.title, desc: data.desc, teacherId: teacher.id },
    });

    this.logger.debug(
      `Homework template created templateId=${template.id} teacherId=${teacher.id} durationMs=${Date.now() - startedAt}`,
    );

    return template;
  }

  async list(teacherId: string) {
    const startedAt = Date.now();
    const items = await this.prisma.homeworkTemplate.findMany({
      where: { teacherId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    this.logger.debug(
      `Homework templates listed teacherId=${teacherId} returned=${items.length} durationMs=${Date.now() - startedAt}`,
    );

    return items;
  }

  async update(id: string, data: UpdateHomeworkTemplateDto, teacher: AuthUser) {
    const startedAt = Date.now();
    const template = await this.prisma.homeworkTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('模板不存在');
    if (template.teacherId !== teacher.id && teacher.role !== Role.ADMIN) throw new ForbiddenException('无权操作该模板');
    const updated = await this.prisma.homeworkTemplate.update({
      where: { id },
      data: { title: data.title ?? template.title, desc: data.desc !== undefined ? data.desc : template.desc },
    });

    this.logger.debug(
      `Homework template updated templateId=${updated.id} actorUserId=${teacher.id} ownerTeacherId=${template.teacherId} durationMs=${Date.now() - startedAt}`,
    );

    return updated;
  }

  async delete(id: string, teacher: AuthUser) {
    const startedAt = Date.now();
    const template = await this.prisma.homeworkTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('模板不存在');
    if (template.teacherId !== teacher.id && teacher.role !== Role.ADMIN) throw new ForbiddenException('无权操作该模板');
    await this.prisma.homeworkTemplate.delete({ where: { id } });

    this.logger.debug(
      `Homework template deleted templateId=${id} actorUserId=${teacher.id} ownerTeacherId=${template.teacherId} durationMs=${Date.now() - startedAt}`,
    );

    return { ok: true };
  }
}
