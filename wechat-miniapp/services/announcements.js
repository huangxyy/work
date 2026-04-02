const { request } = require('../lib/request');

function fetchAnnouncements() {
  return request({
    url: '/announcements',
    method: 'GET',
  });
}

function createAnnouncement(data) {
  return request({
    url: '/announcements',
    method: 'POST',
    data,
  });
}

function updateAnnouncement(id, data) {
  return request({
    url: `/announcements/${id}`,
    method: 'PATCH',
    data,
  });
}

function deleteAnnouncement(id) {
  return request({
    url: `/announcements/${id}`,
    method: 'DELETE',
  });
}

module.exports = {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
