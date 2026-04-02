import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { MetricsService, ApiRequestMetric } from './metrics.service';

/**
 * 排除记录的路径
 */
const EXCLUDE_PATHS = [
  '/health',
  '/health/',
  '/api/health',
  '/api/health/',
  '/api/docs',
  '/api/docs/',
];

/**
 * MetricsInterceptor API 指标拦截器
 *
 * 自动记录所有 API 请求的指标。
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 检查是否应该记录此请求
    if (this.shouldExclude(request)) {
      return next.handle();
    }

    const startTime = Date.now();
    const path = this.extractPath(request);
    const method = request.method;
    const userId = request.user?.id;

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          const metric: ApiRequestMetric = {
            path,
            method,
            statusCode,
            responseTime,
            timestamp: Date.now(),
            userId,
            success: statusCode >= 200 && statusCode < 400,
          };

          this.metricsService.recordRequest(metric);
        },
        error: (error: Error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = (error as unknown as { status?: number }).status || 500;

          const metric: ApiRequestMetric = {
            path,
            method,
            statusCode,
            responseTime,
            timestamp: Date.now(),
            userId,
            success: false,
          };

          this.metricsService.recordRequest(metric);
        },
      }),
    );
  }

  /**
   * 判断是否应该排除此请求
   */
  private shouldExclude(request: { path?: string; url?: string; route?: { handler?: unknown } }): boolean {
    const path = request.path || request.url;

    // 检查排除列表
    if (path && EXCLUDE_PATHS.some((exclude) => path.startsWith(exclude))) {
      return true;
    }

    // 检查是否是静态资源
    if (path && path.includes('.')) {
      return true;
    }

    // 检查路由元数据
    const handler = request.route?.handler;
    if (handler && typeof handler === 'function') {
      const excludeMetrics = this.reflector.get<boolean>('excludeMetrics', handler);
      if (excludeMetrics) {
        return true;
      }
    }

    return false;
  }

  /**
   * 提取路径（去除查询参数和动态ID）
   */
  private extractPath(request: { path?: string; url?: string }): string {
    let path = request.path || request.url || '/';

    // 移除查询参数
    const queryIndex = path.indexOf('?');
    if (queryIndex > -1) {
      path = path.substring(0, queryIndex);
    }

    // 将动态ID替换为占位符（用于聚合统计）
    // 例如: /api/submissions/abc123 -> /api/submissions/:id
    path = path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/\d+/g, '/:id');

    return path;
  }
}
