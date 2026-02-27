import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as jest.Mocked<PrismaService>;
    service = new AuditService(prisma);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      await service.log({
        action: 'LOGIN_SUCCESS',
        userId: 'u1',
        ip: '1.2.3.4',
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGIN_SUCCESS',
          userId: 'u1',
          ip: '1.2.3.4',
        }),
      });
    });

    it('should pass optional fields as undefined when not provided', async () => {
      await service.log({ action: 'LOGOUT' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGOUT',
          userId: undefined,
          targetId: undefined,
          ip: undefined,
        }),
      });
    });

    it('should truncate detail to 4000 chars', async () => {
      const longDetail = 'x'.repeat(5000);
      await service.log({ action: 'CONFIG_UPDATE', detail: longDetail });
      const callArgs = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.detail.length).toBe(4000);
    });

    it('should keep short detail unchanged', async () => {
      await service.log({ action: 'CONFIG_UPDATE', detail: 'short' });
      const callArgs = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.detail).toBe('short');
    });

    it('should not throw on DB error', async () => {
      prisma.auditLog.create = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(
        service.log({ action: 'LOGIN_SUCCESS' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('listRecent', () => {
    it('should use default limit of 50', async () => {
      await service.listRecent();
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should cap limit at 200', async () => {
      await service.listRecent(500);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('should pass offset correctly', async () => {
      await service.listRecent(20, 40);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 40 }),
      );
    });
  });

  describe('countByAction', () => {
    it('should count entries by action since a given date', async () => {
      const since = new Date('2026-01-01');
      await service.countByAction('LOGIN_FAILED', since);
      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: { action: 'LOGIN_FAILED', createdAt: { gte: since } },
      });
    });
  });
});
