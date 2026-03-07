import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, Matches } from 'class-validator';

export class BulkDisableUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @Matches(/^c[a-z0-9]{24}$/, {
    each: true,
    message: 'Each userId must be a valid CUID',
  })
  userIds!: string[];
}
