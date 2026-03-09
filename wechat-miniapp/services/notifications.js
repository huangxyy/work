const { request } = require('../lib/request');

function fetchNotifications(unreadOnly) {
  return request({
    url: '/notifications',
    method: 'GET',
    data: unreadOnly ? { unreadOnly: true } : {},
  });
}

function fetchUnreadCount() {
  return request({
    url: '/notifications/unread-count',
    method: 'GET',
  });
}

function markAsRead(id) {
  return request({
    url: `/notifications/${id}/read`,
    method: 'PATCH',
  });
}

function markAllRead() {
  return request({
    url: '/notifications/read-all',
    method: 'POST',
  });
}

module.exports = {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllRead,
};
