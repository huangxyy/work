import { IsOptional, IsString } from 'class-validator';

export class CreateDemoJobDto {
  @IsOptional()
  @IsString()
  message?: string;
}