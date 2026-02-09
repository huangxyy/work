import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateBatchSubmissionsDto {
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
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  mappingOverrides?: string;

  @IsOptional()
  @IsString()
  nameOverrides?: string;

  @IsOptional()
  @IsString()
  excludedFileKeys?: string;
}
