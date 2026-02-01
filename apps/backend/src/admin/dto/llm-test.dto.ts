import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class LlmTestDto {
  @IsOptional()
  @IsString()
  providerId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

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
  @IsString()
  responseFormat?: string;

  @IsOptional()
  @IsString({ each: true })
  stop?: string[];
}
