// lib/teacher.js

function getHomeworkStatusText(status) {
  const map = {
    DRAFT: '草稿',
    PUBLISHED: '已发布',
    CLOSED: '已关闭',
  };
  return map[status] || status;
}

function getSubmissionStatusText(status) {
  const map = {
    QUEUED: '排队中',
    PROCESSING: '处理中',
    DONE: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
}

function getSubmissionStatusColor(status) {
  const map = {
    QUEUED: 'default',
    PROCESSING: 'processing',
    DONE: 'success',
    FAILED: 'error',
  };
  return map[status] || 'default';
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSkipReasonText(reason) {
  const map = {
    NON_IMAGE: '非图片文件',
    ACCOUNT_NOT_FOUND: '账号不存在',
    STUDENT_NOT_FOUND: '学生不存在',
    OCR_EMPTY: '无法识别文字',
    OCR_FAILED: 'OCR识别失败',
    AI_NO_MATCH: '无法匹配学生',
    AI_AMBIGUOUS: '匹配结果不明确',
    AI_PARSE_FAILED: 'AI解析失败',
    AI_NOT_CONFIGURED: 'AI未配置',
    AI_FAILED: 'AI处理失败',
  };
  return map[reason] || reason;
}

module.exports = {
  getHomeworkStatusText,
  getSubmissionStatusText,
  getSubmissionStatusColor,
  formatDateTime,
  formatDate,
  getSkipReasonText,
};
