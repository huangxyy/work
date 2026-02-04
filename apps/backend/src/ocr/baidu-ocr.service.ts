import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaiduOcrConfig,
  BaiduOcrResponse,
  BaiduTokenResponse,
  RecognizeResult,
  BaiduOcrErrorCode,
} from './ocr.types';

@Injectable()
export class BaiduOcrService {
  private readonly logger = new Logger(BaiduOcrService.name);
  private readonly defaultApiKey: string;
  private readonly defaultSecretKey: string;
  private readonly defaultTokenCacheTtl: number;

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private readonly OAUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token';
  private readonly OCR_API_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

  constructor(private readonly configService: ConfigService) {
    this.defaultApiKey = this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
    this.defaultSecretKey = this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';
    this.defaultTokenCacheTtl = Number(this.configService.get<string>('BAIDU_OCR_TOKEN_CACHE_TTL') || '2592000'); // 30 days default
  }

  async recognize(imageBuffer: Buffer, config?: Partial<BaiduOcrConfig>): Promise<RecognizeResult> {
    const effectiveConfig = this.resolveConfig(config);

    if (!effectiveConfig.apiKey || !effectiveConfig.secretKey) {
      throw new Error('BAIDU_OCR_API_KEY and BAIDU_OCR_SECRET_KEY must be configured');
    }

    const accessToken = await this.getAccessToken(effectiveConfig);

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    const formData = new URLSearchParams();
    formData.append('image', base64Image);

    const response = await this.callWithRetry(
      `${this.OCR_API_URL}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      },
    );

    const data = (await response.json()) as BaiduOcrResponse;

    if (data.error_code) {
      this.handleOcrError(data.error_code, data.error_msg);
    }

    const text = data.words_result?.map((item) => item.words).join('\n').trim() || '';

    if (!text) {
      throw new Error('OCR returned empty text');
    }

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
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        reason: message,
      };
    }
  }

  private async getAccessToken(config: BaiduOcrConfig): Promise<string> {
    const ttl = config.tokenCacheTtl ?? this.defaultTokenCacheTtl;
    const now = Date.now();

    // Check if cached token is still valid
    if (this.cachedToken && this.tokenExpiresAt > now) {
      return this.cachedToken;
    }

    // Request new token
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.secretKey,
    });

    const response = await fetch(this.OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

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

    // Cache token (use configured TTL or Baidu's expires_in, whichever is smaller)
    const expiresInSeconds = Math.min(data.expires_in, ttl);
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + expiresInSeconds * 1000;

    this.logger.log(`Access token refreshed, expires in ${expiresInSeconds}s`);
    return this.cachedToken;
  }

  private async callWithRetry(
    url: string,
    options: RequestInit,
    retries = 2,
  ): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

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
        }

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
        this.cachedToken = null;
        this.tokenExpiresAt = 0;
        throw new Error(`Invalid token: ${message}`);

      default:
        throw new Error(`OCR error: ${message}`);
    }
  }

  private resolveConfig(config?: Partial<BaiduOcrConfig>): BaiduOcrConfig {
    return {
      apiKey: config?.apiKey?.trim() || this.defaultApiKey,
      secretKey: config?.secretKey?.trim() || this.defaultSecretKey,
      tokenCacheTtl: config?.tokenCacheTtl ?? this.defaultTokenCacheTtl,
    };
  }
}
