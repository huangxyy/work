import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class StudentInputDto {
  @IsString()
  account: string;

  @IsString()
  name: string;
}

export class ImportStudentsDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentInputDto)
  students?: StudentInputDto[];

  @IsOptional()
  @IsString()
  defaultPassword?: string;
}