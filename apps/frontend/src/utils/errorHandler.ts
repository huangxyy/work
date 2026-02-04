/**
 * Error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, { zh: string; en: string }> = {
  // OCR errors
  OCR_EMPTY: {
    zh: '无法识别图片中的文字，请确保图片清晰且包含英文内容',
    en: 'Cannot recognize text from image. Please ensure the image is clear and contains English content.',
  },
  OCR_IMAGE_FAILED: {
    zh: '图片识别失败，请重试或更换图片',
    en: 'Image recognition failed. Please retry or use a different image.',
  },
  OCR_CONFIG_INVALID: {
    zh: 'OCR服务配置错误，请联系管理员',
    en: 'OCR service configuration error. Please contact the administrator.',
  },

  // LLM errors
  LLM_API_ERROR: {
    zh: '批改服务暂时不可用，请稍后重试',
    en: 'Grading service is temporarily unavailable. Please try again later.',
  },
  LLM_TIMEOUT: {
    zh: '批改超时，请稍后重试',
    en: 'Grading timeout. Please try again later.',
  },
  LLM_QUOTA_EXCEEDED: {
    zh: '今日批改次数已达上限，请明天再试',
    en: 'Daily grading limit reached. Please try again tomorrow.',
  },
  LLM_SCHEMA_INVALID: {
    zh: '批改结果格式错误，请重新提交',
    en: 'Invalid grading result format. Please resubmit.',
  },

  // Submission errors
  SUBMISSION_NOT_FOUND: {
    zh: '提交记录不存在',
    en: 'Submission not found.',
  },
  SUBMISSION_ALREADY_EXISTS: {
    zh: '您已经提交过此作业',
    en: 'You have already submitted this homework.',
  },
  HOMEWORK_NOT_FOUND: {
    zh: '作业不存在',
    en: 'Homework not found.',
  },
  HOMEWORK_CLOSED: {
    zh: '作业已截止，无法提交',
    en: 'Homework is closed for submission.',
  },

  // File errors
  FILE_TOO_LARGE: {
    zh: '文件过大，请上传小于10MB的图片',
    en: 'File is too large. Please upload an image smaller than 10MB.',
  },
  FILE_TYPE_INVALID: {
    zh: '不支持的文件格式，请上传JPG、PNG、WebP或GIF图片',
    en: 'Unsupported file format. Please upload JPG, PNG, WebP, or GIF images.',
  },

  // Auth errors
  UNAUTHORIZED: {
    zh: '请先登录',
    en: 'Please login first.',
  },
  FORBIDDEN: {
    zh: '没有权限执行此操作',
    en: 'You do not have permission to perform this action.',
  },

  // Batch upload errors
  BATCH_UPLOAD_FAILED: {
    zh: '批量上传失败，请检查文件格式和大小',
    en: 'Batch upload failed. Please check file formats and sizes.',
  },
  BATCH_STUDENT_NOT_FOUND: {
    zh: '找不到对应的学生，请检查学号是否正确',
    en: 'Student not found. Please check if the student ID is correct.',
  },

  // Default
  UNKNOWN_ERROR: {
    zh: '操作失败，请稍后重试',
    en: 'Operation failed. Please try again later.',
  },
};

/**
 * Get user-friendly error message based on error code
 */
export const getErrorMessage = (error: unknown, language: 'zh' | 'en' = 'zh'): string => {
  // Error object from API response
  if (error && typeof error === 'object') {
    // Axios error with response
    if ('response' in error && 'data' in (error as { response: { data?: unknown } })) {
      const data = (error as { response: { data?: { errorCode?: string; message?: string } } }).response?.data;
      if (data?.errorCode) {
        const errorMapping = ERROR_MESSAGES[data.errorCode];
        if (errorMapping) {
          return errorMapping[language];
        }
      }
      if (data?.message) {
        return data.message;
      }
    }

    // Error with code property
    if ('code' in error && typeof (error as { code: string }).code === 'string') {
      const errorMapping = ERROR_MESSAGES[(error as { code: string }).code];
      if (errorMapping) {
        return errorMapping[language];
      }
    }

    // Error with message property
    if ('message' in error && typeof (error as { message: string }).message === 'string') {
      return (error as { message: string }).message;
    }
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR[language];
};

/**
 * Get user-friendly error message by error code
 */
export const getMessageByCode = (errorCode: string, language: 'zh' | 'en' = 'zh'): string => {
  return ERROR_MESSAGES[errorCode]?.[language] || ERROR_MESSAGES.UNKNOWN_ERROR[language];
};

/**
 * Parse API error and extract error code and message
 */
export const parseApiError = (error: unknown): { code: string; message: string } => {
  if (error && typeof error === 'object') {
    if ('response' in error) {
      const data = (error as { response: { data?: { errorCode?: string; message?: string } } }).response?.data;
      if (data?.errorCode) {
        return { code: data.errorCode, message: data.message || '' };
      }
    }
    if ('code' in error && typeof (error as { code: string }).code === 'string') {
      return { code: (error as { code: string }).code, message: '' };
    }
  }
  return { code: 'UNKNOWN_ERROR', message: '' };
};
