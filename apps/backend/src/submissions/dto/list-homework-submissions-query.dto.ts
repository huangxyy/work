import { IsOptional, IsString } from 'class-validator';

export class ListHomeworkSubmissionsQueryDto {
  @IsString()
  homeworkId: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
