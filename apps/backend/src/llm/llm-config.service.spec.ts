import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmConfigService } from './llm-config.service';
import { SystemConfigService } from '../system-config/system-config.service';

describe('LlmConfigService', () => {
  let service: LlmConfigService;
  let configService: any;
  let systemConfigService: any;

  const envDefaults: Record<string, string> = {
    LLM_BASE_URL: 'http://llm:8080',
    LLM_API_KEY: 'test-key',
    LLM_MODEL: 'gpt-4',
    LLM_MODEL_CHEAPER: 'gpt-3.5',
    LLM_MODEL_QUALITY: 'gpt-4-turbo',
    LLM_PROVIDER_NAME: 'openai',
    LLM_MAX_TOKENS: '1000',
    LLM_TEMPERATURE: '0.3',
    LLM_TIMEOUT_MS: '30000',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => envDefaults[key] || undefined),
    };

    systemConfigService = {
      getValue: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmConfigService,
        { provide: ConfigService, useValue: configService },
        { provide: SystemConfigService, useValue: systemConfigService },
      ],
    }).compile();

    service = module.get<LlmConfigService>(LlmConfigService);
  });

  // ─── getDefaults ───

  describe('getDefaults', () => {
    it('should return env defaults when no overrides stored', async () => {
      const result = await service.getDefaults();

      expect(result.baseUrl).toBe('http://llm:8080');
      expect(result.apiKey).toBe('test-key');
      expect(result.model).toBe('gpt-4');
      expect(result.providerName).toBe('openai');
      expect(result.maxTokens).toBe(1000);
      expect(result.temperature).toBe(0.3);
      expect(result.timeoutMs).toBe(30000);
    });

    it('should prefer stored overrides', async () => {
      systemConfigService.getValue.mockResolvedValue({
        baseUrl: 'http://custom:9090',
        model: 'claude-3',
        maxTokens: 2000,
        temperature: 0.5,
      });

      const result = await service.getDefaults();

      expect(result.baseUrl).toBe('http://custom:9090');
      expect(result.model).toBe('claude-3');
      expect(result.maxTokens).toBe(2000);
      expect(result.temperature).toBe(0.5);
    });

    it('should handle whitespace-only overrides by falling back to env', async () => {
      systemConfigService.getValue.mockResolvedValue({
        baseUrl: '   ',
        model: '',
      });

      const result = await service.getDefaults();

      expect(result.baseUrl).toBe('http://llm:8080');
      expect(result.model).toBe('gpt-4');
    });

    it('should fallback to LLM_PROVIDER env when LLM_PROVIDER_NAME missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'LLM_PROVIDER_NAME') return undefined;
        if (key === 'LLM_PROVIDER') return 'azure';
        return envDefaults[key];
      });

      const result = await service.getDefaults();

      expect(result.providerName).toBe('azure');
    });
  });

  // ─── getProviders ───

  describe('getProviders', () => {
    it('should return stored providers when available', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llmProviders') {
          return Promise.resolve([
            { id: 'p1', name: 'Provider 1', baseUrl: 'http://p1', enabled: true },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.getProviders();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });

    it('should create default provider from env when no stored providers', async () => {
      const result = await service.getProviders();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
      expect(result[0].baseUrl).toBe('http://llm:8080');
    });

    it('should return empty when no providers and no baseUrl', async () => {
      configService.get.mockReturnValue(undefined);

      const result = await service.getProviders();

      expect(result).toEqual([]);
    });

    it('should filter out disabled providers', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llmProviders') {
          return Promise.resolve([
            { id: 'p1', name: 'Active', baseUrl: 'http://p1', enabled: true },
            { id: 'p2', name: 'Disabled', baseUrl: 'http://p2', enabled: false },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.getProviders();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
  });

  // ─── resolveRuntimeConfig ───

  describe('resolveRuntimeConfig', () => {
    it('should resolve runtime config from defaults', async () => {
      const result = await service.resolveRuntimeConfig();

      expect(result.providerName).toBe('openai');
      expect(result.baseUrl).toBe('http://llm:8080');
      expect(result.apiKey).toBe('test-key');
      expect(result.model).toBe('gpt-4');
    });

    it('should use active provider when configured', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llm') return Promise.resolve({ activeProviderId: 'p2' });
        if (key === 'llmProviders') {
          return Promise.resolve([
            { id: 'p1', name: 'P1', baseUrl: 'http://p1', enabled: true },
            { id: 'p2', name: 'P2', baseUrl: 'http://p2', apiKey: 'key2', enabled: true },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.providerId).toBe('p2');
      expect(result.providerName).toBe('P2');
      expect(result.baseUrl).toBe('http://p2');
    });

    it('should fall back to first provider when activeProviderId not found', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llm') return Promise.resolve({ activeProviderId: 'nonexistent' });
        if (key === 'llmProviders') {
          return Promise.resolve([
            { id: 'p1', name: 'First', baseUrl: 'http://p1', enabled: true },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.providerId).toBe('p1');
    });
  });

  // ─── resolveRuntimeConfigForProvider ───

  describe('resolveRuntimeConfigForProvider', () => {
    it('should resolve config for a specific provider', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llmProviders') {
          return Promise.resolve([
            { id: 'p1', name: 'P1', baseUrl: 'http://p1', enabled: true, models: [{ name: 'model-a', isDefault: true }] },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfigForProvider('p1');

      expect(result.providerId).toBe('p1');
    });

    it('should apply overrides', async () => {
      const result = await service.resolveRuntimeConfigForProvider(undefined, {
        model: 'override-model',
        temperature: 0.9,
      });

      expect(result.model).toBe('override-model');
      expect(result.temperature).toBe(0.9);
    });

    it('should strip undefined overrides', async () => {
      const result = await service.resolveRuntimeConfigForProvider(undefined, {
        model: undefined,
      });

      expect(result.model).toBe('gpt-4');
    });
  });

  // ─── resolveProviderById ───

  describe('resolveProviderById', () => {
    it('should find provider by id', () => {
      const providers = [
        { id: 'p1', name: 'P1', baseUrl: 'http://p1' },
        { id: 'p2', name: 'P2', baseUrl: 'http://p2' },
      ];

      expect(service.resolveProviderById(providers, 'p2')?.id).toBe('p2');
    });

    it('should return undefined when no providerId given', () => {
      expect(service.resolveProviderById([], undefined)).toBeUndefined();
    });

    it('should return undefined when provider not found', () => {
      expect(service.resolveProviderById([{ id: 'p1', name: 'P1', baseUrl: '' }], 'missing')).toBeUndefined();
    });
  });

  // ─── buildHeaders / buildPriceMap / normalizeStop ───

  describe('runtime config details', () => {
    it('should build headers from provider config', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llmProviders') {
          return Promise.resolve([
            {
              id: 'p1', name: 'P1', baseUrl: 'http://p1', enabled: true,
              headers: [
                { key: 'X-Custom', value: 'val1' },
                { key: '  ', value: 'empty-key' },
              ],
            },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.headers).toEqual({ 'X-Custom': 'val1' });
    });

    it('should build price map from models', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llmProviders') {
          return Promise.resolve([
            {
              id: 'p1', name: 'P1', baseUrl: 'http://p1', enabled: true,
              models: [
                { name: 'gpt-4', priceIn: 0.03, priceOut: 0.06 },
                { name: '', priceIn: 1 },
              ],
            },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.prices).toEqual({ 'gpt-4': { priceIn: 0.03, priceOut: 0.06 } });
    });

    it('should normalize stop as array', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llm') return Promise.resolve({ stop: ['<|end|>', '<|stop|>'] });
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.stop).toEqual(['<|end|>', '<|stop|>']);
    });

    it('should normalize stop as single string', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llm') return Promise.resolve({ stop: '<|end|>' });
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.stop).toEqual(['<|end|>']);
    });

    it('should return undefined stop for empty array', async () => {
      systemConfigService.getValue.mockImplementation((key: string) => {
        if (key === 'llm') return Promise.resolve({ stop: ['  ', ''] });
        return Promise.resolve(null);
      });

      const result = await service.resolveRuntimeConfig();

      expect(result.stop).toBeUndefined();
    });
  });
});
