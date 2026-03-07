const { getToken, getUser, setUser, clearSession } = require('./auth');
const { fetchMe } = require('../services/auth');

function redirectToLogin(from) {
  const query = from ? `?from=${encodeURIComponent(from)}` : '';
  wx.reLaunch({
    url: `/pages/login/index${query}`,
  });
}

function ensureLogin(from) {
  if (!getToken()) {
    redirectToLogin(from);
    return false;
  }
  return true;
}

async function syncUser() {
  try {
    const user = await fetchMe();
    setUser(user);
    const app = getApp();
    if (app && typeof app.refreshSession === 'function') {
      app.refreshSession();
    }
    return user;
  } catch (error) {
    if (error && error.statusCode === 401) {
      clearSession();
      const app = getApp();
      if (app && typeof app.refreshSession === 'function') {
        app.refreshSession();
      }
    }
    throw error;
  }
}

module.exports = {
  redirectToLogin,
  ensureLogin,
  syncUser,
  getUser,
};
