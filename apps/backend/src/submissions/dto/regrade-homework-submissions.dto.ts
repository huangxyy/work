import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class RegradeHomeworkSubmissionsDto {
  @IsString()
  homeworkId: string;

  @IsOptional()
  @IsIn(['cheap', 'quality'])
  mode?: 'cheap' | 'quality';

  @IsOptional()
  @IsBoolean()
  needRewrite?: boolean;
}
