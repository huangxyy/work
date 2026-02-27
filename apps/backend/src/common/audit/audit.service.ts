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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
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
      this.logger.error(`Failed to write audit log: ${msg}`);
    }
  }

  async listRecent(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      skip: offset,
    });
  }

  async countByAction(action: AuditAction, since: Date) {
    return this.prisma.auditLog.count({
      where: { action, createdAt: { gte: since } },
    });
  }
}
