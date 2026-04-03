import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

/**
 * 权限禁止错误 (403)
 * @description 用于用户已认证但无权限访问资源的场景
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('You do not have permission to access this resource');
 * throw new ForbiddenError('Only teachers can perform this action', 'TEACHER_ONLY');
 * ```
 */
export class ForbiddenError extends BaseAppError {
  /**
   * 创建权限禁止错误
   * @param message - 错误消息
   * @param errorCode - 业务错误码，默认 'FORBIDDEN'
   */
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.FORBIDDEN, errorCode || 'FORBIDDEN');
  }
}
