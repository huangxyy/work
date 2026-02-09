import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(255)
  account: string;

  @IsString()
  @MaxLength(1000)
  password: string;
}