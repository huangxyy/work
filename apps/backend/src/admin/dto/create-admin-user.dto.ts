import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateAdminUserDto {
  @IsString()
  @MaxLength(255)
  account: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsString()
  @MinLength(6)
  @MaxLength(1000)
  password: string;
}
