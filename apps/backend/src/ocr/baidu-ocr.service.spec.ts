import { ConfigService } from '@nestjs/config';
import { BaiduOcrService } from './baidu-ocr.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('BaiduOcrService', () => {
  let service: BaiduOcrService;

  const makeConfigService = (overrides: Record<string, string> = {}) => {
    const defaults: Record<string, string> = {
      BAIDU_OCR_API_KEY: 'test-api-key',
      BAIDU_OCR_SECRET_KEY: 'test-secret-key',
      BAIDU_OCR_TOKEN_CACHE_TTL: '2592000',
      ...overrides,
    };
    return {
      get: jest.fn((key: string) => defaults[key] || undefined),
    } as unknown as ConfigService;
  };

  const mockTokenResponse = (token = 'test-token', expiresIn = 2592000) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: token, expires_in: expiresIn }),
    });
  };

  const mockOcrResponse = (words: string[] = ['Hello', 'World']) => {
    const cloneData = {
      words_result: words.map(w => ({ words: w })),
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => cloneData,
      clone: () => ({
        json: async () => cloneData,
      }),
    });
  };

  beforeEach(() => {
    mockFetch.mockReset();
    service = new BaiduOcrService(makeConfigService());
  });

  // ─── recognize ───

  describe('recognize', () => {
    it('should recognize text from image buffer', async () => {
      mockTokenResponse();
      mockOcrResponse(['Hello', 'World']);

      const result = await service.recognize(Buffer.from('fake-image'));

      expect(result.text).toBe('Hello\nWorld');
    });

    it('should throw when API key not configured', async () => {
      service = new BaiduOcrService(makeConfigService({
        BAIDU_OCR_API_KEY: '',
        BAIDU_OCR_SECRET_KEY: '',
      }));

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('BAIDU_OCR_API_KEY and BAIDU_OCR_SECRET_KEY must be configured');
    });

    it('should throw when OCR returns empty text', async () => {
      mockTokenResponse();
      const emptyData = { words_result: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyData,
        clone: () => ({ json: async () => emptyData }),
      });

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('OCR returned empty text');
    });

    it('should throw on OCR error code', async () => {
      mockTokenResponse();
      const errorData = { error_code: 100, error_msg: 'Invalid parameter' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorData,
        clone: () => ({ json: async () => errorData }),
      });

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('OCR error');
    });

    it('should use custom config overrides', async () => {
      mockTokenResponse();
      mockOcrResponse(['Custom']);

      const result = await service.recognize(Buffer.from('img'), {
        apiKey: 'custom-key',
        secretKey: 'custom-secret',
      });

      expect(result.text).toBe('Custom');
    });
  });

  // ─── testConnection ───

  describe('testConnection', () => {
    it('should return ok when token fetch succeeds', async () => {
      mockTokenResponse();

      const result = await service.testConnection();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return not ok when not configured', async () => {
      service = new BaiduOcrService(makeConfigService({
        BAIDU_OCR_API_KEY: '',
        BAIDU_OCR_SECRET_KEY: '',
      }));

      const result = await service.testConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toContain('must be configured');
    });

    it('should return not ok when token fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await service.testConnection();

      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should use custom config for test', async () => {
      mockTokenResponse();

      const result = await service.testConnection({
        apiKey: 'custom',
        secretKey: 'custom',
      });

      expect(result.ok).toBe(true);
    });
  });

  // ─── token caching ───

  describe('token caching', () => {
    it('should cache token on second call', async () => {
      mockTokenResponse('token1');
      mockOcrResponse(['A']);
      mockOcrResponse(['B']);

      await service.recognize(Buffer.from('img1'));
      await service.recognize(Buffer.from('img2'));

      // Token fetch called only once, OCR called twice
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 token + 2 OCR
    });
  });

  // ─── handleOcrError branches ───

  describe('handleOcrError', () => {
    it('should throw QPS limit error', async () => {
      mockTokenResponse();
      const qpsData = { error_code: 17, error_msg: 'QPS limit' };
      // Need to mock multiple calls due to retry
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => qpsData,
        clone: () => ({ json: async () => qpsData }),
      });

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('QPS limit exceeded');
    });

    it('should throw daily limit error', async () => {
      mockFetch.mockReset();
      service = new BaiduOcrService(makeConfigService());
      mockTokenResponse();
      const dailyData = { error_code: 110, error_msg: 'Daily limit' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
        clone: () => ({ json: async () => dailyData }),
      });

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('Daily limit exceeded');
    });

    it('should clear token cache on auth error', async () => {
      mockFetch.mockReset();
      service = new BaiduOcrService(makeConfigService());
      mockTokenResponse('token1');
      const authData = { error_code: 3, error_msg: 'Token expired' };
      // First OCR call returns auth error, retries get fresh token
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => authData,
          clone: () => ({ json: async () => authData }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token2', expires_in: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => authData,
          clone: () => ({ json: async () => authData }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token3', expires_in: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => authData,
          clone: () => ({ json: async () => authData }),
        });

      await expect(
        service.recognize(Buffer.from('img')),
      ).rejects.toThrow('Invalid token');
    });
  });

  // ─── callWithRetry network errors ───

  describe('callWithRetry', () => {
    it('should retry on network errors', async () => {
      service = new BaiduOcrService(makeConfigService());
      mockFetch.mockReset();
      mockTokenResponse('retry-token');
      // First OCR call fails with network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // Retry: token is cached so no new token fetch, just OCR call
      mockOcrResponse(['Retry OK']);

      const result = await service.recognize(Buffer.from('img'));

      expect(result.text).toBe('Retry OK');
    }, 15000);
  });

  // ─── resolveConfig ───

  describe('resolveConfig', () => {
    it('should trim config values', async () => {
      service = new BaiduOcrService(makeConfigService());
      mockFetch.mockReset();
      mockTokenResponse();
      mockOcrResponse(['Trimmed']);

      await service.recognize(Buffer.from('img'), {
        apiKey: '  key  ',
        secretKey: '  secret  ',
      });

      // Should not throw - trimmed values are used
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
