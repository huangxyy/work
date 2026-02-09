import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSubmissionDto {
  @IsString()
  homeworkId: string;

  @IsOptional()
  @IsIn(['cheap', 'quality'])
  mode?: 'cheap' | 'quality';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  @IsBoolean()
  needRewrite?: boolean;
}
