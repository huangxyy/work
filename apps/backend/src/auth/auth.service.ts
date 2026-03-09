import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { RedisService } from '../common/redis';
import { EmailService } from '../email/email.service';
import { AccountLockoutService } from './account-lockout.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly lockout: AccountLockoutService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
  ) {}

  private sanitizeUser(user: User) {
    const safe = { ...user } as Omit<User, 'passwordHash'> & { passwordHash?: string };
    delete safe.passwordHash;
    return safe;
  }

  private signToken(user: User) {
    const jti = randomUUID();
    return this.jwtService.sign(
      {
        sub: user.id,
        role: user.role,
        account: user.account,
        name: user.name,
        jti,
      },
    );
  }

  async register(dto: RegisterDto, ip?: string) {
    const startedAt = Date.now();
    const account = dto.account.trim();
    const name = dto.name.trim();

    const existing = await this.prisma.user.findUnique({
      where: { account },
    });

    if (existing) {
      throw new BadRequestException('Registration failed. Please try a different account name.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        account,
        name,
        role: Role.STUDENT,
        passwordHash,
      },
    });

    await this.audit.log({
      action: 'REGISTER',
      userId: user.id,
      ip,
      detail: `New student registration: ${user.account}`,
    });

    this.logger.debug(
      `User registered account=${account} userId=${user.id} durationMs=${Date.now() - startedAt}`,
    );

    const token = this.signToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', 10);

  async login(dto: LoginDto, ip?: string) {
    const startedAt = Date.now();
    const account = dto.account.trim();
    if (!account) {
      throw new BadRequestException('Account is required');
    }

    // Check account lockout first
    const lockStatus = await this.lockout.isLocked(account);
    if (lockStatus.locked) {
      await this.audit.log({
        action: 'LOGIN_LOCKED',
        ip,
        detail: `Account locked: ${account}, remaining ${lockStatus.remainingSeconds}s`,
      });
      throw new ForbiddenException(
        `Account is temporarily locked. Try again in ${Math.ceil(lockStatus.remainingSeconds / 60)} minutes.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { account },
    });

    const hashToCompare = user?.passwordHash ?? this.dummyHash;
    const valid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !valid) {
      // Record failure and potentially lock
      const result = await this.lockout.recordFailure(account);
      await this.audit.log({
        action: 'LOGIN_FAILED',
        ip,
        detail: `Failed login for: ${account} (attempt ${result.attempts}${result.locked ? ', now locked' : ''})`,
      });
      if (result.locked) {
        throw new ForbiddenException(
          'Too many failed attempts. Account is temporarily locked for 15 minutes.',
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        userId: user.id,
        ip,
        detail: `Disabled account login attempt: ${user.account}`,
      });
      throw new ForbiddenException('Account is disabled');
    }

    // Success — reset lockout counter
    await this.lockout.resetOnSuccess(account);
    await this.audit.log({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      ip,
    });

    this.logger.debug(
      `User logged in account=${account} userId=${user.id} durationMs=${Date.now() - startedAt}`,
    );

    const token = this.signToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  async logout(jti: string, expiresInSeconds: number, userId?: string, ip?: string) {
    const startedAt = Date.now();
    await Promise.all([
      this.tokenBlacklist.revoke(jti, expiresInSeconds),
      this.audit.log({
        action: 'LOGOUT',
        userId,
        ip,
      }),
    ]);

    this.logger.debug(
      `User logged out userId=${userId || 'unknown'} jti=${jti} durationMs=${Date.now() - startedAt}`,
    );
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.tokenBlacklist.isRevoked(jti);
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: Prisma.UserUpdateInput = {};
    if (data.name?.trim()) updateData.name = data.name.trim();
    if (data.email !== undefined) updateData.email = data.email?.trim().toLowerCase() || null;
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.clearUserAuthCache(userId);

    return this.sanitizeUser(user);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    if (oldPassword === newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      action: 'PASSWORD_CHANGE',
      userId,
      detail: 'User changed their own password',
    });

    await this.clearUserAuthCache(userId);

    this.logger.debug(
      `Password changed userId=${userId} durationMs=${Date.now() - startedAt}`,
    );

    return { ok: true };
  }

  async sendPasswordResetCode(emailAddress: string) {
    const email = emailAddress.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    if (!user || !user.email) return { ok: true };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(`pwd-reset:${email}`, code, 300);

    await this.emailService.send(
      user.email,
      'Password Reset Code',
      `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`,
    );

    return { ok: true };
  }

  async exportUserData(userId: string) {
    const startedAt = Date.now();
    const [user, submissions, notifications] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, account: true, name: true, role: true, email: true, phone: true,
          createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.submission.findMany({
        where: { studentId: userId },
        select: {
          id: true, status: true, totalScore: true, createdAt: true, updatedAt: true,
          homework: { select: { title: true } },
          teacherComment: true, manualScore: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, type: true, title: true, body: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    this.logger.debug(
      `User data exported userId=${userId} submissions=${submissions.length} notifications=${notifications.length} durationMs=${Date.now() - startedAt}`,
    );

    return { user, submissions, notifications, exportedAt: new Date().toISOString() };
  }

  async resetPasswordWithCode(email: string, code: string, newPassword: string) {
    const startedAt = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    const storedCode = await this.redis.get(`pwd-reset:${normalizedEmail}`);
    if (!storedCode || storedCode !== normalizedCode) {
      throw new BadRequestException('Invalid or expired code');
    }

    const user = await this.prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await Promise.all([
      this.redis.del(`pwd-reset:${normalizedEmail}`),
      this.clearUserAuthCache(user.id),
    ]);

    await this.audit.log({
      action: 'PASSWORD_RESET',
      userId: user.id,
      detail: 'Password reset via email code',
    });

    this.logger.debug(
      `Password reset via code userId=${user.id} durationMs=${Date.now() - startedAt}`,
    );

    return { ok: true };
  }

  private async clearUserAuthCache(userId: string) {
    await this.redis.del(`user:auth:${userId}`).catch(() => {});
  }
}
