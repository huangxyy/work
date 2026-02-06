import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

export class ForbiddenError extends BaseAppError {
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.FORBIDDEN, errorCode || 'FORBIDDEN');
  }
}
