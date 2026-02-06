import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: User) {
    const safe = { ...user } as Omit<User, 'passwordHash'> & { passwordHash?: string };
    delete safe.passwordHash;
    return safe;
  }

  private signToken(user: User) {
    return this.jwtService.sign({
      sub: user.id,
      role: user.role,
      account: user.account,
      name: user.name,
    });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { account: dto.account },
    });

    if (existing) {
      throw new BadRequestException('Account already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
        data: {
          account: dto.account,
          name: dto.name,
          role: Role.STUDENT,
          passwordHash,
        },
      });

    const token = this.signToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { account: dto.account },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account is disabled');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(user);
    return { token, user: this.sanitizeUser(user) };
  }
}
