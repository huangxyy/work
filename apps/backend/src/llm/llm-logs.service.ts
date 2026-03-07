import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LlmLogInput = {
  source: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  status: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
  prompt?: string;
  systemPrompt?: string;
  response?: string;
  error?: string;
  userId?: string;
  submissionId?: string;
  meta?: Prisma.InputJsonValue;
};

export type LlmLogQuery = {
  page?: number;
  pageSize?: number;
  providerId?: string;
  model?: string;
  status?: string;
  source?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class LlmLogsService {
  private readonly logger = new Logger(LlmLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logCall(input: LlmLogInput) {
    const startedAt = Date.now();
    try {
      await this.prisma.llmCallLog.create({
        data: {
          source: input.source,
          providerId: input.providerId,
          providerName: input.providerName,
          model: input.model,
          status: input.status,
          latencyMs: input.latencyMs,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.totalTokens,
          cost: input.cost,
          prompt: input.prompt,
          systemPrompt: input.systemPrompt,
          response: input.response,
          error: input.error,
          userId: input.userId,
          submissionId: input.submissionId,
          meta: input.meta,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to write LLM log source=${input.source} providerId=${input.providerId || 'none'} model=${input.model || 'none'} status=${input.status} durationMs=${Date.now() - startedAt}: ${message}`,
      );
      throw error;
    }
  }

  async listLogs(query: LlmLogQuery) {
    const startedAt = Date.now();
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);
    const where = {
      providerId: query.providerId || undefined,
      model: query.model || undefined,
      status: query.status || undefined,
      source: query.source || undefined,
      createdAt: {
        gte: query.from,
        lte: query.to,
      },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.llmCallLog.count({ where }),
      this.prisma.llmCallLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    this.logger.debug(
      `LLM logs listed total=${total} returned=${items.length} page=${page} pageSize=${pageSize} providerId=${query.providerId || 'none'} model=${query.model || 'none'} status=${query.status || 'none'} source=${query.source || 'none'} durationMs=${Date.now() - startedAt}`,
    );

    return { items, total, page, pageSize };
  }

  async clearLogs(filter: { before?: Date; source?: string }) {
    const startedAt = Date.now();
    const where = {
      source: filter.source || undefined,
      createdAt: filter.before ? { lt: filter.before } : undefined,
    };

    const result = await this.prisma.llmCallLog.deleteMany({ where });

    this.logger.debug(
      `LLM logs cleared deleted=${result.count} source=${filter.source || 'none'} before=${filter.before?.toISOString() || 'none'} durationMs=${Date.now() - startedAt}`,
    );

    return { deleted: result.count };
  }
}
