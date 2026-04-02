const { fetchBatchDetail, retrySkipped } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

Page({
  data: {
    batchId: '',
    batch: null,
    loading: true,
  },

  onLoad(options) {
    const { batchId } = options;
    if (!batchId) {
      showToast('参数错误');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    this.setData({ batchId });
    this.loadBatchDetail();
  },

  async loadBatchDetail() {
    const { batchId } = this.data;
    this.setData({ loading: true });
    try {
      const batch = await fetchBatchDetail(batchId);
      this.setData({ batch });
    } catch (error) {
      console.error('加载批次详情失败:', error);
      showToast(pickErrorMessage(error, '加载失败'));
    } finally {
      this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.loadBatchDetail().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/submission-detail/index?id=${id}`,
    });
  },

  async onRetrySkipped() {
    const { batch, batchId } = this.data;

    if (!batch || !batch.skipped || batch.skipped.length === 0) {
      showToast('没有需要重试的项目');
      return;
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认重试',
        content: `确定要重新处理 ${batch.skipped.length} 个跳过的项目吗？`,
        confirmText: '重试',
        confirmColor: '#10b981',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    showLoading('处理中...');
    try {
      const result = await retrySkipped({
        batchId,
        files: batch.skipped.map(item => ({ file: item.file })),
      });

      hideLoading();

      if (result && result.processed > 0) {
        showToast(`成功处理 ${result.processed} 项`, 'success');
        // 重新加载批次详情
        this.loadBatchDetail();
      } else {
        showToast('没有成功处理任何项目');
      }
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '重试失败'));
    }
  },

  onRetry() {
    this.loadBatchDetail();
  },

  onBackToList() {
    wx.navigateBack();
  },

  onGoToHomeworks() {
    wx.switchTab({
      url: '/pages/teacher/homeworks/index',
    });
  },
});
