const { login } = require('../../services/auth');
const { clearSession, getToken, getUser } = require('../../lib/auth');
const { getApiBaseUrl, setApiBaseUrl } = require('../../lib/config');
const { showToast, showLoading, hideLoading } = require('../../lib/ui');
const { pickErrorMessage } = require('../../lib/utils');

function navigateAfterLogin(user, path) {
  const defaultPath = user.role === 'TEACHER'
    ? '/pages/teacher/homeworks/index'
    : '/pages/homeworks/index';
  if (!path || path === '/pages/homeworks/index' || path === '/pages/teacher/homeworks/index') {
    wx.switchTab({ url: defaultPath });
    return;
  }
  if (path === '/pages/submissions/index') {
    wx.switchTab({ url: '/pages/submissions/index' });
    return;
  }
  if (path === '/pages/profile/index' || path === '/pages/teacher/profile/index') {
    wx.switchTab({ url: user.role === 'TEACHER' ? '/pages/teacher/profile/index' : '/pages/profile/index' });
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
    if (token && user) {
      navigateAfterLogin(user, from || (user.role === 'TEACHER' ? '/pages/teacher/homeworks/index' : '/pages/homeworks/index'));
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
      if (!response || !response.user) {
        showToast('登录失败，请稍后重试');
        return;
      }
      const { user } = response;
      showToast('登录成功', 'success');
      setTimeout(() => {
        navigateAfterLogin(user, this.data.from || '/pages/homeworks/index');
      }, 280);
    } catch (error) {
      showToast(pickErrorMessage(error, '登录失败，请稍后重试'));
    } finally {
      hideLoading();
      this.setData({ loading: false });
    }
  },
});
