import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface PerformanceLog {
  timestamp: string;
  method: string;
  path: string;
  durationMs: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThreshold = 1000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const log: PerformanceLog = {
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.route?.path || request.url,
            durationMs: duration,
            statusCode: response.statusCode,
            userAgent: request.headers?.['user-agent'],
            ip: request.ip,
            userId: request.user?.id,
          };

          if (duration > this.slowThreshold) {
            this.logger.warn({
              msg: 'Slow request detected',
              ...log,
            });
          } else {
            this.logger.debug({
              msg: 'Request completed',
              ...log,
            });
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            msg: 'Request failed',
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.route?.path || request.url,
            durationMs: duration,
            error: error.message,
            userId: request.user?.id,
          });
        },
      }),
    );
  }
}
