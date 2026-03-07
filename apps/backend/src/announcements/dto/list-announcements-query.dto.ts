import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ListAnnouncementsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  })
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'classId must be a valid CUID' })
  classId?: string;
}
