const { request } = require('../lib/request');

function fetchStudentHomeworks() {
  return request({
    url: '/homeworks/student',
    method: 'GET',
  });
}

module.exports = {
  fetchStudentHomeworks,
};
