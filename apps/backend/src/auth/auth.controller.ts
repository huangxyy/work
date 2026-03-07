import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordWithCodeDto } from './dto/reset-password-with-code.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { Request, Response } from 'express';

type AuthRequest = Request & {
  user: {
    id: string;
    role: string;
    account: string;
    name: string;
  };
};

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.ip || 'unknown';
}

function extractJwtPayload(req: Request): { jti?: string; exp?: number } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return { jti: payload.jti, exp: payload.exp };
  } catch {
    return null;
  }
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    return this.authService.register(body, extractIp(req));
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body, extractIp(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: AuthRequest) {
    const ip = extractIp(req);
    const payload = extractJwtPayload(req);
    if (payload?.jti && payload?.exp) {
      const remainingSeconds = Math.max(payload.exp - Math.floor(Date.now() / 1000), 0);
      await this.authService.logout(payload.jti, remainingSeconds, req.user?.id, ip);
    }
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Body() body: UpdateProfileDto, @Req() req: AuthRequest) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: AuthRequest,
  ) {
    return this.authService.changePassword(req.user.id, body.oldPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('export-my-data')
  async exportMyData(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const data = await this.authService.exportUserData(req.user.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${req.user.id}.json"`);
    return data;
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 600000, limit: 3 } })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.sendPasswordResetCode(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 600000, limit: 5 } })
  async resetPassword(@Body() body: ResetPasswordWithCodeDto) {
    return this.authService.resetPasswordWithCode(body.email, body.code, body.newPassword);
  }
}
