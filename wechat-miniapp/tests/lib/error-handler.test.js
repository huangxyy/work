const errorHandler = require('../../lib/error-handler');

describe('ErrorHandler', () => {
  test('should parse network error', () => {
    const error = { errMsg: 'request:fail' };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('网络连接失败');
  });

  test('should parse 401 error', () => {
    const error = { statusCode: 401 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('登录已过期');
  });

  test('should parse 403 error', () => {
    const error = { statusCode: 403 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('无权限访问');
  });

  test('should parse 404 error', () => {
    const error = { statusCode: 404 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBeDefined();
  });

  test('should parse 500 error', () => {
    const error = { statusCode: 500 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('服务器错误');
  });

  test('should parse business error', () => {
    const error = {
      statusCode: 400,
      data: { code: 'HOMEWORK_NOT_FOUND' }
    };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('作业不存在');
  });

  test('should return unknown error for unrecognized errors', () => {
    const error = { statusCode: 418 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('操作失败');
  });
});
