import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

export class NotFoundError extends BaseAppError {
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.NOT_FOUND, errorCode || 'NOT_FOUND');
  }
}
