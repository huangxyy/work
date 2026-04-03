const { request } = require('../lib/request');

// 构建带查询参数的 URL
function buildUrlWithQuery(baseUrl, params) {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }
  const query = Object.keys(params)
    .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  return query ? `${baseUrl}?${query}` : baseUrl;
}

async function fetchClasses() {
  return request({
    url: '/classes',
    method: 'GET',
  });
}

async function fetchClassStudents(classId) {
  return request({
    url: `/classes/${classId}/students`,
    method: 'GET',
  });
}

async function fetchHomeworks(params) {
  // 过滤掉空字符串参数
  const filteredParams = {};
  if (params) {
    for (const key in params) {
      if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
        filteredParams[key] = params[key];
      }
    }
  }
  // 使用 summary API 获取包含统计信息的数据
  return request({
    url: buildUrlWithQuery('/homeworks/summary', filteredParams),
    method: 'GET',
  });
}

async function fetchHomeworkById(homeworkId) {
  return request({
    url: `/homeworks/${homeworkId}`,
    method: 'GET',
  });
}

async function createHomework(data) {
  return request({
    url: '/homeworks',
    method: 'POST',
    data,
  });
}

async function updateHomework(homeworkId, data) {
  return request({
    url: `/homeworks/${homeworkId}`,
    method: 'PATCH',
    data,
  });
}

async function deleteHomework(homeworkId) {
  return request({
    url: `/homeworks/${homeworkId}`,
    method: 'DELETE',
  });
}

async function fetchSubmissions(params) {
  // 过滤掉空字符串参数
  const filteredParams = {};
  if (params) {
    for (const key in params) {
      if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
        filteredParams[key] = params[key];
      }
    }
  }
  return request({
    url: buildUrlWithQuery('/teacher/submissions', filteredParams),
    method: 'GET',
  });
}

async function fetchSubmissionDetail(submissionId) {
  return request({
    url: `/submissions/${submissionId}`,
    method: 'GET',
  });
}

async function fetchStudentSubmissions(studentId, classId) {
  return request({
    url: buildUrlWithQuery(`/teacher/students/${studentId}/submissions`, { classId }),
    method: 'GET',
  });
}

async function previewBatchUpload(formData) {
  return request({
    url: '/teacher/submissions/batch',
    method: 'POST',
    data: formData,
  });
}

async function createBatchUpload(formData) {
  return request({
    url: '/teacher/submissions/batch',
    method: 'POST',
    data: formData,
  });
}

async function fetchBatchUploads(params) {
  return request({
    url: buildUrlWithQuery('/teacher/submissions/batches', params),
    method: 'GET',
  });
}

async function fetchBatchDetail(batchId) {
  return request({
    url: `/teacher/submissions/batches/${batchId}`,
    method: 'GET',
  });
}

async function retrySkipped(data) {
  return request({
    url: '/teacher/submissions/retry-skipped',
    method: 'POST',
    data,
  });
}

async function deleteSubmission(submissionId) {
  return request({
    url: `/teacher/submissions/${submissionId}`,
    method: 'DELETE',
  });
}

async function fetchClassReport(classId, rangeDays) {
  const params = rangeDays !== undefined ? { rangeDays } : {};
  return request({
    url: buildUrlWithQuery(`/teacher/reports/class/${classId}/overview`, params),
    method: 'GET',
  });
}

async function fetchGradingPreference() {
  return request({
    url: '/teacher/settings/grading/preference',
    method: 'GET',
  });
}

async function updateGradingPreference(mode) {
  return request({
    url: '/teacher/settings/grading/preference',
    method: 'POST',
    data: { mode },
  });
}

async function addTeacherFeedback(submissionId, data) {
  return request({
    url: `/submissions/${submissionId}/feedback`,
    method: 'POST',
    data,
  });
}

async function regradeSubmission(submissionId, data) {
  return request({
    url: `/submissions/${submissionId}/regrade`,
    method: 'POST',
    data,
  });
}

module.exports = {
  fetchClasses,
  fetchClassStudents,
  fetchHomeworks,
  fetchHomeworkById,
  createHomework,
  updateHomework,
  deleteHomework,
  fetchSubmissions,
  fetchSubmissionDetail,
  fetchStudentSubmissions,
  previewBatchUpload,
  createBatchUpload,
  fetchBatchUploads,
  fetchBatchDetail,
  retrySkipped,
  deleteSubmission,
  fetchClassReport,
  fetchGradingPreference,
  updateGradingPreference,
  addTeacherFeedback,
  regradeSubmission,
};
