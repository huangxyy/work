import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFeatureFlagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  flag!: string;

  @IsBoolean()
  enabled!: boolean;
}
