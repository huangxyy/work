import { Injectable } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, user: AuthUser, limit = 10): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();
    const results: SearchResult[] = [];

    if (user.role === 'STUDENT') {
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

    if (user.role === 'TEACHER') {
      const homeworks = await this.prisma.homework.findMany({
        where: {
          title: { contains: q },
          class: { teachers: { some: { id: user.id } } },
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
          linkTo: `/teacher/homeworks/${h.id}`,
        }),
      );

      const students = await this.prisma.user.findMany({
        where: {
          role: 'STUDENT',
          OR: [{ name: { contains: q } }, { account: { contains: q } }],
          studentEnrolls: { some: { class: { teachers: { some: { id: user.id } } } } },
        },
        select: { id: true, name: true, account: true },
        take: limit,
      });
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

    if (user.role === 'ADMIN') {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { account: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, name: true, account: true, role: true },
        take: limit,
      });
      users.forEach((u) =>
        results.push({
          type: 'student',
          id: u.id,
          title: `${u.name} (${u.role})`,
          subtitle: u.account,
          linkTo: `/admin/users`,
        }),
      );

      const classes = await this.prisma.class.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true },
        take: limit,
      });
      classes.forEach((c) =>
        results.push({
          type: 'class',
          id: c.id,
          title: c.name,
          linkTo: `/admin/classes`,
        }),
      );
    }

    return results.slice(0, limit);
  }
}
