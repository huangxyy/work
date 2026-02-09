import { IsString } from 'class-validator';

export class ListHomeworksQueryDto {
  @IsString()
  classId: string;
}