import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

export class ConflictError extends BaseAppError {
  constructor(message: string, errorCode?: string) {
    super(message, HttpStatus.CONFLICT, errorCode || 'CONFLICT');
  }
}
