import { IsDateString, IsOptional, IsString } from 'class-validator';

export class LlmLogsClearDto {
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
