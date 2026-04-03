const { getUser, syncUser, redirectToLogin } = require('../../../lib/page');
const { logout, changePassword, updateProfile } = require('../../../services/auth');
const { fetchUnreadCount } = require('../../../services/notifications');
const { showToast, confirm, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const cache = require('../../../lib/cache');

Page({
  data: {
    user: null,
    avatarText: '老',
    userName: '老师',
    userAccount: '',
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

  onLoad() {
    this.initUser();
  },

  onShow() {
    this.initUser();
    this.loadUnreadCount();
  },

  onPullDownRefresh() {
    this.refreshProfile(true);
    this.loadUnreadCount();
  },

  initUser() {
    const user = getUser();
    this.setData({
      user,
      avatarText: user && user.name ? user.name.charAt(0) : '老',
      userName: user && user.name ? user.name : '老师',
      userAccount: user && user.account ? user.account : '',
    });
  },

  async refreshProfile(fromPullDown) {
    try {
      const user = await syncUser();
      this.setData({
        user,
        avatarText: user && user.name ? user.name.charAt(0) : '老',
        userName: user && user.name ? user.name : '老师',
        userAccount: user && user.account ? user.account : '',
      });
    } catch (error) {
      if (error && error.statusCode === 401) {
        redirectToLogin('/pages/teacher/profile/index');
      }
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadUnreadCount() {
    try {
      const result = await fetchUnreadCount();
      this.setData({
        unreadCount: result && typeof result.count === 'number' ? result.count : 0,
      });
    } catch (_error) {}
  },

  goMessages() {
    wx.navigateTo({
      url: '/pages/teacher/messages/index',
    });
  },

  onGradingSettings() {
    wx.navigateTo({ url: '/pages/teacher/grading-settings/index' });
  },

  onClassManage() {
    wx.navigateTo({ url: '/pages/teacher/classes/index' });
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
        avatarText: result && result.name ? result.name.charAt(0) : '老',
        userName: result && result.name ? result.name : '老师',
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

  async onClearCache() {
    const confirmed = await confirm({
      title: '清理缓存',
      content: '确定要清理所有缓存数据吗？',
      confirmText: '清理',
    });
    if (!confirmed) return;
    cache.clear();
    showToast('缓存已清理', 'success');
  },

  async onLogout() {
    const confirmed = await confirm({
      title: '退出登录',
      content: '退出后需要重新输入账号和密码。',
      confirmText: '退出',
    });
    if (!confirmed) return;

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
});
