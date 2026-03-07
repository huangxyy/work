function showToast(title, icon = 'none', duration = 2200) {
  wx.showToast({ title, icon, duration });
}

function showLoading(title = '加载中') {
  wx.showLoading({ title, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

function confirm(options) {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title || '提示',
      content: options.content || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      success(res) {
        resolve(Boolean(res.confirm));
      },
      fail() {
        resolve(false);
      },
    });
  });
}

module.exports = {
  showToast,
  showLoading,
  hideLoading,
  confirm,
};
