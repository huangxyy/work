const { fetchBatchDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText, getSkipReasonText } = require('../../../lib/teacher');

Page({
  data: {
    batchId: '',
    batch: null,
    activeTab: 0,
  },

  onLoad(options) {
    const { batchId } = options;
    if (!batchId) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ batchId });
    this.loadBatchDetail();
  },

  async loadBatchDetail() {
    const { batchId } = this.data;
    showLoading('加载中...');
    try {
      const batch = await fetchBatchDetail(batchId);
      this.setData({ batch });
    } catch (error) {
      showToast('加载失败');
    } finally {
      hideLoading();
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/submission-detail/index?id=${id}` });
  },

  onRetry() {
    this.loadBatchDetail();
  },
});
