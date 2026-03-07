const STORAGE_KEY = 'miniapp_settings';

function normalizeBaseUrl(url) {
  if (!url) {
    return 'http://127.0.0.1:3000/api';
  }
  return url.replace(/\/+$/, '');
}

function getStoredSettings() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || {};
  } catch (_error) {
    return {};
  }
}

function getApiBaseUrl() {
  const settings = getStoredSettings();
  return normalizeBaseUrl(settings.apiBaseUrl);
}

function setApiBaseUrl(apiBaseUrl) {
  const settings = getStoredSettings();
  const next = {
    ...settings,
    apiBaseUrl: normalizeBaseUrl(apiBaseUrl),
  };
  wx.setStorageSync(STORAGE_KEY, next);
  return next.apiBaseUrl;
}

module.exports = {
  STORAGE_KEY,
  getApiBaseUrl,
  setApiBaseUrl,
  normalizeBaseUrl,
};
