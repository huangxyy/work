const { getUser } = require('../../../lib/auth');
const { logout } = require('../../../services/auth');
const { showToast } = require('../../../lib/ui');
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    user: null,
    avatarText: '老',
    userName: '老师',
    userAccount: '',
  },

  onLoad() {
    const user = getUser();
    this.setData({
      user,
      avatarText: user && user.name ? user.name.charAt(0) : '老',
      userName: user && user.name ? user.name : '老师',
      userAccount: user && user.account ? user.account : '',
    });
  },

  onShow() {
    const user = getUser();
    this.setData({
      user,
      avatarText: user && user.name ? user.name.charAt(0) : '老',
      userName: user && user.name ? user.name : '老师',
      userAccount: user && user.account ? user.account : '',
    });
  },

  async onLogout() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    try {
      await logout();
      showToast('已退出登录', 'success');
      wx.reLaunch({ url: '/pages/login/index' });
    } catch (error) {
      showToast('退出失败');
    }
  },

  onChangePassword() {
    wx.navigateTo({ url: '/pages/change-password/index' });
  },

  onGradingSettings() {
    wx.navigateTo({ url: '/pages/teacher/grading-settings/index' });
  },

  onClassManage() {
    wx.navigateTo({ url: '/pages/teacher/classes/index' });
  },

  onClearCache() {
    const confirmed = wx.showModal({
      title: '确认清理',
      content: '确定要清理所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          cache.clear();
          showToast('缓存已清理', 'success');
        }
      }
    });
  },

  onShowHelp() {
    showHelp('profile');
  }
});
