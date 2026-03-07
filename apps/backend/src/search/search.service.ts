import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

type SearchResult = {
  type: 'submission' | 'homework' | 'student' | 'class';
  id: string;
  title: string;
  subtitle?: string;
  linkTo: string;
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, user: AuthUser, limit = 10): Promise<SearchResult[]> {
    const startedAt = Date.now();
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    const results: SearchResult[] = [];

    if (user.role === Role.STUDENT) {
      const homeworks = await this.prisma.homework.findMany({
        where: {
          title: { contains: q },
          class: { enrolls: { some: { studentId: user.id } } },
        },
        select: { id: true, title: true, class: { select: { name: true } } },
        take: limit,
      });
      homeworks.forEach((h) =>
        results.push({
          type: 'homework',
          id: h.id,
          title: h.title,
          subtitle: h.class.name,
          linkTo: `/student/homeworks/${h.id}`,
        }),
      );
    }

    if (user.role === Role.TEACHER) {
      const [homeworks, students] = await Promise.all([
        this.prisma.homework.findMany({
          where: {
            title: { contains: q },
            class: { teachers: { some: { id: user.id } } },
          },
          select: { id: true, title: true, class: { select: { name: true } } },
          take: limit,
        }),
        this.prisma.user.findMany({
          where: {
            role: Role.STUDENT,
            OR: [{ name: { contains: q } }, { account: { contains: q } }],
            studentEnrolls: { some: { class: { teachers: { some: { id: user.id } } } } },
          },
          select: { id: true, name: true, account: true },
          take: limit,
        }),
      ]);
      homeworks.forEach((h) =>
        results.push({
          type: 'homework',
          id: h.id,
          title: h.title,
          subtitle: h.class.name,
          linkTo: `/teacher/homeworks/${h.id}`,
        }),
      );
      students.forEach((s) =>
        results.push({
          type: 'student',
          id: s.id,
          title: s.name,
          subtitle: s.account,
          linkTo: `/teacher/reports/student/${s.id}`,
        }),
      );
    }

    if (user.role === Role.ADMIN) {
      const [users, classes] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { account: { contains: q } },
              { email: { contains: q } },
            ],
          },
          select: { id: true, name: true, account: true, role: true },
          take: limit,
        }),
        this.prisma.class.findMany({
          where: { name: { contains: q } },
          select: { id: true, name: true },
          take: limit,
        }),
      ]);
      users.forEach((u) =>
        results.push({
          type: 'student',
          id: u.id,
          title: `${u.name} (${u.role})`,
          subtitle: u.account,
          linkTo: `/admin/users`,
        }),
      );
      classes.forEach((c) =>
        results.push({
          type: 'class',
          id: c.id,
          title: c.name,
          linkTo: `/admin/classes`,
        }),
      );
    }

    const finalResults = results.slice(0, limit);

    this.logger.debug(
      `Search completed role=${user.role} queryLength=${q.length} limit=${limit} results=${finalResults.length} durationMs=${Date.now() - startedAt}`,
    );

    return finalResults;
  }
}
