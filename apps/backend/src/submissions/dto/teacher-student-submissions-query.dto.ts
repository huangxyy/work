import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class TeacherStudentSubmissionsQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'classId must be a valid CUID' })
  classId!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  })
  @IsString()
  @MaxLength(10)
  lang?: string;
}
