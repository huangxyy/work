import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class RetentionRunDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSize?: number;
}
