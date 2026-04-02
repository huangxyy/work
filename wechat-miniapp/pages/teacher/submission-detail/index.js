const { fetchSubmissionDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText } = require('../../../lib/teacher');

Page({
  data: {
    submissionId: '',
    submission: null,
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ submissionId: id });
    this.loadSubmission();
  },

  async loadSubmission() {
    const { submissionId } = this.data;
    showLoading('加载中...');
    try {
      const submission = await fetchSubmissionDetail(submissionId);
      this.setData({ submission });
    } catch (error) {
      showToast('加载失败');
    } finally {
      hideLoading();
    }
  },

  onViewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      urls: [url],
    });
  },

  onRetry() {
    this.loadSubmission();
  },
});
