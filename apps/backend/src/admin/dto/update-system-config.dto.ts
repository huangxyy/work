import { Type } from 'class-transformer';
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
  topP?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  presencePenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  frequencyPenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  timeoutMs?: number;

  @IsOptional()
  @IsString({ each: true })
  stop?: string[];

  @IsOptional()
  @IsString()
  responseFormat?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  activeProviderId?: string;
}

export class LlmHeaderDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsBoolean()
  secret?: boolean;
}

export class LlmModelPricingDto {
  @IsString()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceIn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceOut?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class LlmProviderConfigDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LlmHeaderDto)
  headers?: LlmHeaderDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LlmModelPricingDto)
  models?: LlmModelPricingDto[];
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
  @ValidateNested({ each: true })
  @Type(() => LlmProviderConfigDto)
  llmProviders?: LlmProviderConfigDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OcrConfigDto)
  ocr?: OcrConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetConfigDto)
  budget?: BudgetConfigDto;
}
