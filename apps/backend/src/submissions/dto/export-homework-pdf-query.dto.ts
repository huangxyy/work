import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ExportHomeworkPdfQueryDto {
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'homeworkId must be a valid CUID' })
  homeworkId!: string;

  @Transform(({ value }) => {
    const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
    const ids = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return ids;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @Matches(/^c[a-z0-9]{24}$/, { each: true, message: 'Each submissionId must be a valid CUID' })
  submissionIds!: string[];

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
