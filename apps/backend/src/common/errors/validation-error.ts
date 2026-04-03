import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

/**
 * 验证字段信息
 */
export interface ValidationField {
  /** 字段名 */
  field: string;
  /** 错误消息 */
  message: string;
}

/**
 * 数据验证错误 (400)
 * @description 用于请求数据验证失败的场景，支持字段级别的错误信息
 *
 * @example
 * ```typescript
 * throw new ValidationError('Validation failed', [
 *   { field: 'email', message: 'Invalid email format' },
 *   { field: 'password', message: 'Password too short' }
 * ]);
 * ```
 */
export class ValidationError extends BaseAppError {
  /**
   * 创建数据验证错误
   * @param message - 错误消息
   * @param fields - 字段级别的错误信息数组
   */
  constructor(message: string, public readonly fields?: ValidationField[]) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR');
  }

  /**
   * 转换为 JSON 格式，包含字段错误信息
   * @returns 错误响应对象
   */
  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      ...(this.fields && { fields: this.fields }),
    };
  }
}
