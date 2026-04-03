import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

/**
 * 错误的请求错误 (400)
 * @description 用于客户端请求参数错误或不完整的场景
 *
 * @example
 * ```typescript
 * throw new BadRequestError('Username is required');
 * throw new BadRequestError('Invalid input', 'INVALID_INPUT');
 * ```
 */
export class BadRequestError extends BaseAppError {
  /**
   * 创建错误请求错误
   * @param message - 错误消息
   * @param errorCode - 业务错误码，默认 'BAD_REQUEST'
   */
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.BAD_REQUEST, errorCode || 'BAD_REQUEST');
  }
}
