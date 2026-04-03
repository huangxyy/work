import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

/**
 * 资源未找到错误 (404)
 * @description 用于请求的资源不存在的场景
 *
 * @example
 * ```typescript
 * throw new NotFoundError('User not found');
 * throw new NotFoundError('Homework not found', 'HOMEWORK_NOT_FOUND');
 * ```
 */
export class NotFoundError extends BaseAppError {
  /**
   * 创建资源未找到错误
   * @param message - 错误消息
   * @param errorCode - 业务错误码，默认 'NOT_FOUND'
   */
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.NOT_FOUND, errorCode || 'NOT_FOUND');
  }
}
