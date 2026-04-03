import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

/**
 * 资源冲突错误 (409)
 * @description 用于请求与服务器当前状态冲突的场景，如资源已存在
 *
 * @example
 * ```typescript
 * throw new ConflictError('Username already exists');
 * throw new ConflictError('Email already registered', 'EMAIL_EXISTS');
 * ```
 */
export class ConflictError extends BaseAppError {
  /**
   * 创建资源冲突错误
   * @param message - 错误消息
   * @param errorCode - 业务错误码，默认 'CONFLICT'
   */
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.CONFLICT, errorCode || 'CONFLICT');
  }
}
