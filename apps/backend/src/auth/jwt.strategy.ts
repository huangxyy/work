import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly redis: RedisService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET')?.trim();
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: { sub: string; jti?: string; exp?: number }): Promise<AuthUser> {
    if (payload.jti) {
      const revoked = await this.authService.isTokenRevoked(payload.jti);
      if (revoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // Check Redis cache first (60 second TTL)
    const cacheKey = `user:auth:${payload.sub}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const user = JSON.parse(cached);
        if (user.isActive === false) {
          throw new UnauthorizedException('Account is disabled');
        }
        return { id: user.id, role: user.role, account: user.account, name: user.name, email: user.email, phone: user.phone };
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, account: true, name: true, isActive: true, email: true, phone: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.redis.set(cacheKey, JSON.stringify(user), 60).catch(() => {});

    return {
      id: user.id,
      role: user.role,
      account: user.account,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  }
}
