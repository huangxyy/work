import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { RedisService } from '../common/redis';
import { EmailService } from '../email/email.service';
import { AuthService } from './auth.service';
import { AccountLockoutService } from './account-lockout.service';
import { TokenBlacklistService } from './token-blacklist.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let auditService: jest.Mocked<AuditService>;
  let lockoutService: jest.Mocked<AccountLockoutService>;
  let tokenBlacklistService: jest.Mocked<TokenBlacklistService>;

  const mockUser = {
    id: 'user-1',
    account: 'testuser',
    name: 'Test User',
    role: Role.STUDENT,
    passwordHash: '$2a$10$hashedpassword',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as unknown as jest.Mocked<JwtService>;

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    lockoutService = {
      isLocked: jest.fn().mockResolvedValue({ locked: false, remainingSeconds: 0 }),
      recordFailure: jest.fn().mockResolvedValue({ locked: false, attempts: 1 }),
      resetOnSuccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountLockoutService>;

    tokenBlacklistService = {
      revoke: jest.fn().mockResolvedValue(undefined),
      isRevoked: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<TokenBlacklistService>;

    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as RedisService;

    const emailServiceMock = {
      isConfigured: false,
      send: jest.fn().mockResolvedValue(false),
    } as unknown as EmailService;

    authService = new AuthService(
      prismaService,
      jwtService,
      auditService,
      lockoutService,
      tokenBlacklistService,
      redisService,
      emailServiceMock,
    );
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.register({
        account: 'testuser',
        name: 'Test User',
        password: 'password123',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.account).toBe('testuser');
    });

    it('should throw BadRequestException if account already exists', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      await expect(
        authService.register({
          account: 'testuser',
          name: 'Test User',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use default role STUDENT when not specified', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue(mockUser);

      await authService.register({
        account: 'testuser',
        name: 'Test User',
        password: 'password123',
      });

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.STUDENT,
          }),
        }),
      );
    });

    it('should always create student role', async () => {
      const createdUser = { ...mockUser, role: Role.STUDENT };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.create = jest.fn().mockResolvedValue(createdUser);

      await authService.register({
        account: 'teacher1',
        name: 'Teacher One',
        password: 'password123',
      });

      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.STUDENT,
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(userWithHash);

      const result = await authService.login({
        account: 'testuser',
        password: 'password123',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        authService.login({
          account: 'nonexistent',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is disabled', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const disabledUser = { ...mockUser, isActive: false, passwordHash: hashedPassword };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(disabledUser);

      await expect(
        authService.login({
          account: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should trim account before lockout and lookup', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(userWithHash);

      await authService.login({
        account: '  testuser  ',
        password: 'password123',
      });

      expect(lockoutService.isLocked).toHaveBeenCalledWith('testuser');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { account: 'testuser' },
      });
      expect(lockoutService.resetOnSuccess).toHaveBeenCalledWith('testuser');
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(userWithHash);

      await expect(
        authService.login({
          account: 'testuser',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for empty account', async () => {
      await expect(
        authService.login({ account: '   ', password: 'pass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when account is locked', async () => {
      lockoutService.isLocked = jest.fn().mockResolvedValue({ locked: true, remainingSeconds: 600 });

      await expect(
        authService.login({ account: 'testuser', password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when lockout threshold reached on failed login', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      lockoutService.recordFailure = jest.fn().mockResolvedValue({ locked: true, attempts: 5 });

      await expect(
        authService.login({ account: 'testuser', password: 'wrong' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should revoke token and log audit', async () => {
      await authService.logout('jti-123', 3600, 'user-1', '127.0.0.1');

      expect(tokenBlacklistService.revoke).toHaveBeenCalledWith('jti-123', 3600);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', userId: 'user-1' }),
      );
    });
  });

  describe('isTokenRevoked', () => {
    it('should delegate to tokenBlacklist', async () => {
      tokenBlacklistService.isRevoked = jest.fn().mockResolvedValue(true);

      const result = await authService.isTokenRevoked('jti-abc');

      expect(result).toBe(true);
      expect(tokenBlacklistService.isRevoked).toHaveBeenCalledWith('jti-abc');
    });
  });

  describe('updateProfile', () => {
    it('should update name, email, and phone', async () => {
      const updated = { ...mockUser, name: 'New Name', email: 'new@test.com', phone: '123' };
      prismaService.user.update = jest.fn().mockResolvedValue(updated);

      const result = await authService.updateProfile('user-1', {
        name: ' New Name ',
        email: ' New@Test.com ',
        phone: ' 123 ',
      });

      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name', email: 'new@test.com', phone: '123' },
      });
    });

    it('should clear email when set to empty string', async () => {
      prismaService.user.update = jest.fn().mockResolvedValue(mockUser);

      await authService.updateProfile('user-1', { email: '' });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: null },
      });
    });

    it('should clear phone when set to empty string', async () => {
      prismaService.user.update = jest.fn().mockResolvedValue(mockUser);

      await authService.updateProfile('user-1', { phone: '' });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { phone: null },
      });
    });
  });

  describe('changePassword', () => {
    it('should change password when old password is correct', async () => {
      const hashedPassword = await bcrypt.hash('oldpass', 10);
      prismaService.user.findUnique = jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hashedPassword });
      prismaService.user.update = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.changePassword('user-1', 'oldpass', 'newpass');

      expect(result).toEqual({ ok: true });
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_CHANGE' }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        authService.changePassword('missing', 'old', 'new'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when old password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 10);
      prismaService.user.findUnique = jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hashedPassword });

      await expect(
        authService.changePassword('user-1', 'wrongold', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new password equals old password', async () => {
      const hashedPassword = await bcrypt.hash('samepass', 10);
      prismaService.user.findUnique = jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hashedPassword });

      await expect(
        authService.changePassword('user-1', 'samepass', 'samepass'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendPasswordResetCode', () => {
    it('should return ok even when user not found (no email leak)', async () => {
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);

      const result = await authService.sendPasswordResetCode('unknown@test.com');

      expect(result).toEqual({ ok: true });
    });

    it('should send email with code when user has email', async () => {
      prismaService.user.findFirst = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
      });
      const redisService = (authService as any).redis;
      const emailServiceMock = (authService as any).emailService;

      const result = await authService.sendPasswordResetCode('user@test.com');

      expect(result).toEqual({ ok: true });
      expect(redisService.set).toHaveBeenCalledWith(
        'pwd-reset:user@test.com',
        expect.stringMatching(/^\d{6}$/),
        300,
      );
      expect(emailServiceMock.send).toHaveBeenCalled();
    });
  });

  describe('exportUserData', () => {
    it('should return user data with submissions and notifications', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        account: 'testuser',
        name: 'Test',
        role: Role.STUDENT,
      });
      Object.defineProperty(prismaService, 'submission', {
        value: { findMany: jest.fn().mockResolvedValue([{ id: 'sub-1', status: 'DONE' }]) },
        configurable: true,
      });
      Object.defineProperty(prismaService, 'notification', {
        value: { findMany: jest.fn().mockResolvedValue([{ id: 'notif-1', type: 'GRADING_DONE' }]) },
        configurable: true,
      });

      const result = await authService.exportUserData('user-1');

      expect(result.user).toBeDefined();
      expect(result.submissions).toHaveLength(1);
      expect(result.notifications).toHaveLength(1);
      expect(result.exportedAt).toBeDefined();
    });
  });

  describe('resetPasswordWithCode', () => {
    it('should reset password when code is valid', async () => {
      const hashedPassword = await bcrypt.hash('oldpass', 10);
      const redisService = (authService as any).redis;
      redisService.get = jest.fn().mockResolvedValue('123456');
      prismaService.user.findFirst = jest.fn().mockResolvedValue({ ...mockUser, email: 'user@test.com', passwordHash: hashedPassword });
      prismaService.user.update = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.resetPasswordWithCode('user@test.com', '123456', 'newpass');

      expect(result).toEqual({ ok: true });
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith('pwd-reset:user@test.com');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_RESET' }),
      );
    });

    it('should throw BadRequestException for invalid code', async () => {
      const redisService = (authService as any).redis;
      redisService.get = jest.fn().mockResolvedValue('000000');

      await expect(
        authService.resetPasswordWithCode('user@test.com', '999999', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no stored code exists', async () => {
      const redisService = (authService as any).redis;
      redisService.get = jest.fn().mockResolvedValue(null);

      await expect(
        authService.resetPasswordWithCode('user@test.com', '123456', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user not found', async () => {
      const redisService = (authService as any).redis;
      redisService.get = jest.fn().mockResolvedValue('123456');
      prismaService.user.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        authService.resetPasswordWithCode('user@test.com', '123456', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new password equals current', async () => {
      const hashedPassword = await bcrypt.hash('samepass', 10);
      const redisService = (authService as any).redis;
      redisService.get = jest.fn().mockResolvedValue('123456');
      prismaService.user.findFirst = jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hashedPassword });

      await expect(
        authService.resetPasswordWithCode('user@test.com', '123456', 'samepass'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
