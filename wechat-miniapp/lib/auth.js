const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getToken() {
  try {
    return wx.getStorageSync(TOKEN_KEY) || '';
  } catch (_error) {
    return '';
  }
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '');
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

function getUser() {
  try {
    return wx.getStorageSync(USER_KEY) || null;
  } catch (_error) {
    return null;
  }
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user || null);
}

function clearUser() {
  wx.removeStorageSync(USER_KEY);
}

function clearSession() {
  clearToken();
  clearUser();
}

function isLoggedIn() {
  return Boolean(getToken());
}

module.exports = {
  TOKEN_KEY,
  USER_KEY,
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
  clearUser,
  clearSession,
  isLoggedIn,
};
