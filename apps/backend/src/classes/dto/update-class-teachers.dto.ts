import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateClassTeachersDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teacherIds: string[];
}
