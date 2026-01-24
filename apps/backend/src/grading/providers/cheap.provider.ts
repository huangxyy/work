import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { GradingError } from '../grading.errors';
import { buildUserPrompt } from '../prompts/grading.user.template';
import { resolveGradingAssetPath } from '../utils/asset-path';
import { GradeEssayParams, LlmProvider, ProviderInfo } from './provider.interface';

@Injectable()
export class CheapProvider implements LlmProvider {
  private readonly logger = new Logger(CheapProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly cheaperModel?: string;
  private readonly qualityModel?: string;
  private readonly providerName: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;
  private readonly timeoutMs: number;
  private readonly systemPrompt: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>('LLM_BASE_URL') || '';
    this.apiKey = configService.get<string>('LLM_API_KEY') || undefined;
    this.model = configService.get<string>('LLM_MODEL') || '';
    this.cheaperModel = configService.get<string>('LLM_MODEL_CHEAPER') || undefined;
    this.qualityModel = configService.get<string>('LLM_MODEL_QUALITY') || undefined;
    this.providerName =
      configService.get<string>('LLM_PROVIDER_NAME') ||
      configService.get<string>('LLM_PROVIDER') ||
      'llm';
    this.defaultMaxTokens = Number(configService.get<string>('LLM_MAX_TOKENS') || '800');
    this.defaultTemperature = Number(configService.get<string>('LLM_TEMPERATURE') || '0.2');
    this.timeoutMs = Number(configService.get<string>('LLM_TIMEOUT_MS') || '20000');

    const systemPromptPath = resolveGradingAssetPath('prompts/grading.system.txt');
    this.systemPrompt = readFileSync(systemPromptPath, 'utf-8').trim();
  }

  getProviderInfo(params: GradeEssayParams): ProviderInfo {
    return {
      providerName: this.providerName,
      model: this.resolveModel(params),
      baseUrl: this.baseUrl,
    };
  }

  async gradeEssay(params: GradeEssayParams): Promise<string> {
    if (!this.baseUrl) {
      throw new GradingError('LLM_API_ERROR', 'LLM_BASE_URL is not configured');
    }

    const model = this.resolveModel(params);
    if (!model) {
      throw new GradingError('LLM_API_ERROR', 'LLM_MODEL is not configured');
    }

    const systemPrompt = this.buildSystemPrompt(params);
    const userPrompt = buildUserPrompt({
      text: params.text,
      rubric: params.rubric || '',
      needRewrite: Boolean(params.needRewrite),
      shortMode: params.shortMode,
      strictJson: params.strictJson,
      lowOnly: params.lowOnly,
    });

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      temperature: params.temperature ?? this.defaultTemperature,
    };

    const response = await this.fetchWithTimeout(this.resolveApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GradingError('LLM_API_ERROR', `LLM API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
    };
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (!content) {
      this.logger.warn('LLM response missing content');
      throw new GradingError('LLM_API_ERROR', 'LLM response missing content');
    }

    return content.trim();
  }

  private resolveModel(params: GradeEssayParams): string {
    if (params.model) {
      return params.model;
    }
    if (params.mode === 'quality' && this.qualityModel) {
      return this.qualityModel;
    }
    if (params.shortMode && this.cheaperModel) {
      return this.cheaperModel;
    }
    return this.model || '';
  }

  private buildSystemPrompt(params: GradeEssayParams): string {
    const extra: string[] = [];
    if (params.shortMode) {
      extra.push('Short mode: keep output compact and concise.');
    }
    if (params.strictJson) {
      extra.push('Output must be valid JSON only.');
    }
    return [this.systemPrompt, ...extra].filter(Boolean).join('\n');
  }

  private resolveApiUrl(): string {
    const base = this.baseUrl.replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      return base;
    }
    // Default to OpenAI-compatible chat completions endpoint.
    return `${base}/v1/chat/completions`;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GradingError('LLM_TIMEOUT', 'LLM request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
