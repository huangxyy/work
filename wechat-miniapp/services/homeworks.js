const { request } = require('../lib/request');

function fetchStudentHomeworks() {
  return request({
    url: '/homeworks/student',
    method: 'GET',
  });
}

async function fetchHomeworkDetail(homeworkId) {
  return request({
    url: `/homeworks/${homeworkId}`,
    method: 'GET',
  });
}

async function fetchTemplates() {
  return request({
    url: '/homework-templates',
    method: 'GET',
  });
}

module.exports = {
  fetchStudentHomeworks,
  fetchHomeworkDetail,
  fetchTemplates,
};
