import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 自定义应用错误基类
 * @description 所有自定义错误应继承此类
 *
 * @example
 * ```typescript
 * throw new BaseAppError('Resource not found', HttpStatus.NOT_FOUND, 'NOT_FOUND');
 * ```
 */
export class BaseAppError extends HttpException {
  /**
   * 创建应用错误实例
   * @param message - 错误消息
   * @param statusCode - HTTP 状态码，默认 500
   * @param errorCode - 业务错误码，用于前端识别错误类型
   * @param details - 额外的错误详情
   */
  constructor(
    message: string,
    public readonly statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly errorCode?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, statusCode);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 转换为 JSON 格式
   * @returns 错误响应对象
   */
  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      error: this.errorCode || this.name,
      timestamp: new Date().toISOString(),
      ...(this.details && { details: this.details }),
    };
  }
}
