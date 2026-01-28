import { IsString } from 'class-validator';

export class ListHomeworkSubmissionsQueryDto {
  @IsString()
  homeworkId: string;
}
