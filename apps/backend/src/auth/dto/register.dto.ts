import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(255)
  account: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(6)
  @MaxLength(1000)
  password: string;
}
