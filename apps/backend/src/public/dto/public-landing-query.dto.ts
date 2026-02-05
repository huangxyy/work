import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class PublicLandingQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  refresh?: boolean;
}
