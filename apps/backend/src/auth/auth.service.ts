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

/**
 * 认证服务
 * @description 处理用户注册、登录、登出、密码重置等认证相关功能
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * 构造函数
   * @param prisma - Prisma 数据库服务
   * @param jwtService - JWT 令牌服务
   * @param audit - 审计日志服务
   * @param lockout - 账户锁定服务
   * @param tokenBlacklist - 令牌黑名单服务
   * @param redis - Redis 缓存服务
   * @param emailService - 邮件发送服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly lockout: AccountLockoutService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 清理用户敏感信息
   * @param user - 原始用户对象
   * @returns 移除密码哈希后的用户对象
   */
  private sanitizeUser(user: User) {
    const safe = { ...user } as Omit<User, 'passwordHash'> & { passwordHash?: string };
    delete safe.passwordHash;
    return safe;
  }

  /**
   * 签发 JWT 令牌
   * @param user - 用户对象
   * @returns JWT 令牌字符串
   */
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

  /**
   * 用户注册
   * @param dto - 注册数据传输对象
   * @param ip - 客户端 IP 地址（可选，用于审计）
   * @returns 包含令牌和用户信息的响应对象
   * @throws {BadRequestException} 当账号已存在时抛出
   */
  async register(dto: RegisterDto, ip?: string) {
    const startedAt = Date.now();
    const account = dto.account.trim();
    const name = dto.name.trim();

    const existing = await this.prisma.user.findUnique({
      where: { account },
    });

    if (existing) {
      throw new BadRequestException('注册失败，请尝试其他账号');
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

  /**
   * 用户登录
   * @param dto - 登录数据传输对象
   * @param ip - 客户端 IP 地址（可选，用于审计）
   * @returns 包含令牌和用户信息的响应对象
   * @throws {BadRequestException} 当账号为空时抛出
   * @throws {ForbiddenException} 当账户被锁定或禁用时抛出
   * @throws {UnauthorizedException} 当账号或密码错误时抛出
   */
  async login(dto: LoginDto, ip?: string) {
    const startedAt = Date.now();
    const account = dto.account.trim();
    if (!account) {
      throw new BadRequestException('账号不能为空');
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
        `账号已被临时锁定，请 ${Math.ceil(lockStatus.remainingSeconds / 60)} 分钟后重试`,
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
          '登录失败次数过多，账号已被临时锁定 15 分钟',
        );
      }
      throw new UnauthorizedException('账号或密码错误');
    }

    if (user.isActive === false) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        userId: user.id,
        ip,
        detail: `Disabled account login attempt: ${user.account}`,
      });
      throw new ForbiddenException('账号已被禁用');
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

  /**
   * 用户登出
   * @param jti - JWT ID，用于将令牌加入黑名单
   * @param expiresInSeconds - 令牌过期时间（秒）
   * @param userId - 用户 ID（可选，用于审计）
   * @param ip - 客户端 IP 地址（可选，用于审计）
   * @returns Promise，在登出完成后解析
   */
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

  /**
   * 检查令牌是否已被撤销
   * @param jti - JWT ID
   * @returns 如果令牌已被撤销返回 true，否则返回 false
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.tokenBlacklist.isRevoked(jti);
  }

  /**
   * 更新用户资料
   * @param userId - 用户 ID
   * @param data - 更新数据传输对象
   * @returns 更新后的用户信息（不含密码）
   */
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

  /**
   * 修改密码
   * @param userId - 用户 ID
   * @param oldPassword - 当前密码
   * @param newPassword - 新密码
   * @returns 操作结果对象
   * @throws {UnauthorizedException} 当用户不存在时抛出
   * @throws {BadRequestException} 当当前密码不正确或新旧密码相同时抛出
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('当前密码不正确');
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
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

  /**
   * 发送密码重置验证码
   * @param emailAddress - 邮箱地址
   * @returns 操作结果对象（无论邮箱是否存在都返回成功，防止枚举攻击）
   * @description 验证码有效期为 5 分钟，存储在 Redis 中
   */
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

  /**
   * 导出用户数据（GDPR 合规）
   * @param userId - 用户 ID
   * @returns 包含用户信息、提交记录和通知的导出数据
   */
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

  /**
   * 使用验证码重置密码
   * @param email - 邮箱地址
   * @param code - 验证码
   * @param newPassword - 新密码
   * @returns 操作结果对象
   * @throws {BadRequestException} 当验证码无效或新旧密码相同时抛出
   */
  async resetPasswordWithCode(email: string, code: string, newPassword: string) {
    const startedAt = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    const storedCode = await this.redis.get(`pwd-reset:${normalizedEmail}`);
    if (!storedCode || storedCode !== normalizedCode) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (!user) throw new BadRequestException('验证码无效或已过期');

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
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
