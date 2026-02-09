import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateHomeworkLateSubmissionDto {
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  @IsBoolean()
  allowLateSubmission: boolean;
}
