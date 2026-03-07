const { login } = require('../../services/auth');
const { clearSession, getToken, getUser } = require('../../lib/auth');
const { getApiBaseUrl, setApiBaseUrl } = require('../../lib/config');
const { showToast, showLoading, hideLoading } = require('../../lib/ui');
const { pickErrorMessage } = require('../../lib/utils');

function navigateAfterLogin(path) {
  if (!path || path === '/pages/homeworks/index') {
    wx.switchTab({ url: '/pages/homeworks/index' });
    return;
  }
  if (path === '/pages/submissions/index') {
    wx.switchTab({ url: '/pages/submissions/index' });
    return;
  }
  if (path === '/pages/profile/index') {
    wx.switchTab({ url: '/pages/profile/index' });
    return;
  }
  wx.reLaunch({ url: path });
}

Page({
  data: {
    apiBaseUrl: '',
    account: '',
    password: '',
    loading: false,
    from: '',
  },
  onLoad(options) {
    const from = options && options.from ? decodeURIComponent(options.from) : '';
    this.setData({
      apiBaseUrl: getApiBaseUrl(),
      from,
    });
    const token = getToken();
    const user = getUser();
    if (token && user && user.role === 'STUDENT') {
      navigateAfterLogin(from || '/pages/homeworks/index');
    }
  },
  handleApiBaseUrlInput(event) {
    this.setData({ apiBaseUrl: event.detail.value });
  },
  handleAccountInput(event) {
    this.setData({ account: event.detail.value });
  },
  handlePasswordInput(event) {
    this.setData({ password: event.detail.value });
  },
  handleSaveBaseUrl() {
    const value = (this.data.apiBaseUrl || '').trim();
    if (!value) {
      showToast('请先填写接口地址');
      return;
    }
    const saved = setApiBaseUrl(value);
    const app = getApp();
    if (app && typeof app.refreshSession === 'function') {
      app.refreshSession();
    }
    this.setData({ apiBaseUrl: saved });
    showToast('接口地址已保存', 'success');
  },
  async handleLogin() {
    const apiBaseUrl = (this.data.apiBaseUrl || '').trim();
    const account = (this.data.account || '').trim();
    const password = this.data.password || '';
    if (!apiBaseUrl) {
      showToast('请填写后端 API 地址');
      return;
    }
    if (!account) {
      showToast('请输入账号');
      return;
    }
    if (!password) {
      showToast('请输入密码');
      return;
    }

    this.setData({ loading: true });
    setApiBaseUrl(apiBaseUrl);
    showLoading('登录中');
    try {
      const response = await login(account, password);
      if (!response || !response.user || response.user.role !== 'STUDENT') {
        clearSession();
        const app = getApp();
        if (app && typeof app.refreshSession === 'function') {
          app.refreshSession();
        }
        showToast('当前首版仅支持学生账号');
        return;
      }
      showToast('登录成功', 'success');
      setTimeout(() => {
        navigateAfterLogin(this.data.from || '/pages/homeworks/index');
      }, 280);
    } catch (error) {
      showToast(pickErrorMessage(error, '登录失败，请稍后重试'));
    } finally {
      hideLoading();
      this.setData({ loading: false });
    }
  },
});
