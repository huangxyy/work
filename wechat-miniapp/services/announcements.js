const { request } = require('../lib/request');

function fetchAnnouncements() {
  return request({
    url: '/announcements',
    method: 'GET',
  });
}

module.exports = {
  fetchAnnouncements,
};
