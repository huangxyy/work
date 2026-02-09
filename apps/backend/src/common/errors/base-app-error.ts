import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class BaseAppError extends HttpException {
  constructor(
    message: string,
    public readonly statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly errorCode?: string,
  ) {
    super(message, statusCode);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      error: this.errorCode || this.name,
      timestamp: new Date().toISOString(),
    };
  }
}
