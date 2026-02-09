import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  Max,
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
  @Min(1)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(120000)
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
  apiKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;
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
