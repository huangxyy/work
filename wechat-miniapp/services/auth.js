const { request } = require('../lib/request');
const { setToken, setUser, clearSession } = require('../lib/auth');

async function login(account, password) {
  const data = await request({
    url: '/auth/login',
    method: 'POST',
    data: { account, password },
  });
  if (data && data.token) {
    setToken(data.token);
  }
  if (data && data.user) {
    setUser(data.user);
  }
  const app = getApp();
  if (app && typeof app.refreshSession === 'function') {
    app.refreshSession();
  }
  return data;
}

async function fetchMe() {
  return request({
    url: '/auth/me',
    method: 'GET',
  });
}

async function changePassword(oldPassword, newPassword) {
  return request({
    url: '/auth/change-password',
    method: 'POST',
    data: { oldPassword, newPassword },
  });
}

async function updateProfile(data) {
  const result = await request({
    url: '/auth/profile',
    method: 'PATCH',
    data,
  });
  if (result && result.id) {
    setUser(result);
  }
  return result;
}

async function logout() {
  try {
    await request({
      url: '/auth/logout',
      method: 'POST',
    });
  } finally {
    clearSession();
    const app = getApp();
    if (app && typeof app.refreshSession === 'function') {
      app.refreshSession();
    }
  }
}

module.exports = {
  login,
  fetchMe,
  logout,
  changePassword,
  updateProfile,
};
