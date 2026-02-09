import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateAdminUserDto {
  @IsString()
  account: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsString()
  @MinLength(6)
  password: string;
}
