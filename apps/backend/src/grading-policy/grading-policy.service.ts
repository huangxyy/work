import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GradingPolicyInput = {
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
};

export type GradingPolicyResolved = {
  mode: 'cheap' | 'quality';
  needRewrite: boolean;
};

@Injectable()
export class GradingPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassPolicy(classId: string) {
    return this.prisma.gradingPolicy.findUnique({ where: { classId } });
  }

  async getHomeworkPolicy(homeworkId: string) {
    return this.prisma.gradingPolicy.findUnique({ where: { homeworkId } });
  }

  async upsertClassPolicy(classId: string, input: GradingPolicyInput) {
    return this.prisma.gradingPolicy.upsert({
      where: { classId },
      update: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.needRewrite !== undefined ? { needRewrite: input.needRewrite } : {}),
      },
      create: {
        classId,
        mode: input.mode ?? null,
        needRewrite: input.needRewrite ?? null,
      },
    });
  }

  async upsertHomeworkPolicy(homeworkId: string, input: GradingPolicyInput) {
    return this.prisma.gradingPolicy.upsert({
      where: { homeworkId },
      update: {
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.needRewrite !== undefined ? { needRewrite: input.needRewrite } : {}),
      },
      create: {
        homeworkId,
        mode: input.mode ?? null,
        needRewrite: input.needRewrite ?? null,
      },
    });
  }

  async clearClassPolicy(classId: string) {
    return this.prisma.gradingPolicy.deleteMany({ where: { classId } });
  }

  async clearHomeworkPolicy(homeworkId: string) {
    return this.prisma.gradingPolicy.deleteMany({ where: { homeworkId } });
  }

  async resolvePolicy(params: { classId?: string | null; homeworkId?: string | null }): Promise<GradingPolicyResolved> {
    let classId = params.classId || undefined;
    if (!classId && params.homeworkId) {
      const homework = await this.prisma.homework.findUnique({
        where: { id: params.homeworkId },
        select: { classId: true },
      });
      classId = homework?.classId || undefined;
    }

    const [classPolicy, homeworkPolicy] = await Promise.all([
      classId ? this.getClassPolicy(classId) : Promise.resolve(null),
      params.homeworkId ? this.getHomeworkPolicy(params.homeworkId) : Promise.resolve(null),
    ]);

    const resolved: GradingPolicyResolved = { mode: 'cheap', needRewrite: false };
    this.applyPolicy(resolved, classPolicy);
    this.applyPolicy(resolved, homeworkPolicy);
    return resolved;
  }

  private applyPolicy(target: GradingPolicyResolved, policy: { mode?: string | null; needRewrite?: boolean | null } | null) {
    if (!policy) {
      return;
    }
    const normalizedMode = this.normalizeMode(policy.mode);
    if (normalizedMode) {
      target.mode = normalizedMode;
    }
    if (policy.needRewrite !== undefined && policy.needRewrite !== null) {
      target.needRewrite = Boolean(policy.needRewrite);
    }
  }

  private normalizeMode(value?: string | null): 'cheap' | 'quality' | null {
    if (value === 'cheap' || value === 'quality') {
      return value;
    }
    return null;
  }
}
