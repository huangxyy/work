import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BulkResetPasswordDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @Matches(/^c[a-z0-9]{24}$/, {
    each: true,
    message: 'Each userId must be a valid CUID',
  })
  userIds!: string[];

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one digit',
  })
  newPassword!: string;
}
