import { IsString, IsOptional } from 'class-validator';

export class RetrySkippedDto {
  @IsString()
  homeworkId: string;

  @IsString()
  fileKey: string;

  @IsString()
  filename: string;

  @IsString()
  studentName: string;

  @IsString()
  @IsOptional()
  batchId?: string;
}
