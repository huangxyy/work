import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class HomeworkClassQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/, { message: 'classId must be a valid CUID' })
  classId!: string;
}
