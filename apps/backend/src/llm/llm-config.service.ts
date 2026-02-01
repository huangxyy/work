import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemConfigService } from '../system-config/system-config.service';

export type LlmHeader = {
  key: string;
  value: string;
  secret?: boolean;
};

export type LlmModelPricing = {
  name: string;
  priceIn?: number;
  priceOut?: number;
  isDefault?: boolean;
};

export type LlmProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  path?: string;
  apiKey?: string;
  headers?: LlmHeader[];
  models?: LlmModelPricing[];
  enabled?: boolean;
};

export type LlmDefaultsConfig = {
  providerName?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  cheaperModel?: string;
  qualityModel?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  timeoutMs?: number;
  stop?: string[] | string;
  responseFormat?: string;
  systemPrompt?: string;
  activeProviderId?: string;
};

export type LlmRuntimeConfig = {
  providerId?: string;
  providerName: string;
  baseUrl: string;
  path?: string;
  apiKey?: string;
  headers: Record<string, string>;
  model?: string;
  cheaperModel?: string;
  qualityModel?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  timeoutMs?: number;
  stop?: string[];
  responseFormat?: string;
  systemPrompt?: string;
  prices: Record<string, { priceIn?: number; priceOut?: number }>;
};

@Injectable()
export class LlmConfigService {
  constructor(
    private readonly configService: ConfigService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async getDefaults(): Promise<LlmDefaultsConfig> {
    const overrides = (await this.systemConfigService.getValue<LlmDefaultsConfig>('llm')) || {};

    const envBaseUrl = this.configService.get<string>('LLM_BASE_URL') || '';
    const envApiKey = this.configService.get<string>('LLM_API_KEY') || '';
    const envModel = this.configService.get<string>('LLM_MODEL') || '';
    const envCheaperModel = this.configService.get<string>('LLM_MODEL_CHEAPER') || '';
    const envQualityModel = this.configService.get<string>('LLM_MODEL_QUALITY') || '';
    const envProviderName =
      this.configService.get<string>('LLM_PROVIDER_NAME') ||
      this.configService.get<string>('LLM_PROVIDER') ||
      'llm';
    const envMaxTokens = Number(this.configService.get<string>('LLM_MAX_TOKENS') || '800');
    const envTemperature = Number(this.configService.get<string>('LLM_TEMPERATURE') || '0.2');
    const envTimeout = Number(this.configService.get<string>('LLM_TIMEOUT_MS') || '20000');

    return {
      providerName: this.normalizeText(overrides.providerName) || envProviderName,
      baseUrl: this.normalizeText(overrides.baseUrl) || envBaseUrl,
      apiKey: this.normalizeText(overrides.apiKey) || envApiKey || undefined,
      model: this.normalizeText(overrides.model) || envModel,
      cheaperModel: this.normalizeText(overrides.cheaperModel) || envCheaperModel || undefined,
      qualityModel: this.normalizeText(overrides.qualityModel) || envQualityModel || undefined,
      maxTokens: overrides.maxTokens ?? envMaxTokens,
      temperature: overrides.temperature ?? envTemperature,
      topP: overrides.topP,
      presencePenalty: overrides.presencePenalty,
      frequencyPenalty: overrides.frequencyPenalty,
      timeoutMs: overrides.timeoutMs ?? envTimeout,
      stop: overrides.stop,
      responseFormat: overrides.responseFormat,
      systemPrompt: overrides.systemPrompt,
      activeProviderId: this.normalizeText(overrides.activeProviderId) || undefined,
    };
  }

  async getProviders(): Promise<LlmProviderConfig[]> {
    const stored = (await this.systemConfigService.getValue<LlmProviderConfig[]>('llmProviders')) || [];
    const normalized = stored
      .map((provider) => this.normalizeProvider(provider))
      .filter((provider) => provider.id && provider.baseUrl)
      .filter((provider) => provider.enabled !== false);

    if (normalized.length) {
      return normalized;
    }

    const defaults = await this.getDefaults();
    if (!defaults.baseUrl) {
      return [];
    }

    return [
      {
        id: 'default',
        name: defaults.providerName || 'llm',
        baseUrl: defaults.baseUrl,
        apiKey: defaults.apiKey,
        models: defaults.model
          ? [{ name: defaults.model, isDefault: true }]
          : undefined,
        enabled: true,
      },
    ];
  }

  async resolveRuntimeConfig(): Promise<LlmRuntimeConfig> {
    const defaults = await this.getDefaults();
    const providers = await this.getProviders();

    const activeProvider = this.resolveActiveProvider(defaults, providers);
    const providerName = activeProvider?.name || defaults.providerName || 'llm';
    const baseUrl = activeProvider?.baseUrl || defaults.baseUrl || '';
    const apiKey = activeProvider?.apiKey || defaults.apiKey || undefined;
    const headers = this.buildHeaders(activeProvider?.headers || []);
    const model = defaults.model || this.resolveDefaultModel(activeProvider);

    return {
      providerId: activeProvider?.id,
      providerName,
      baseUrl,
      path: activeProvider?.path,
      apiKey,
      headers,
      model,
      cheaperModel: defaults.cheaperModel,
      qualityModel: defaults.qualityModel,
      maxTokens: defaults.maxTokens,
      temperature: defaults.temperature,
      topP: defaults.topP,
      presencePenalty: defaults.presencePenalty,
      frequencyPenalty: defaults.frequencyPenalty,
      timeoutMs: defaults.timeoutMs,
      stop: this.normalizeStop(defaults.stop),
      responseFormat: defaults.responseFormat,
      systemPrompt: defaults.systemPrompt,
      prices: this.buildPriceMap(activeProvider?.models || []),
    };
  }

  async resolveRuntimeConfigForProvider(
    providerId?: string,
    overrides?: Partial<LlmDefaultsConfig>,
  ): Promise<LlmRuntimeConfig> {
    const defaults = await this.getDefaults();
    const mergedDefaults = { ...defaults, ...this.stripUndefined(overrides) };
    const providers = await this.getProviders();

    const selectedProvider = providerId
      ? providers.find((provider) => provider.id === providerId)
      : this.resolveActiveProvider(mergedDefaults, providers);

    const providerName = selectedProvider?.name || mergedDefaults.providerName || 'llm';
    const baseUrl = selectedProvider?.baseUrl || mergedDefaults.baseUrl || '';
    const apiKey = selectedProvider?.apiKey || mergedDefaults.apiKey || undefined;
    const headers = this.buildHeaders(selectedProvider?.headers || []);
    const model = mergedDefaults.model || this.resolveDefaultModel(selectedProvider);

    return {
      providerId: selectedProvider?.id,
      providerName,
      baseUrl,
      path: selectedProvider?.path,
      apiKey,
      headers,
      model,
      cheaperModel: mergedDefaults.cheaperModel,
      qualityModel: mergedDefaults.qualityModel,
      maxTokens: mergedDefaults.maxTokens,
      temperature: mergedDefaults.temperature,
      topP: mergedDefaults.topP,
      presencePenalty: mergedDefaults.presencePenalty,
      frequencyPenalty: mergedDefaults.frequencyPenalty,
      timeoutMs: mergedDefaults.timeoutMs,
      stop: this.normalizeStop(mergedDefaults.stop),
      responseFormat: mergedDefaults.responseFormat,
      systemPrompt: mergedDefaults.systemPrompt,
      prices: this.buildPriceMap(selectedProvider?.models || []),
    };
  }

  resolveProviderById(
    providers: LlmProviderConfig[],
    providerId?: string,
  ): LlmProviderConfig | undefined {
    if (!providerId) {
      return undefined;
    }
    return providers.find((provider) => provider.id === providerId);
  }

  private resolveActiveProvider(
    defaults: LlmDefaultsConfig,
    providers: LlmProviderConfig[],
  ): LlmProviderConfig | undefined {
    if (!providers.length) {
      return undefined;
    }
    if (defaults.activeProviderId) {
      const match = providers.find((provider) => provider.id === defaults.activeProviderId);
      if (match) {
        return match;
      }
    }
    return providers[0];
  }

  private resolveDefaultModel(provider?: LlmProviderConfig): string | undefined {
    if (!provider?.models?.length) {
      return undefined;
    }
    const explicit = provider.models.find((model) => model.isDefault);
    return explicit?.name || provider.models[0]?.name;
  }

  private buildHeaders(headers: LlmHeader[]): Record<string, string> {
    const merged: Record<string, string> = {};
    headers.forEach((header) => {
      const key = this.normalizeText(header.key);
      const value = this.normalizeText(header.value);
      if (key && value) {
        merged[key] = value;
      }
    });
    return merged;
  }

  private buildPriceMap(models: LlmModelPricing[]): Record<string, { priceIn?: number; priceOut?: number }> {
    return models.reduce<Record<string, { priceIn?: number; priceOut?: number }>>((acc, model) => {
      if (!model.name) {
        return acc;
      }
      acc[model.name] = { priceIn: model.priceIn, priceOut: model.priceOut };
      return acc;
    }, {});
  }

  private normalizeProvider(provider: LlmProviderConfig): LlmProviderConfig {
    return {
      ...provider,
      id: this.normalizeText(provider.id),
      name: this.normalizeText(provider.name) || this.normalizeText(provider.id) || 'provider',
      baseUrl: this.normalizeText(provider.baseUrl),
      path: this.normalizeText(provider.path) || undefined,
      apiKey: this.normalizeText(provider.apiKey) || undefined,
      headers: provider.headers || [],
      models: provider.models || [],
      enabled: provider.enabled ?? true,
    };
  }

  private normalizeStop(value?: string[] | string): string[] | undefined {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      const items = value.map((item) => this.normalizeText(item)).filter(Boolean);
      return items.length ? items : undefined;
    }
    const single = this.normalizeText(value);
    return single ? [single] : undefined;
  }

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '';
  }

  private stripUndefined<T extends Record<string, unknown>>(value?: T): Partial<T> {
    if (!value) {
      return {};
    }
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
  }
}
