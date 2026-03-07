const { request, downloadFile } = require('../lib/request');

function fetchStudentReportOverview(days) {
  return request({
    url: '/student/reports/overview',
    method: 'GET',
    data: { days },
  });
}

function fetchClassComparison(days) {
  return request({
    url: '/student/reports/class-comparison',
    method: 'GET',
    data: { days },
  });
}

function downloadStudentReportPdf(days, lang) {
  return downloadFile({
    url: '/student/reports/pdf',
    data: {
      days,
      lang,
    },
  });
}

module.exports = {
  fetchStudentReportOverview,
  fetchClassComparison,
  downloadStudentReportPdf,
};
