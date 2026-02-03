import { IsOptional, IsString } from 'class-validator';

export class GradingPolicyQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  homeworkId?: string;
}
