import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'ROLE_CHANGE'
  | 'USER_DELETE'
  | 'USER_CREATE'
  | 'USER_DISABLE'
  | 'CONFIG_UPDATE'
  | 'DATA_DELETE'
  | 'REGRADE'
  | 'ADMIN_ACTION';

type AuditEntry = {
  action: AuditAction;
  userId?: string;
  targetId?: string;
  ip?: string;
  detail?: string;
};

type ListRecentOptions = {
  limit?: number;
  offset?: number;
  action?: string;
  actions?: string[];
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const startedAt = Date.now();
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId,
          targetId: entry.targetId,
          ip: entry.ip,
          detail: entry.detail?.slice(0, 4000),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `Failed to write audit log action=${entry.action} durationMs=${Date.now() - startedAt}: ${msg}`,
      );
    }
  }

  async listRecent(options: ListRecentOptions = {}) {
    const startedAt = Date.now();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const action = options.action?.trim();
    const actions = options.actions?.map((entry) => entry.trim()).filter(Boolean) || [];
    const take = Math.min(limit, 200);

    const where = action
      ? { action }
      : actions.length > 0
        ? { action: { in: actions } }
        : undefined;

    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip: offset,
    });

    this.logger.debug(
      `Audit logs listed returned=${records.length} offset=${offset} limit=${take} action=${action || 'none'} actions=${actions.length} durationMs=${Date.now() - startedAt}`,
    );

    return records;
  }

  async countByAction(action: AuditAction, since: Date) {
    const startedAt = Date.now();
    const count = await this.prisma.auditLog.count({
      where: { action, createdAt: { gte: since } },
    });

    this.logger.debug(
      `Audit log count fetched action=${action} count=${count} since=${since.toISOString()} durationMs=${Date.now() - startedAt}`,
    );

    return count;
  }
}
