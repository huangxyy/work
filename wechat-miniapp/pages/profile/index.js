const { getUser, ensureLogin, syncUser, redirectToLogin } = require('../../lib/page');
const { getApiBaseUrl, setApiBaseUrl } = require('../../lib/config');
const { getSubmitDraftCount, clearAllSubmitDrafts } = require('../../lib/draft');
const { logout } = require('../../services/auth');
const { showToast, confirm, showLoading, hideLoading } = require('../../lib/ui');
const { pickErrorMessage } = require('../../lib/utils');

Page({
  data: {
    user: null,
    apiBaseUrl: '',
    syncing: false,
    draftCount: 0,
    clearingDrafts: false,
  },
  onShow() {
    if (!ensureLogin('/pages/profile/index')) {
      return;
    }
    this.setData({
      user: getUser(),
      apiBaseUrl: getApiBaseUrl(),
      draftCount: getSubmitDraftCount(),
    });
    this.refreshProfile();
  },
  onPullDownRefresh() {
    if (!ensureLogin('/pages/profile/index')) {
      wx.stopPullDownRefresh();
      return;
    }
    this.setData({
      user: getUser(),
      apiBaseUrl: getApiBaseUrl(),
      draftCount: getSubmitDraftCount(),
    });
    this.refreshProfile(true);
  },
  handleApiBaseUrlInput(event) {
    this.setData({ apiBaseUrl: event.detail.value || '' });
  },
  saveApiBaseUrl() {
    const value = (this.data.apiBaseUrl || '').trim();
    if (!value) {
      showToast('请填写接口地址');
      return;
    }
    const apiBaseUrl = setApiBaseUrl(value);
    const app = getApp();
    if (app && typeof app.refreshSession === 'function') {
      app.refreshSession();
    }
    this.setData({ apiBaseUrl });
    showToast('接口地址已保存', 'success');
  },
  async refreshProfile(fromPullDown) {
    if (this.data.syncing) {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
      return;
    }
    this.setData({ syncing: true });
    try {
      const user = await syncUser();
      this.setData({ user });
    } catch (error) {
      showToast(pickErrorMessage(error, '用户信息同步失败'));
      if (error && error.statusCode === 401) {
        redirectToLogin('/pages/profile/index');
      }
    } finally {
      this.setData({ syncing: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
  async handleLogout() {
    const confirmed = await confirm({
      title: '退出登录',
      content: '退出后需要重新输入账号和密码。',
      confirmText: '退出',
    });
    if (!confirmed) {
      return;
    }
    showLoading('正在退出');
    try {
      await logout();
      showToast('已退出', 'success');
      setTimeout(() => {
        redirectToLogin();
      }, 280);
    } finally {
      hideLoading();
    }
  },
  async clearAllDrafts() {
    if (this.data.clearingDrafts || !this.data.draftCount) {
      return;
    }
    const confirmed = await confirm({
      title: '清理本地草稿',
      content: '这会删除所有未提交草稿及其本地保存图片，操作后不可恢复。',
      confirmText: '清理',
    });
    if (!confirmed) {
      return;
    }
    this.setData({ clearingDrafts: true });
    showLoading('正在清理');
    try {
      const clearedCount = await clearAllSubmitDrafts();
      this.setData({ draftCount: 0 });
      showToast(clearedCount ? `已清理 ${clearedCount} 份草稿` : '没有可清理的草稿', 'success');
    } finally {
      hideLoading();
      this.setData({ clearingDrafts: false });
    }
  },
  goHomeworks() {
    wx.switchTab({
      url: '/pages/homeworks/index',
    });
  },
  goSubmissions() {
    wx.switchTab({
      url: '/pages/submissions/index',
    });
  },
  goReport() {
    wx.navigateTo({
      url: '/pages/report/index',
    });
  },
})
