import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AccountLockoutService } from './account-lockout.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const jwtSecret = config.get<string>('JWT_SECRET')?.trim();
        if (!jwtSecret) {
          throw new Error('JWT_SECRET must be configured');
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AccountLockoutService,
    TokenBlacklistService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
