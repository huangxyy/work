import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateHomeworkDto {
  @IsString()
  classId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}