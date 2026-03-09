const { getUser, ensureLogin, syncUser, redirectToLogin } = require('../../lib/page');
const { getApiBaseUrl, setApiBaseUrl } = require('../../lib/config');
const { getSubmitDraftCount, clearAllSubmitDrafts } = require('../../lib/draft');
const { logout, changePassword, updateProfile } = require('../../services/auth');
const { fetchUnreadCount } = require('../../services/notifications');
const { showToast, confirm, showLoading, hideLoading } = require('../../lib/ui');
const { pickErrorMessage } = require('../../lib/utils');

Page({
  data: {
    user: null,
    apiBaseUrl: '',
    syncing: false,
    draftCount: 0,
    clearingDrafts: false,
    unreadCount: 0,
    showPasswordCard: false,
    showProfileCard: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    changingPassword: false,
    profileName: '',
    profileEmail: '',
    profilePhone: '',
    updatingProfile: false,
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
    this.loadUnreadCount();
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
    this.loadUnreadCount();
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
  async loadUnreadCount() {
    try {
      const result = await fetchUnreadCount();
      this.setData({
        unreadCount: result && typeof result.count === 'number' ? result.count : 0,
      });
    } catch (_error) {
    }
  },
  goMessages() {
    wx.navigateTo({
      url: '/pages/messages/index',
    });
  },
  togglePasswordCard() {
    this.setData({
      showPasswordCard: !this.data.showPasswordCard,
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  },
  toggleProfileCard() {
    const user = this.data.user || {};
    this.setData({
      showProfileCard: !this.data.showProfileCard,
      profileName: user.name || '',
      profileEmail: user.email || '',
      profilePhone: user.phone || '',
    });
  },
  onOldPasswordInput(e) { this.setData({ oldPassword: e.detail.value }); },
  onNewPasswordInput(e) { this.setData({ newPassword: e.detail.value }); },
  onConfirmPasswordInput(e) { this.setData({ confirmPassword: e.detail.value }); },
  onProfileNameInput(e) { this.setData({ profileName: e.detail.value }); },
  onProfileEmailInput(e) { this.setData({ profileEmail: e.detail.value }); },
  onProfilePhoneInput(e) { this.setData({ profilePhone: e.detail.value }); },
  async submitChangePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    if (!oldPassword || !newPassword) {
      showToast('请填写完整');
      return;
    }
    if (newPassword.length < 8) {
      showToast('新密码至少 8 位');
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      showToast('新密码需包含字母和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致');
      return;
    }
    this.setData({ changingPassword: true });
    showLoading('正在修改');
    try {
      await changePassword(oldPassword, newPassword);
      showToast('密码修改成功', 'success');
      this.setData({ showPasswordCard: false, oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      showToast(pickErrorMessage(error, '密码修改失败'));
    } finally {
      hideLoading();
      this.setData({ changingPassword: false });
    }
  },
  async submitUpdateProfile() {
    const { profileName, profileEmail, profilePhone } = this.data;
    if (!profileName || !profileName.trim()) {
      showToast('姓名不能为空');
      return;
    }
    this.setData({ updatingProfile: true });
    showLoading('正在保存');
    try {
      const result = await updateProfile({
        name: profileName.trim(),
        email: (profileEmail || '').trim(),
        phone: (profilePhone || '').trim(),
      });
      this.setData({
        user: result || this.data.user,
        showProfileCard: false,
      });
      showToast('资料已更新', 'success');
    } catch (error) {
      showToast(pickErrorMessage(error, '资料更新失败'));
    } finally {
      hideLoading();
      this.setData({ updatingProfile: false });
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
