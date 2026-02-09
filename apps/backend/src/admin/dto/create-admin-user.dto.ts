import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
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
  @MinLength(8)
  @MaxLength(1000)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one digit',
  })
  password: string;
}
