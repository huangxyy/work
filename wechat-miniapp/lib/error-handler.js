class ErrorHandler {
  constructor() {
    this.errorMap = {
      'NETWORK_ERROR': {
        title: '网络连接失败',
        message: '请检查网络设置后重试',
        action: '重试'
      },
      'TIMEOUT': {
        title: '请求超时',
        message: '网络不稳定，请稍后重试',
        action: '重试'
      },
      'UNAUTHORIZED': {
        title: '登录已过期',
        message: '请重新登录',
        action: '重新登录'
      },
      'FORBIDDEN': {
        title: '无权限访问',
        message: '您没有权限执行此操作',
        action: '返回'
      },
      'HOMEWORK_NOT_FOUND': {
        title: '作业不存在',
        message: '该作业可能已被删除',
        action: '返回列表'
      },
      'CLASS_NOT_FOUND': {
        title: '班级不存在',
        message: '该班级可能已被删除',
        action: '返回列表'
      },
      'STUDENT_NOT_FOUND': {
        title: '学生不存在',
        message: '该学生可能已被移除',
        action: '返回列表'
      },
      'IMAGE_TOO_LARGE': {
        title: '图片过大',
        message: '请选择小于10MB的图片',
        action: '重新选择'
      },
      'UPLOAD_FAILED': {
        title: '上传失败',
        message: '图片上传失败，请重试',
        action: '重试'
      },
      'UNKNOWN': {
        title: '操作失败',
        message: '请稍后重试或联系客服',
        action: '确定'
      }
    };
  }

  handle(error, context = {}) {
    const errorInfo = this.parseError(error);
    this.showError(errorInfo, context);
  }

  parseError(error) {
    if (!error.statusCode) {
      return this.errorMap.NETWORK_ERROR;
    }

    switch (error.statusCode) {
      case 401:
        return this.errorMap.UNAUTHORIZED;
      case 403:
        return this.errorMap.FORBIDDEN;
      case 404:
        return this.errorMap.NOT_FOUND || this.errorMap.UNKNOWN;
      case 500:
        return {
          title: '服务器错误',
          message: '服务器开小差了，请稍后重试',
          action: '重试'
        };
    }

    if (error.data && error.data.code) {
      const businessError = this.errorMap[error.data.code];
      if (businessError) return businessError;
    }

    return this.errorMap.UNKNOWN;
  }

  showError(errorInfo, context) {
    wx.showModal({
      title: errorInfo.title,
      content: errorInfo.message,
      confirmText: errorInfo.action,
      showCancel: false,
      success: (res) => {
        if (res.confirm && context.onRetry) {
          context.onRetry();
        }
      }
    });
  }
}

module.exports = new ErrorHandler();
