import { IsOptional, IsString } from 'class-validator';

export class ExportHomeworkPrintQueryDto {
  @IsString()
  homeworkId: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  submissionIds?: string;
}
