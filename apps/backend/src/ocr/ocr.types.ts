export interface BaiduOcrConfig {
  apiKey: string;
  secretKey: string;
  tokenCacheTtl?: number;
}

export interface BaiduOcrResponse {
  words_result: Array<{ words: string }>;
  words_result_num: number;
  error_code?: number;
  error_msg?: string;
}

export interface BaiduTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface RecognizeResult {
  text: string;
  confidence?: number;
}

export interface BaiduOcrErrorResponse {
  error_code: number;
  error_msg: string;
}

// Baidu OCR error codes
export enum BaiduOcrErrorCode {
  OK = 0,
  PARAM_ERROR = 1,
  MISSING_PARAM = 2,
  AUTH_TOKEN_EXPIRED = 3,
  AUTH_TOKEN_INVALID = 4,
  API_NOT_FOUND = 5,
  QPS_LIMIT_EXCEEDED = 17,
  QPS_LIMIT_EXCEEDED_MONTH = 18,
  CONCURRENCY_LIMIT_EXCEEDED = 19,
  DAILY_LIMIT_EXCEEDED = 110,
}
