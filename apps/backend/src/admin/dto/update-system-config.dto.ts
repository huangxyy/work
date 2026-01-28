import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class LlmConfigDto {
  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  cheaperModel?: string;

  @IsOptional()
  @IsString()
  qualityModel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  timeoutMs?: number;
}

export class OcrConfigDto {
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  timeoutMs?: number;
}

export class BudgetConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dailyCallLimit?: number;

  @IsOptional()
  @IsIn(['soft', 'hard'])
  mode?: 'soft' | 'hard';
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LlmConfigDto)
  llm?: LlmConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OcrConfigDto)
  ocr?: OcrConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetConfigDto)
  budget?: BudgetConfigDto;
}
