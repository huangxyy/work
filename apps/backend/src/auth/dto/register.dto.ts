import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(255)
  account: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one digit',
  })
  password: string;
}
