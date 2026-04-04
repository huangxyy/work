import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import {
  BaiduOcrConfig,
  BaiduOcrResponse,
  BaiduTokenResponse,
  RecognizeResult,
  BaiduOcrErrorCode,
} from './ocr.types';

const REDIS_TOKEN_KEY_PREFIX = 'baidu_ocr_token:';
const REDIS_TOKEN_TTL_SECONDS = 29 * 24 * 60 * 60;

@Injectable()
export class BaiduOcrService {
  private readonly logger = new Logger(BaiduOcrService.name);
  private readonly defaultApiKey: string;
  private readonly defaultSecretKey: string;
  private readonly defaultTokenCacheTtl: number;

  private cachedToken: string | null = null;
  private cachedTokenSignature = '';
  private tokenExpiresAt: number = 0;
  private accessTokenPromise: Promise<string> | null = null;
  private accessTokenPromiseSignature = '';

  private readonly OAUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token';
  private readonly OCR_API_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.defaultApiKey = this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
    this.defaultSecretKey = this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';
    this.defaultTokenCacheTtl = Number(this.configService.get<string>('BAIDU_OCR_TOKEN_CACHE_TTL') || '2592000'); // 30 days default
  }

  async recognize(imageBuffer: Buffer, config?: Partial<BaiduOcrConfig>): Promise<RecognizeResult> {
    const startedAt = Date.now();
    const effectiveConfig = this.resolveConfig(config);

    if (!effectiveConfig.apiKey || !effectiveConfig.secretKey) {
      throw new Error('BAIDU_OCR_API_KEY and BAIDU_OCR_SECRET_KEY must be configured');
    }

    // Convert buffer to base64 once (immutable across retries)
    const base64Image = imageBuffer.toString('base64');

    const formData = new URLSearchParams();
    formData.append('image', base64Image);

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    };

    // Build a URL provider that refreshes the token on each attempt,
    // so auth token errors are automatically recovered by getting a fresh token.
    const getUrl = async () => {
      const accessToken = await this.getAccessToken(effectiveConfig);
      return `${this.OCR_API_URL}?access_token=${accessToken}`;
    };

    const response = await this.callWithRetry(getUrl, requestOptions);

    const data = (await response.json()) as BaiduOcrResponse;

    if (data.error_code) {
      this.handleOcrError(data.error_code, data.error_msg);
    }

    const text = data.words_result?.map((item) => item.words).join('\n').trim() || '';

    if (!text) {
      throw new Error('OCR returned empty text');
    }

    this.logger.debug(
      `OCR recognize completed imageBytes=${imageBuffer.length} textLength=${text.length} durationMs=${Date.now() - startedAt}`,
    );

    return { text };
  }

  async testConnection(config?: Partial<BaiduOcrConfig>): Promise<{ ok: boolean; latencyMs: number; reason?: string }> {
    const startedAt = Date.now();
    const effectiveConfig = this.resolveConfig(config);

    if (!effectiveConfig.apiKey || !effectiveConfig.secretKey) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        reason: 'BAIDU_OCR_API_KEY and BAIDU_OCR_SECRET_KEY must be configured',
      };
    }

    try {
      await this.getAccessToken(effectiveConfig);
      this.logger.debug(`OCR connection test succeeded latencyMs=${Date.now() - startedAt}`);
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`OCR connection test failed latencyMs=${Date.now() - startedAt} reason=${message}`);
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        reason: message,
      };
    }
  }

  private async getAccessToken(config: BaiduOcrConfig): Promise<string> {
    const startedAt = Date.now();
    const ttl = config.tokenCacheTtl ?? this.defaultTokenCacheTtl;
    const now = Date.now();
    const REFRESH_MARGIN_MS = 5 * 60 * 1000;
    const tokenSignature = this.buildTokenSignature(config);
    const redisKey = REDIS_TOKEN_KEY_PREFIX + tokenSignature;

    if (
      this.cachedToken &&
      this.cachedTokenSignature === tokenSignature &&
      this.tokenExpiresAt - REFRESH_MARGIN_MS > now
    ) {
      this.logger.debug(`OCR access token memory cache hit durationMs=${Date.now() - startedAt}`);
      return this.cachedToken;
    }

    try {
      const redisToken = await this.redisService.get(redisKey);
      if (redisToken) {
        this.cachedToken = redisToken;
        this.cachedTokenSignature = tokenSignature;
        this.tokenExpiresAt = now + REDIS_TOKEN_TTL_SECONDS * 1000;
        this.logger.debug(`OCR access token Redis cache hit durationMs=${Date.now() - startedAt}`);
        return redisToken;
      }
    } catch (error) {
      this.logger.warn(`Redis get token failed, falling back to fetch: ${error}`);
    }

    if (this.accessTokenPromise && this.accessTokenPromiseSignature === tokenSignature) {
      const token = await this.accessTokenPromise;
      this.logger.debug(`OCR access token inflight hit durationMs=${Date.now() - startedAt}`);
      return token;
    }

    const requestPromise = (async () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.apiKey,
        client_secret: config.secretKey,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await fetch(this.OAUTH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Access token request timed out (10s)');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as BaiduTokenResponse;

      if (data.error) {
        throw new Error(`Failed to get access token: ${data.error} - ${data.error_description}`);
      }

      if (!data.access_token) {
        throw new Error('Failed to get access token: no access_token in response');
      }

      const expiresInSeconds = Math.min(data.expires_in, ttl);
      const fetchedAt = Date.now();
      this.cachedToken = data.access_token;
      this.cachedTokenSignature = tokenSignature;
      this.tokenExpiresAt = fetchedAt + expiresInSeconds * 1000;

      try {
        await this.redisService.set(redisKey, data.access_token, REDIS_TOKEN_TTL_SECONDS);
        this.logger.debug(`OCR access token saved to Redis key=${redisKey}`);
      } catch (error) {
        this.logger.warn(`Failed to save token to Redis: ${error}`);
      }

      this.logger.log(`Access token refreshed expiresInSeconds=${expiresInSeconds} durationMs=${fetchedAt - startedAt}`);
      return this.cachedToken;
    })().finally(() => {
      if (this.accessTokenPromiseSignature === tokenSignature) {
        this.accessTokenPromise = null;
        this.accessTokenPromiseSignature = '';
      }
    });

    this.accessTokenPromise = requestPromise;
    this.accessTokenPromiseSignature = tokenSignature;
    return requestPromise;
  }

  private async callWithRetry(
    urlOrProvider: string | (() => Promise<string>),
    options: RequestInit,
    retries = 2,
  ): Promise<Response> {
    const startedAt = Date.now();
    for (let i = 0; i <= retries; i++) {
      try {
        // Resolve URL freshly on each attempt so token refresh takes effect
        const url = typeof urlOrProvider === 'function' ? await urlOrProvider() : urlOrProvider;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeout);
        });

        // Handle QPS limit (error code 18)
        if (response.ok) {
          const data = await response.clone().json() as BaiduOcrResponse;
          if (data.error_code === BaiduOcrErrorCode.QPS_LIMIT_EXCEEDED ||
              data.error_code === BaiduOcrErrorCode.QPS_LIMIT_EXCEEDED_MONTH ||
              data.error_code === BaiduOcrErrorCode.CONCURRENCY_LIMIT_EXCEEDED) {
            if (i < retries) {
              const delay = Math.pow(2, i) * 1000; // exponential backoff
              this.logger.warn(`QPS limit exceeded, retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }

          // Handle auth token errors — clear cached token so next retry gets a fresh one
          if (data.error_code === BaiduOcrErrorCode.AUTH_TOKEN_EXPIRED ||
              data.error_code === BaiduOcrErrorCode.AUTH_TOKEN_INVALID) {
            this.clearTokenCache();
            if (i < retries) {
              const delay = Math.pow(2, i) * 500;
              this.logger.warn(`Auth token invalid/expired, clearing cache and retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              // Rebuild URL with fresh token for next attempt
              continue;
            }
          }
        }

        this.logger.debug(
          `OCR request completed attempts=${i + 1} status=${response.status} durationMs=${Date.now() - startedAt}`,
        );

        return response;
      } catch (error) {
        if (i === retries) {
          throw error;
        }
        const delay = Math.pow(2, i) * 1000;
        this.logger.warn(`Request failed, retrying in ${delay}ms: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private handleOcrError(errorCode: number, errorMsg?: string): never {
    const message = errorMsg || `OCR error code: ${errorCode}`;

    switch (errorCode) {
      case BaiduOcrErrorCode.QPS_LIMIT_EXCEEDED:
      case BaiduOcrErrorCode.QPS_LIMIT_EXCEEDED_MONTH:
      case BaiduOcrErrorCode.CONCURRENCY_LIMIT_EXCEEDED:
        throw new Error(`QPS limit exceeded: ${message}`);

      case BaiduOcrErrorCode.DAILY_LIMIT_EXCEEDED:
        throw new Error(`Daily limit exceeded: ${message}`);

      case BaiduOcrErrorCode.AUTH_TOKEN_EXPIRED:
      case BaiduOcrErrorCode.AUTH_TOKEN_INVALID:
        // Clear cached token and retry
        this.clearTokenCache();
        throw new Error(`Invalid token: ${message}`);

      default:
        throw new Error(`OCR error: ${message}`);
    }
  }

  private clearTokenCache() {
    if (this.cachedTokenSignature) {
      const redisKey = REDIS_TOKEN_KEY_PREFIX + this.cachedTokenSignature;
      this.redisService.del(redisKey).catch((error) => {
        this.logger.warn(`Failed to delete token from Redis: ${error}`);
      });
    }
    this.cachedToken = null;
    this.cachedTokenSignature = '';
    this.tokenExpiresAt = 0;
  }

  private buildTokenSignature(config: BaiduOcrConfig): string {
    return JSON.stringify({ apiKey: config.apiKey, secretKey: config.secretKey });
  }

  private resolveConfig(config?: Partial<BaiduOcrConfig>): BaiduOcrConfig {
    return {
      apiKey: config?.apiKey?.trim() || this.defaultApiKey,
      secretKey: config?.secretKey?.trim() || this.defaultSecretKey,
      tokenCacheTtl: config?.tokenCacheTtl ?? this.defaultTokenCacheTtl,
    };
  }
}
