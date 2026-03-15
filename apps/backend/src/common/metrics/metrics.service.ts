import { Injectable, Logger } from '@nestjs/common';

/**
 * API 请求指标
 */
export interface ApiRequestMetric {
  /** 请求路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** 响应状态码 */
  statusCode: number;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 时间戳 */
  timestamp: number;
  /** 用户 ID（如果有） */
  userId?: string;
  /** 请求是否成功 */
  success: boolean;
}

/**
 * 指标统计摘要
 */
export interface MetricsSummary {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successRequests: number;
  /** 失败请求数 */
  errorRequests: number;
  /** 平均响应时间（毫秒） */
  avgResponseTime: number;
  /** P50 响应时间 */
  p50ResponseTime: number;
  /** P95 响应时间 */
  p95ResponseTime: number;
  /** P99 响应时间 */
  p99ResponseTime: number;
  /** 每分钟请求数 */
  requestsPerMinute: number;
  /** 错误率（百分比） */
  errorRate: string;
  /** 按路径分组的统计 */
  byPath: Record<
    string,
    {
      count: number;
      avgResponseTime: number;
      errorRate: number;
    }
  >;
}

/**
 * 指标配置
 */
const METRICS_CONFIG = {
  // 最大保存的指标数量（内存中）
  maxMetrics: 10000,
  // 指标保留时间（毫秒，默认 1 小时）
  retentionPeriod: 60 * 60 * 1000,
  // 采样率（1.0 = 100%，0.1 = 10%）
  sampleRate: 1.0,
};

/**
 * MetricsService API 监控指标服务
 *
 * 提供请求量、响应时间、错误率等监控指标。
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: ApiRequestMetric[] = [];
  private timer?: NodeJS.Timeout;

  constructor() {
    // 定期清理过期指标
    this.timer = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * 记录 API 请求指标
   */
  recordRequest(metric: ApiRequestMetric): void {
    // 采样检查（避免高负载时记录过多）
    if (Math.random() > METRICS_CONFIG.sampleRate) {
      return;
    }

    this.metrics.push(metric);

    // 限制内存中的指标数量
    if (this.metrics.length > METRICS_CONFIG.maxMetrics) {
      this.metrics.shift();
    }

    // 可选：发出指标事件（可用于外部监控系统集成）
    // this.eventEmitter?.emit('metrics.request', metric);

    // 日志记录（仅错误和慢请求）
    if (!metric.success || metric.responseTime > 3000) {
      this.logger.warn(
        `API ${metric.method} ${metric.path} - Status: ${metric.statusCode}, Time: ${metric.responseTime}ms`,
      );
    }
  }

  /**
   * 获取指标摘要
   */
  getSummary(timeRange?: number): MetricsSummary {
    const now = Date.now();
    const startTime = timeRange ? now - timeRange : now - METRICS_CONFIG.retentionPeriod;

    const relevantMetrics = this.metrics.filter((m) => m.timestamp >= startTime);

    if (relevantMetrics.length === 0) {
      return this.getEmptySummary();
    }

    const totalRequests = relevantMetrics.length;
    const successRequests = relevantMetrics.filter((m) => m.success).length;
    const errorRequests = totalRequests - successRequests;

    const responseTimes = relevantMetrics.map((m) => m.responseTime).sort((a, b) => a - b);
    const avgResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    // 计算每分钟请求数
    const timeRangeMinutes = (now - startTime) / (60 * 1000);
    const requestsPerMinute = Math.round(totalRequests / Math.max(timeRangeMinutes, 1));

    // 按路径分组统计
    const byPath: MetricsSummary['byPath'] = {};
    relevantMetrics.forEach((m) => {
      const key = `${m.method} ${m.path}`;
      if (!byPath[key]) {
        byPath[key] = {
          count: 0,
          avgResponseTime: 0,
          errorRate: 0,
        };
      }
      byPath[key].count++;
    });

    // 计算各路径的统计信息
    Object.entries(byPath).forEach(([key, stat]) => {
      const pathMetrics = relevantMetrics.filter((m) => `${m.method} ${m.path}` === key);
      stat.avgResponseTime =
        pathMetrics.reduce((sum, m) => sum + m.responseTime, 0) / pathMetrics.length;
      stat.errorRate =
        (pathMetrics.filter((m) => !m.success).length / pathMetrics.length) * 100;
    });

    return {
      totalRequests,
      successRequests,
      errorRequests,
      avgResponseTime: Math.round(avgResponseTime),
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerMinute,
      errorRate: ((errorRequests / totalRequests) * 100).toFixed(2),
      byPath,
    };
  }

  /**
   * 获取实时指标（最近 5 分钟）
   */
  getRealtimeSummary(): MetricsSummary {
    return this.getSummary(5 * 60 * 1000);
  }

  /**
   * 获取小时指标
   */
  getHourlySummary(): MetricsSummary {
    return this.getSummary(60 * 60 * 1000);
  }

  /**
   * 获取指定路径的指标
   */
  getPathMetrics(path: string, timeRange?: number): MetricsSummary {
    const summary = this.getSummary(timeRange);
    const pathKey = Object.keys(summary.byPath).find((key) => key.includes(path));

    if (!pathKey) {
      return this.getEmptySummary();
    }

    const pathStat = summary.byPath[pathKey];
    return {
      totalRequests: pathStat.count,
      successRequests: Math.round(pathStat.count * (1 - pathStat.errorRate / 100)),
      errorRequests: Math.round(pathStat.count * (pathStat.errorRate / 100)),
      avgResponseTime: Math.round(pathStat.avgResponseTime),
      p50ResponseTime: pathStat.avgResponseTime,
      p95ResponseTime: pathStat.avgResponseTime,
      p99ResponseTime: pathStat.avgResponseTime,
      requestsPerMinute: Math.round(pathStat.count / 5),
      errorRate: String(pathStat.errorRate),
      byPath: { [pathKey]: pathStat },
    };
  }

  /**
   * 清理过期指标
   */
  private cleanup(): void {
    const cutoffTime = Date.now() - METRICS_CONFIG.retentionPeriod;
    const beforeLength = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);
    const cleaned = beforeLength - this.metrics.length;

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired metrics`);
    }
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.metrics = [];
    this.logger.log('Metrics reset');
  }

  /**
   * 获取指标数量
   */
  getMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * 获取空摘要
   */
  private getEmptySummary(): MetricsSummary {
    return {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: '0.00',
      byPath: {},
    };
  }

  /**
   * 销毁服务
   */
  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
