import { describe, it, expect } from 'vitest';
import { getErrorMessage, getMessageByCode, parseApiError } from './errorHandler';

describe('getErrorMessage', () => {
  it('should return Chinese message for known error code from axios response', () => {
    // The function checks 'response' in error AND 'data' in error (top-level)
    const error = {
      response: { data: { errorCode: 'OCR_EMPTY', message: 'fallback' } },
      data: { errorCode: 'OCR_EMPTY', message: 'fallback' },
    };
    expect(getErrorMessage(error, 'zh')).toBe(
      '无法识别图片中的文字，请确保图片清晰且包含英文内容',
    );
  });

  it('should return English message for known error code', () => {
    const error = {
      response: { data: { errorCode: 'LLM_TIMEOUT' } },
      data: { errorCode: 'LLM_TIMEOUT' },
    };
    expect(getErrorMessage(error, 'en')).toBe(
      'Grading timeout. Please try again later.',
    );
  });

  it('should fallback to response message if error code is unknown', () => {
    const error = {
      response: { data: { errorCode: 'SOME_UNKNOWN_CODE', message: 'Custom message' } },
      data: { errorCode: 'SOME_UNKNOWN_CODE', message: 'Custom message' },
    };
    expect(getErrorMessage(error, 'zh')).toBe('Custom message');
  });

  it('should handle error with code property', () => {
    const error = { code: 'LLM_QUOTA_EXCEEDED' };
    expect(getErrorMessage(error, 'zh')).toBe('今日批改次数已达上限，请明天再试');
  });

  it('should handle error with message property', () => {
    const error = { message: 'Something went wrong' };
    expect(getErrorMessage(error, 'zh')).toBe('Something went wrong');
  });

  it('should handle string error', () => {
    expect(getErrorMessage('Raw error string', 'zh')).toBe('Raw error string');
  });

  it('should return default message for unknown error', () => {
    expect(getErrorMessage(42, 'zh')).toBe('操作失败，请稍后重试');
    expect(getErrorMessage(null, 'en')).toBe(
      'Operation failed. Please try again later.',
    );
  });

  it('should default to Chinese language', () => {
    const error = { code: 'UNAUTHORIZED' };
    expect(getErrorMessage(error)).toBe('请先登录');
  });
});

describe('getMessageByCode', () => {
  it('should return message for known code', () => {
    expect(getMessageByCode('FORBIDDEN', 'zh')).toBe('没有权限执行此操作');
    expect(getMessageByCode('FORBIDDEN', 'en')).toBe(
      'You do not have permission to perform this action.',
    );
  });

  it('should return default message for unknown code', () => {
    expect(getMessageByCode('NONEXISTENT', 'zh')).toBe('操作失败，请稍后重试');
  });

  it('should default to Chinese', () => {
    expect(getMessageByCode('UNAUTHORIZED')).toBe('请先登录');
  });
});

describe('parseApiError', () => {
  it('should extract error code from axios response', () => {
    const error = {
      response: {
        data: { errorCode: 'LLM_API_ERROR', message: 'Service down' },
      },
    };
    expect(parseApiError(error)).toEqual({
      code: 'LLM_API_ERROR',
      message: 'Service down',
    });
  });

  it('should extract code from error object', () => {
    const error = { code: 'FILE_TOO_LARGE' };
    expect(parseApiError(error)).toEqual({
      code: 'FILE_TOO_LARGE',
      message: '',
    });
  });

  it('should return UNKNOWN_ERROR for unrecognized errors', () => {
    expect(parseApiError('string error')).toEqual({
      code: 'UNKNOWN_ERROR',
      message: '',
    });
    expect(parseApiError(null)).toEqual({
      code: 'UNKNOWN_ERROR',
      message: '',
    });
    expect(parseApiError(undefined)).toEqual({
      code: 'UNKNOWN_ERROR',
      message: '',
    });
  });
});
