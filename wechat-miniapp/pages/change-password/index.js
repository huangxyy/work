const { request } = require('../../lib/request');
const { showToast, showLoading, hideLoading } = require('../../lib/ui');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
  },

  onOldPasswordInput(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  validate() {
    const { oldPassword, newPassword, confirmPassword } = this.data;

    if (!oldPassword) {
      showToast('请输入当前密码');
      return false;
    }

    if (!newPassword) {
      showToast('请输入新密码');
      return false;
    }

    if (newPassword.length < 8) {
      showToast('新密码至少8个字符');
      return false;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showToast('密码必须包含字母和数字');
      return false;
    }

    if (newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致');
      return false;
    }

    if (oldPassword === newPassword) {
      showToast('新密码不能与当前密码相同');
      return false;
    }

    return true;
  },

  async onChangePassword() {
    if (!this.validate()) {
      return;
    }

    const { oldPassword, newPassword } = this.data;

    this.setData({ loading: true });
    showLoading('修改中...');

    try {
      await request({
        url: '/auth/change-password',
        method: 'POST',
        data: { oldPassword, newPassword },
      });

      hideLoading();
      showToast('密码修改成功，请重新登录', 'success');

      // 清除登录状态，跳转到登录页
      setTimeout(() => {
        wx.removeStorageSync('token');
        wx.removeStorageSync('user');
        wx.reLaunch({
          url: '/pages/login/index',
        });
      }, 1500);
    } catch (error) {
      hideLoading();
      const message = error.data?.message || error.message || '修改失败';
      if (message.includes('当前密码不正确')) {
        showToast('当前密码不正确');
      } else {
        showToast(message);
      }
    } finally {
      this.setData({ loading: false });
    }
  },
});
