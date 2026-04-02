const { fetchHomeworks, fetchSubmissions } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText, formatDateTime } = require('../../../lib/teacher');

Page({
  data: {
    homeworkId: '',
    homework: null,
    submissions: [],
    loading: false,
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ homeworkId: id });
    this.loadData();
  },

  async loadData() {
    const { homeworkId } = this.data;
    this.setData({ loading: true });
    try {
      const [homeworks, submissions] = await Promise.all([
        fetchHomeworks(),
        fetchSubmissions(homeworkId),
      ]);
      const homework = homeworks.find(h => h.id === homeworkId);
      this.setData({ homework, submissions });
    } catch (error) {
      showToast('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onUploadBatch() {
    const { homeworkId } = this.data;
    wx.navigateTo({ url: `/pages/teacher/capture/index?homeworkId=${homeworkId}` });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/submission-detail/index?id=${id}` });
  },

  onRefresh() {
    this.loadData();
  },
});
