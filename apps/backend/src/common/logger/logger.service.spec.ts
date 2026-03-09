import { ConfigService } from '@nestjs/config';
import { LoggerService, LogLevel } from './logger.service';

describe('LoggerService', () => {
  let logger: LoggerService;

  const makeLogger = (env: Record<string, string> = {}) => {
    const configService = {
      get: jest.fn((key: string) => env[key] || undefined),
    } as unknown as ConfigService;
    return new LoggerService(configService);
  };

  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'log').mockImplementation(() => {});
    logger = makeLogger({ LOG_LEVEL: 'debug' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── setContext / setUserId / setRequestId ───

  describe('fluent setters', () => {
    it('should return this for chaining', () => {
      const result = logger.setContext('TestCtx').setUserId('u1').setRequestId('r1');
      expect(result).toBe(logger);
    });
  });

  // ─── log levels ───

  describe('log methods', () => {
    it('should write debug log in dev mode', () => {
      logger.debug('test debug');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should write info log via log()', () => {
      logger.log('test info');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should write info log via info()', () => {
      logger.info('test info');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should write warn log', () => {
      logger.warn('test warn');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should write error log with Error object', () => {
      logger.error('test error', new Error('boom'), 'stack');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should write error log with data object', () => {
      logger.error('test error', { extra: 'info' });
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });

    it('should map verbose to debug', () => {
      logger.verbose('verbose msg');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });
  });

  // ─── shouldLog filtering ───

  describe('level filtering', () => {
    it('should filter out debug when level is info', () => {
      const infoLogger = makeLogger({ LOG_LEVEL: 'info' });
      infoLogger.debug('should not appear');
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it('should filter out debug and info when level is warn', () => {
      const warnLogger = makeLogger({ LOG_LEVEL: 'warn' });
      warnLogger.debug('nope');
      warnLogger.info('nope');
      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should allow error when level is error', () => {
      const errorLogger = makeLogger({ LOG_LEVEL: 'error' });
      errorLogger.error('yes');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled();
    });
  });

  // ─── production mode ───

  describe('production mode', () => {
    it('should output JSON to stdout in production', () => {
      const prodLogger = makeLogger({ LOG_LEVEL: 'debug', NODE_ENV: 'production' });
      prodLogger.info('production log');

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"'),
      );
    });
  });

  // ─── context in output ───

  describe('context metadata', () => {
    it('should include context, userId, requestId in output', () => {
      const prodLogger = makeLogger({ LOG_LEVEL: 'debug', NODE_ENV: 'production' });
      prodLogger.setContext('MyCtx').setUserId('user-1').setRequestId('req-1');
      prodLogger.info('with metadata');

      const output = (process.stdout.write as jest.Mock).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.context).toBe('MyCtx');
      expect(parsed.userId).toBe('user-1');
      expect(parsed.requestId).toBe('req-1');
    });

    it('should include data in log entry', () => {
      const prodLogger = makeLogger({ LOG_LEVEL: 'debug', NODE_ENV: 'production' });
      prodLogger.info('with data', { key: 'value' });

      const output = (process.stdout.write as jest.Mock).mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data).toEqual({ key: 'value' });
    });
  });

  // ─── prettyPrint data branch ───

  describe('prettyPrint', () => {
    it('should print data block in dev mode when data has keys', () => {
      logger.info('with data', { foo: 'bar' });
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(2); // prefix + data
    });

    it('should not print extra data line when data is empty', () => {
      logger.info('no data');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(1);
    });
  });

  // ─── colorizeLevel ───

  describe('colorizeLevel', () => {
    it('should colorize all levels without error', () => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(4);
    });
  });
});
