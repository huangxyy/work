function formatDateTime(input) {
  if (!input) {
    return '未设置';
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input);
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getHomeworkStatus(dueAt, allowLateSubmission) {
  if (!dueAt) {
    return { key: 'nodue', label: '未设截止', className: 'status-nodue' };
  }
  const time = new Date(dueAt).getTime();
  if (Number.isNaN(time)) {
    return { key: 'nodue', label: '未设截止', className: 'status-nodue' };
  }
  if (time < Date.now()) {
    if (allowLateSubmission) {
      return { key: 'late', label: '逾期可补交', className: 'status-late' };
    }
    return { key: 'overdue', label: '已截止', className: 'status-overdue' };
  }
  return { key: 'open', label: '进行中', className: 'status-open' };
}

function getSubmissionStatus(status) {
  const map = {
    QUEUED: { label: '排队中', className: 'status-queued' },
    PROCESSING: { label: '批改中', className: 'status-processing' },
    DONE: { label: '已完成', className: 'status-done' },
    FAILED: { label: '失败', className: 'status-failed' },
  };
  return map[status] || { label: status || '未知', className: 'status-nodue' };
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function pickErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (Array.isArray(error)) {
    return error.join('；');
  }
  if (typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function throttle(fn, delay = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

module.exports = {
  formatDateTime,
  getHomeworkStatus,
  getSubmissionStatus,
  safeJsonParse,
  pickErrorMessage,
  debounce,
  throttle,
};
