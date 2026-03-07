const { getApiBaseUrl } = require('./lib/config');
const { getToken, getUser } = require('./lib/auth');

App({
  globalData: {
    apiBaseUrl: '',
    token: '',
    user: null,
  },
  onLaunch() {
    this.globalData.apiBaseUrl = getApiBaseUrl();
    this.globalData.token = getToken();
    this.globalData.user = getUser();
  },
  refreshSession() {
    this.globalData.apiBaseUrl = getApiBaseUrl();
    this.globalData.token = getToken();
    this.globalData.user = getUser();
  },
});
