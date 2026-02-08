import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

export class BadRequestError extends BaseAppError {
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.BAD_REQUEST, errorCode || 'BAD_REQUEST');
  }
}
