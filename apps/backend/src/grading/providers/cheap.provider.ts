import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { GradingError } from '../grading.errors';
import { buildUserPrompt } from '../prompts/grading.user.template';
import { resolveGradingAssetPath } from '../utils/asset-path';
import { GradeEssayParams, LlmProvider, ProviderInfo } from './provider.interface';
import { SystemConfigService } from '../../system-config/system-config.service';

type LlmConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  cheaperModel?: string;
  qualityModel?: string;
  providerName?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

@Injectable()
export class CheapProvider implements LlmProvider {
  private readonly logger = new Logger(CheapProvider.name);
  private readonly systemPrompt: string;
  private readonly defaults: LlmConfig;
  private runtimeConfig: LlmConfig;
  private lastConfigSync = 0;
  private readonly configTtlMs = 15000;

  constructor(
    configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    this.defaults = {
      baseUrl: configService.get<string>('LLM_BASE_URL') || '',
      apiKey: configService.get<string>('LLM_API_KEY') || undefined,
      model: configService.get<string>('LLM_MODEL') || '',
      cheaperModel: configService.get<string>('LLM_MODEL_CHEAPER') || undefined,
      qualityModel: configService.get<string>('LLM_MODEL_QUALITY') || undefined,
      providerName:
      configService.get<string>('LLM_PROVIDER_NAME') ||
      configService.get<string>('LLM_PROVIDER') ||
      'llm',
      maxTokens: Number(configService.get<string>('LLM_MAX_TOKENS') || '800'),
      temperature: Number(configService.get<string>('LLM_TEMPERATURE') || '0.2'),
      timeoutMs: Number(configService.get<string>('LLM_TIMEOUT_MS') || '20000'),
    };
    this.runtimeConfig = { ...this.defaults };

    const systemPromptPath = resolveGradingAssetPath('prompts/grading.system.txt');
    this.systemPrompt = readFileSync(systemPromptPath, 'utf-8').trim();
  }

  getProviderInfo(params: GradeEssayParams): ProviderInfo {
    return {
      providerName: this.runtimeConfig.providerName || 'llm',
      model: this.resolveModel(params),
      baseUrl: this.runtimeConfig.baseUrl || '',
    };
  }

  async gradeEssay(params: GradeEssayParams): Promise<string> {
    await this.refreshConfig();
    if (!this.runtimeConfig.baseUrl) {
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

    const payload: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: params.maxTokens ?? this.runtimeConfig.maxTokens ?? 800,
      temperature: params.temperature ?? this.runtimeConfig.temperature ?? 0.2,
    };

    if (params.strictJson) {
      payload.response_format = { type: 'json_object' };
    }
    const apiUrl = this.resolveApiUrl();
    const response = await this.fetchCompletion(apiUrl, payload);
    if (!response.ok && params.strictJson && this.isResponseFormatUnsupported(response.status, response.errorText)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.response_format;
      const fallback = await this.fetchCompletion(apiUrl, fallbackPayload);
      if (!fallback.ok) {
        throw new GradingError(
          'LLM_API_ERROR',
          `LLM API error: ${fallback.status} ${fallback.errorText}`,
        );
      }
      return this.extractContent(fallback.data);
    }

    if (!response.ok) {
      throw new GradingError('LLM_API_ERROR', `LLM API error: ${response.status} ${response.errorText}`);
    }

    return this.extractContent(response.data);
  }

  private extractContent(data: {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  }): string {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (!content) {
      this.logger.warn('LLM response missing content');
      throw new GradingError('LLM_API_ERROR', 'LLM response missing content');
    }

    return content.trim();
  }

  private async fetchCompletion(url: string, payload: Record<string, unknown>) {
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.runtimeConfig.apiKey
          ? { Authorization: `Bearer ${this.runtimeConfig.apiKey}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, errorText, data: null } as const;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
    };
    return { ok: true, status: response.status, errorText: '', data } as const;
  }

  private resolveModel(params: GradeEssayParams): string {
    if (params.model) {
      return params.model;
    }
    if (params.mode === 'quality' && this.runtimeConfig.qualityModel) {
      return this.runtimeConfig.qualityModel;
    }
    if (params.shortMode && this.runtimeConfig.cheaperModel) {
      return this.runtimeConfig.cheaperModel;
    }
    return this.runtimeConfig.model || '';
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
    const base = (this.runtimeConfig.baseUrl || '').replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      return base;
    }
    // Default to OpenAI-compatible chat completions endpoint.
    return `${base}/v1/chat/completions`;
  }

  private isResponseFormatUnsupported(status: number, errorText: string): boolean {
    if (status !== 400 && status !== 422) {
      return false;
    }
    const text = errorText.toLowerCase();
    return text.includes('response_format') || text.includes('json_object') || text.includes('unsupported');
  }

  async refreshConfig() {
    const now = Date.now();
    if (now - this.lastConfigSync < this.configTtlMs) {
      return;
    }
    const overrides = await this.systemConfigService.getValue<LlmConfig>('llm');
    this.runtimeConfig = this.mergeConfig(overrides);
    this.lastConfigSync = now;
  }

  private mergeConfig(overrides: LlmConfig | null): LlmConfig {
    if (!overrides) {
      return { ...this.defaults };
    }
    const merged: LlmConfig = { ...this.defaults, ...overrides };
    merged.baseUrl = this.normalizeText(overrides.baseUrl) || this.defaults.baseUrl;
    merged.model = this.normalizeText(overrides.model) || this.defaults.model;
    merged.cheaperModel = this.normalizeText(overrides.cheaperModel) || this.defaults.cheaperModel;
    merged.qualityModel = this.normalizeText(overrides.qualityModel) || this.defaults.qualityModel;
    merged.providerName = this.normalizeText(overrides.providerName) || this.defaults.providerName;

    if (overrides.apiKey !== undefined) {
      merged.apiKey = this.normalizeText(overrides.apiKey) || undefined;
    }

    return merged;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.runtimeConfig.timeoutMs ?? this.defaults.timeoutMs ?? 20000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
