const { request, uploadFiles } = require('../lib/request');

function createSubmission(payload) {
  return uploadFiles({
    url: '/submissions',
    files: payload.files,
    formData: {
      homeworkId: payload.homeworkId,
      ...(payload.mode ? { mode: payload.mode } : {}),
      ...(payload.needRewrite !== undefined ? { needRewrite: String(payload.needRewrite) } : {}),
    },
    onProgress: payload.onProgress,
  });
}

function fetchSubmission(id) {
  return request({
    url: `/submissions/${id}`,
    method: 'GET',
  });
}

function fetchStudentSubmissions(params) {
  return request({
    url: '/submissions',
    method: 'GET',
    data: params,
  });
}

module.exports = {
  createSubmission,
  fetchSubmission,
  fetchStudentSubmissions,
};
