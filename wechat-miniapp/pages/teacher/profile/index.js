const { getUser } = require('../../../lib/auth');
const { logout } = require('../../../services/auth');
const { showToast } = require('../../../lib/ui');

Page({
  data: {
    user: null,
  },

  onLoad() {
    this.setData({ user: getUser() });
  },

  onShow() {
    this.setData({ user: getUser() });
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
});
