import { IsEnum, IsOptional } from 'class-validator';

export enum GradingMode {
  CHEAP = 'cheap',
  QUALITY = 'quality',
}

export class GradingPreferenceDto {
  @IsEnum(GradingMode)
  @IsOptional()
  mode?: GradingMode;
}

export class GradingPreferenceResponseDto {
  mode: GradingMode | null;
}
