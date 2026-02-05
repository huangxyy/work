import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { GradingError } from '../grading.errors';
import { buildUserPrompt } from '../prompts/grading.user.template';
import { resolveGradingAssetPath } from '../utils/asset-path';
import { GradeEssayParams, LlmProvider, ProviderInfo } from './provider.interface';
import { LlmConfigService, type LlmRuntimeConfig } from '../../llm/llm-config.service';
import { LlmLogsService } from '../../llm/llm-logs.service';

@Injectable()
export class CheapProvider implements LlmProvider {
  private readonly logger = new Logger(CheapProvider.name);
  private readonly systemPrompt: string;
  private runtimeConfig: LlmRuntimeConfig;
  private lastConfigSync = 0;
  private readonly configTtlMs = 15000;

  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly llmLogsService: LlmLogsService,
  ) {
    this.runtimeConfig = {
      providerName: 'llm',
      baseUrl: '',
      headers: {},
      prices: {},
    };

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

    const topP = params.topP ?? this.runtimeConfig.topP;
    const presencePenalty = params.presencePenalty ?? this.runtimeConfig.presencePenalty;
    const frequencyPenalty = params.frequencyPenalty ?? this.runtimeConfig.frequencyPenalty;
    const stop = params.stop ?? this.runtimeConfig.stop;

    if (typeof topP === 'number') {
      payload.top_p = topP;
    }
    if (typeof presencePenalty === 'number') {
      payload.presence_penalty = presencePenalty;
    }
    if (typeof frequencyPenalty === 'number') {
      payload.frequency_penalty = frequencyPenalty;
    }
    if (stop?.length) {
      payload.stop = stop;
    }

    const responseFormat = params.strictJson
      ? 'json_object'
      : params.responseFormat ?? this.runtimeConfig.responseFormat;
    if (responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }
    const apiUrl = this.resolveApiUrl();
    const startedAt = Date.now();
    let response = await this.fetchCompletion(apiUrl, payload);
    let usedFallback = false;
    if (!response.ok && params.strictJson && this.isResponseFormatUnsupported(response.status, response.errorText)) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.response_format;
      response = await this.fetchCompletion(apiUrl, fallbackPayload);
      usedFallback = true;
    }

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      await this.logCall({
        status: 'ERROR',
        latencyMs,
        model,
        prompt: userPrompt,
        systemPrompt,
        error: `LLM API error: ${response.status} ${response.errorText}`,
        meta: { usedFallback },
      });
      throw new GradingError('LLM_API_ERROR', `LLM API error: ${response.status} ${response.errorText}`);
    }

    const content = this.extractContent(response.data);
    const usage = this.extractUsage(response.data);
    const cost = this.computeCost(model, usage?.promptTokens, usage?.completionTokens);
    await this.logCall({
      status: 'OK',
      latencyMs,
      model,
      prompt: userPrompt,
      systemPrompt,
      response: content,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      cost,
      meta: { usedFallback },
    });

    return content;
  }

  private extractContent(data: {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  } | null): string {
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (!content) {
      this.logger.warn('LLM response missing content');
      throw new GradingError('LLM_API_ERROR', 'LLM response missing content');
    }

    return content.trim();
  }

  private async fetchCompletion(url: string, payload: Record<string, unknown>) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.runtimeConfig.headers,
    };
    if (this.runtimeConfig.apiKey) {
      headers.Authorization = `Bearer ${this.runtimeConfig.apiKey}`;
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, errorText: text, data: null } as const;
    }

    let data: {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    } | null = null;
    try {
      data = text ? (JSON.parse(text) as typeof data) : null;
    } catch {
      data = null;
    }
    return { ok: true, status: response.status, errorText: '', data, rawText: text } as const;
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
    const base = params.systemPrompt || this.runtimeConfig.systemPrompt || this.systemPrompt;
    return [base, ...extra].filter(Boolean).join('\n');
  }

  private resolveApiUrl(): string {
    const base = (this.runtimeConfig.baseUrl || '').replace(/\/$/, '');
    if (base.endsWith('/chat/completions') || base.endsWith('/v1/chat/completions')) {
      return base;
    }
    const customPath = this.normalizeText(this.runtimeConfig.path || '');
    if (customPath) {
      if (customPath.startsWith('http://') || customPath.startsWith('https://')) {
        return customPath;
      }
      return `${base}${customPath.startsWith('/') ? '' : '/'}${customPath}`;
    }
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
    this.runtimeConfig = await this.llmConfigService.resolveRuntimeConfig();
    this.lastConfigSync = now;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.runtimeConfig.timeoutMs ?? 20000;
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

  private extractUsage(data: {
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } | null) {
    if (!data?.usage) {
      return null;
    }
    return {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    };
  }

  private computeCost(model: string, promptTokens?: number, completionTokens?: number) {
    const prices = this.runtimeConfig.prices[model];
    if (!prices || (!promptTokens && !completionTokens)) {
      return undefined;
    }
    const inCost = prices.priceIn ? (promptTokens || 0) / 1000 * prices.priceIn : 0;
    const outCost = prices.priceOut ? (completionTokens || 0) / 1000 * prices.priceOut : 0;
    const total = inCost + outCost;
    return Number.isFinite(total) ? total : undefined;
  }

  private async logCall(input: {
    status: string;
    latencyMs?: number;
    model?: string;
    prompt?: string;
    systemPrompt?: string;
    response?: string;
    error?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
    meta?: Prisma.InputJsonValue;
  }) {
    try {
      await this.llmLogsService.logCall({
        source: 'grading',
        providerId: this.runtimeConfig.providerId,
        providerName: this.runtimeConfig.providerName,
        model: input.model,
        status: input.status,
        latencyMs: input.latencyMs,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        cost: input.cost,
        prompt: this.trimText(input.prompt),
        systemPrompt: this.trimText(input.systemPrompt),
        response: this.trimText(input.response),
        error: this.trimText(input.error),
        meta: input.meta,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown log error';
      this.logger.warn(`Failed to log LLM call: ${message}`);
    }
  }

  private trimText(value?: string, limit = 20000) {
    if (!value) {
      return undefined;
    }
    return value.length > limit ? value.slice(0, limit) : value;
  }
}
