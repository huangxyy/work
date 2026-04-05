import { Test, TestingModule } from '@nestjs/testing';
import { PublicService } from './public.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { LlmConfigService } from '../llm/llm-config.service';

describe('PublicService', () => {
  let service: PublicService;
  let prisma: any;
  let systemConfig: any;
  let llmConfig: any;

  beforeEach(async () => {
    prisma = {
      homework: { count: jest.fn().mockResolvedValue(10) },
      submission: { count: jest.fn().mockResolvedValue(50) },
    };

    systemConfig = {
      getValue: jest.fn().mockResolvedValue(null),
      setValue: jest.fn().mockResolvedValue(undefined),
    };

    llmConfig = {
      resolveRuntimeConfig: jest.fn().mockResolvedValue({
        baseUrl: '',
        model: '',
        providerName: 'llm',
        headers: {},
        prices: {},
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemConfigService, useValue: systemConfig },
        { provide: LlmConfigService, useValue: llmConfig },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  // ─── getOverview ───

  describe('getOverview', () => {
    it('should return overview stats with default 7 days', async () => {
      prisma.homework.count.mockResolvedValue(10);
      prisma.submission.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40);

      const result = await service.getOverview({});

      expect(result.days).toBe(7);
      expect(result.homeworks).toBe(10);
      expect(result.submissions).toBe(50);
      expect(result.completionRate).toBe(0.8);
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle zero submissions', async () => {
      prisma.homework.count.mockResolvedValue(0);
      prisma.submission.count.mockResolvedValue(0);

      const result = await service.getOverview({ days: 30 });

      expect(result.completionRate).toBe(0);
      expect(result.days).toBe(30);
    });
  });

  // ─── getLanding ───

  describe('getLanding', () => {
    it('should return cached landing when fresh', async () => {
      const cached = {
        version: 1,
        generatedAt: new Date().toISOString(),
        ttlSeconds: 21600,
        theme: {},
        content: { zh: {}, en: {} },
      };
      systemConfig.getValue.mockResolvedValue(cached);

      const result = await service.getLanding({});

      expect(result).toBe(cached);
      expect(systemConfig.setValue).not.toHaveBeenCalled();
    });

    it('should regenerate when cache is stale', async () => {
      const stale = {
        version: 1,
        generatedAt: new Date(0).toISOString(),
        ttlSeconds: 21600,
        theme: {},
        content: { zh: {}, en: {} },
      };
      systemConfig.getValue.mockResolvedValue(stale);

      const result = await service.getLanding({});

      expect(result.generatedAt).not.toBe(stale.generatedAt);
      expect(systemConfig.setValue).toHaveBeenCalled();
    });

    it('should regenerate when refresh=true even if cache fresh', async () => {
      const fresh = {
        version: 1,
        generatedAt: new Date().toISOString(),
        ttlSeconds: 21600,
        theme: {},
        content: { zh: {}, en: {} },
      };
      systemConfig.getValue.mockResolvedValue(fresh);

      const result = await service.getLanding({ refresh: true });

      expect(systemConfig.setValue).toHaveBeenCalled();
      expect(result.generatedAt).toBeDefined();
    });

    it('should return default payload when LLM not configured', async () => {
      const result = await service.getLanding({});

      expect(result.version).toBe(1);
      expect(result.content.zh.brand.title).toBe('作业AI');
      expect(result.content.en.brand.title).toBe('Homework AI');
    });

    it('should return default payload when LLM resolution fails', async () => {
      llmConfig.resolveRuntimeConfig.mockRejectedValue(new Error('LLM error'));

      const result = await service.getLanding({});

      expect(result.version).toBe(1);
    });

    it('should handle invalid generatedAt in cache', async () => {
      const invalid = {
        version: 1,
        generatedAt: 'invalid-date',
        ttlSeconds: 21600,
        theme: {},
        content: { zh: {}, en: {} },
      };
      systemConfig.getValue.mockResolvedValue(invalid);

      const result = await service.getLanding({});

      // Should regenerate because isLandingFresh returns false
      expect(systemConfig.setValue).toHaveBeenCalled();
    });
  });

  // ─── CSS safety ───

  describe('isSafeCssValue (via mergeTheme)', () => {
    it('should block dangerous CSS values in LLM-generated theme', async () => {
      // Mock fetch to return a response with dangerous CSS values
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                theme: {
                  background: 'url(javascript:alert(1))',
                  surface: 'expression(alert(1))',
                  text: '@import evil.css',
                  accent: 'safe-color-value',
                  noiseOpacity: 0.15,
                },
              }),
            },
          }],
        }),
      } as Response);

      llmConfig.resolveRuntimeConfig.mockResolvedValue({
        baseUrl: 'https://api.example.com',
        model: 'gpt-4',
        providerName: 'openai',
        headers: {},
        prices: {},
        apiKey: 'key',
        timeoutMs: 5000,
      });

      const result = await service.getLanding({ refresh: true });

      // Dangerous CSS values should be blocked, safe values should pass
      expect(result.theme.background).not.toContain('url(');
      expect(result.theme.surface).not.toContain('expression');
      expect(result.theme.text).not.toContain('@import');
      // Safe value should be preserved
      expect(result.theme.accent).toBe('safe-color-value');
      expect(result.theme.noiseOpacity).toBe(0.15);

      mockFetch.mockRestore();
    });
  });

  // ─── SSRF protection ───

  describe('assertNotInternalUrl (via resolveLlmApiUrl)', () => {
    it('should throw for localhost URLs', async () => {
      llmConfig.resolveRuntimeConfig.mockResolvedValue({
        baseUrl: 'http://localhost:8080',
        model: 'gpt-4',
        providerName: 'test',
        headers: {},
        prices: {},
        apiKey: 'key',
        timeoutMs: 5000,
      });

      await expect(service.getLanding({ refresh: true })).rejects.toThrow(
        'LLM URL pointing to localhost is not allowed',
      );
    });

    it('should throw for private network IPs', async () => {
      llmConfig.resolveRuntimeConfig.mockResolvedValue({
        baseUrl: 'http://192.168.1.1:8080',
        model: 'gpt-4',
        providerName: 'test',
        headers: {},
        prices: {},
        apiKey: 'key',
        timeoutMs: 5000,
      });

      await expect(service.getLanding({ refresh: true })).rejects.toThrow(
        'LLM URL pointing to private network is not allowed',
      );
    });

    it('should throw for 10.x.x.x IPs', async () => {
      llmConfig.resolveRuntimeConfig.mockResolvedValue({
        baseUrl: 'http://10.0.0.1:8080',
        model: 'gpt-4',
        providerName: 'test',
        headers: {},
        prices: {},
        apiKey: 'key',
        timeoutMs: 5000,
      });

      await expect(service.getLanding({ refresh: true })).rejects.toThrow(
        'LLM URL pointing to private network is not allowed',
      );
    });
  });

  // ─── extractLlmContent / tryParseJson / isResponseFormatUnsupported ───

  describe('helper methods coverage', () => {
    it('should handle missing LLM content gracefully', async () => {
      // When LLM returns no baseUrl/model, falls back to default
      const result = await service.getLanding({ refresh: true });

      expect(result.theme).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  // ─── mergeList ───

  describe('merge behavior', () => {
    it('should return default content when no LLM override', async () => {
      const result = await service.getLanding({});

      expect(result.content.zh.highlights).toHaveLength(3);
      expect(result.content.en.highlights).toHaveLength(3);
    });
  });
});
