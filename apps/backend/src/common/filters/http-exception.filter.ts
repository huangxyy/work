import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseAppError } from '../errors';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  fields?: Array<{ field: string; message: string }>;
}

/**
 * Global exception filter that converts all exceptions to a consistent JSON response format.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_SERVER_ERROR';
    let fields: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof BaseAppError) {
      status = exception.statusCode;
      message = exception.message;
      error = exception.errorCode || exception.name;
      const json = exception.toJSON();
      if ('fields' in json) {
        fields = json.fields as Array<{ field: string; message: string }>;
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }
        if (responseObj.error) {
          error = String(responseObj.error);
        }
      }
    } else if (exception instanceof Error) {
      // Do NOT expose raw internal error messages to clients.
      // The real message is logged server-side below.
      message = 'Internal server error';
    }

    // Log server errors (5xx) — include the real exception message for debugging
    if (status >= 500) {
      const internalMessage = exception instanceof Error ? exception.message : 'Unknown';
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${internalMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      // Log client errors (4xx) at warning level
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(fields && { fields }),
    };

    response.status(status).json(errorResponse);
  }
}
