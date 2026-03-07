import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BulkImportUsersDto {
  @IsString()
  @MaxLength(200000)
  text!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'classId must be a valid CUID' })
  classId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one digit',
  })
  defaultPassword?: string;
}
