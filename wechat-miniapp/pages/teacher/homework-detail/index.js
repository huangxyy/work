const { fetchHomeworkById, fetchSubmissions } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    homeworkId: '',
    classId: '',
    homework: null,
    submissions: [],
    loading: false,
  },

  onLoad(options) {
    const { id, classId } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ homeworkId: id, classId: classId || '' });
    this.loadData();
  },

  onShow() {
    if (this.data.homeworkId && !this.data.loading) {
      this.loadData();
    }
  },

  async loadData() {
    const { homeworkId } = this.data;
    this.setData({ loading: true });
    try {
      // 使用优化的 API 直接获取作业详情
      const [homework, submissions] = await Promise.all([
        fetchHomeworkById(homeworkId),
        fetchSubmissions({ homeworkId }),
      ]);
      this.setData({ homework, submissions });
    } catch (error) {
      showToast('加载失败');
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.loadData();
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
