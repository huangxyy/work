import { HttpStatus } from '@nestjs/common';
import { BaseAppError } from './base-app-error';

export interface ValidationField {
  field: string;
  message: string;
}

export class ValidationError extends BaseAppError {
  constructor(message: string, public readonly fields?: ValidationField[]) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR');
  }

  toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      ...(this.fields && { fields: this.fields }),
    };
  }
}
