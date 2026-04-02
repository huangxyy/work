const { request } = require('../lib/request');

async function fetchClasses() {
  return request({
    url: '/teacher/classes',
    method: 'GET',
  });
}

async function fetchClassDetail(classId) {
  return request({
    url: `/teacher/classes/${classId}`,
    method: 'GET',
  });
}

async function fetchHomeworks(params) {
  return request({
    url: '/teacher/homeworks',
    method: 'GET',
    data: params,
  });
}

async function createHomework(data) {
  return request({
    url: '/teacher/homeworks',
    method: 'POST',
    data,
  });
}

async function updateHomework(homeworkId, data) {
  return request({
    url: `/teacher/homeworks/${homeworkId}`,
    method: 'PATCH',
    data,
  });
}

async function deleteHomework(homeworkId) {
  return request({
    url: `/teacher/homeworks/${homeworkId}`,
    method: 'DELETE',
  });
}

async function fetchSubmissions(homeworkId) {
  return request({
    url: '/teacher/submissions',
    method: 'GET',
    data: { homeworkId },
  });
}

async function fetchSubmissionDetail(submissionId) {
  return request({
    url: `/teacher/submissions/${submissionId}`,
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

async function fetchBatchUploads(homeworkId) {
  return request({
    url: '/teacher/submissions/batches',
    method: 'GET',
    data: { homeworkId },
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
  return request({
    url: '/teacher/reports/class',
    method: 'GET',
    data: { classId, rangeDays },
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

module.exports = {
  fetchClasses,
  fetchClassDetail,
  fetchHomeworks,
  createHomework,
  updateHomework,
  deleteHomework,
  fetchSubmissions,
  fetchSubmissionDetail,
  previewBatchUpload,
  createBatchUpload,
  fetchBatchUploads,
  fetchBatchDetail,
  retrySkipped,
  deleteSubmission,
  fetchClassReport,
  fetchGradingPreference,
  updateGradingPreference,
};
