const { fetchSubmissionDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    submissionId: '',
    submission: null,
    gradingData: null,
    gradingError: false,
    loading: true,
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

  onPullDownRefresh() {
    this.loadSubmission().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadSubmission() {
    const { submissionId } = this.data;
    this.setData({ loading: true, gradingError: false });
    showLoading('加载中...');
    try {
      const submission = await fetchSubmissionDetail(submissionId);
      let gradingData = null;
      let gradingError = false;

      if (submission.gradingJson) {
        try {
          gradingData = typeof submission.gradingJson === 'string'
            ? JSON.parse(submission.gradingJson)
            : submission.gradingJson;

          // 检查解析后的数据是否有效
          if (!gradingData || (typeof gradingData !== 'object')) {
            gradingError = true;
            gradingData = null;
          }
        } catch (e) {
          console.error('解析 gradingJson 失败:', e);
          gradingError = true;
        }
      }

      this.setData({
        submission,
        gradingData,
        gradingError,
      });
    } catch (error) {
      console.error('加载提交详情失败:', error);
      showToast('加载失败');
    } finally {
      this.setData({ loading: false });
      hideLoading();
    }
  },

  onViewImage(e) {
    const { url } = e.currentTarget.dataset;
    const submission = this.data.submission;
    let urls = [url];

    if (submission && submission.images && submission.images.length > 0) {
      urls = submission.images.map(img => img.url);
    }

    wx.previewImage({
      urls,
      current: url,
    });
  },

  onRetry() {
    this.loadSubmission();
  },
});
