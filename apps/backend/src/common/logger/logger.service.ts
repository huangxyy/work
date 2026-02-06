import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  userId?: string;
  requestId?: string;
  data?: LogContext;
}

/**
 * Structured JSON logger service.
 * Outputs logs in a consistent JSON format for easier parsing and analysis.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly level: LogLevel;
  private readonly isProduction: boolean;

  constructor(private readonly config: ConfigService) {
    this.level = (this.config.get<string>('LOG_LEVEL') || 'info') as LogLevel;
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Set the context for subsequent log messages
   */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  /**
   * Set the user ID for tracking user-specific logs
   */
  setUserId(userId: string): this {
    this.userId = userId;
    return this;
  }

  /**
   * Set a request ID for tracing requests through the system
   */
  setRequestId(requestId: string): this {
    this.requestId = requestId;
    return this;
  }

  private context?: string;
  private userId?: string;
  private requestId?: string;

  debug(message: string, data?: LogContext): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: LogContext): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: LogContext): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | LogContext, stack?: string): void {
    let errorData: LogContext | undefined;

    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        ...(stack && { stack }),
      };
    } else if (error) {
      errorData = error as LogContext;
    }

    this.writeLog(LogLevel.ERROR, message, errorData);
  }

  log(message: string, data?: LogContext): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  verbose(message: string, data?: LogContext): void {
    // Map verbose to debug for consistency
    this.debug(message, data);
  }

  private writeLog(level: LogLevel, message: string, data?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(this.context && { context: this.context }),
      ...(this.userId && { userId: this.userId }),
      ...(this.requestId && { requestId: this.requestId }),
      ...(data && { data }),
    };

    const output = JSON.stringify(entry);

    // In production, always output to stdout
    // In development, use pretty print for readability
    if (this.isProduction) {
      process.stdout.write(`${output}\n`);
    } else {
      this.prettyPrint(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private prettyPrint(entry: LogEntry): void {
    const { level, message, timestamp, context, userId, requestId, data } = entry;

    const coloredLevel = this.colorizeLevel(level);
    const time = new Date(timestamp).toLocaleTimeString();
    const prefix = [
      coloredLevel,
      timestamp,
      context && `[${context}]`,
      userId && `user:${userId}`,
      requestId && `req:${requestId}`,
    ]
      .filter(Boolean)
      .join(' ');

    // eslint-disable-next-line no-console
    console.log(prefix, message);

    if (data && Object.keys(data).length > 0) {
      // eslint-disable-next-line no-console
      console.log('  ', JSON.stringify(data, null, 2));
    }
  }

  private colorizeLevel(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // cyan
      [LogLevel.INFO]: '\x1b[32m', // green
      [LogLevel.WARN]: '\x1b[33m', // yellow
      [LogLevel.ERROR]: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${level.toUpperCase()}${reset}`;
  }
}
