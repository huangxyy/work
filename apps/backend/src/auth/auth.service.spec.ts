import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

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

    authService = new AuthService(prismaService, jwtService);
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
      const disabledUser = { ...mockUser, isActive: false };
      prismaService.user.findUnique = jest.fn().mockResolvedValue(disabledUser);

      await expect(
        authService.login({
          account: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow(ForbiddenException);
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
  });
});
