import { IsOptional, IsBoolean } from 'class-validator';

export class ValidateConfigDto {
  @IsOptional()
  @IsBoolean()
  fix?: boolean;
}
