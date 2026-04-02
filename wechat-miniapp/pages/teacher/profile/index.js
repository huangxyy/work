const { getUser } = require('../../../lib/auth');
const { logout } = require('../../../services/auth');
const { showToast } = require('../../../lib/ui');

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
});
