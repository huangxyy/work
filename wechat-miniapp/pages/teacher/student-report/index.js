const { fetchStudentSubmissions } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

Page({
  data: {
    studentId: '',
    classId: '',
    student: null,
    submissions: [],
    loading: true,
    stats: {
      total: 0,
      avgScore: 0,
      highScore: 0,
      lowScore: 0,
    },
  },

  onLoad(options) {
    const { studentId, classId } = options;
    if (!studentId) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    
    let cid = classId;
    if (!cid) {
      try {
        cid = wx.getStorageSync('selectedClassId') || '';
      } catch (e) {
        cid = '';
      }
    }
    
    if (!cid) {
      try {
        cid = getApp().globalData.selectedClassId || '';
      } catch (e) {
        cid = '';
      }
    }
    
    this.setData({ studentId, classId: cid });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    const { studentId, classId } = this.data;
    
    if (!classId) {
      showToast('缺少班级信息');
      this.setData({ loading: false });
      return;
    }
    
    this.setData({ loading: true });
    showLoading('加载中...');
    try {
      const result = await fetchStudentSubmissions(studentId, classId);
      const submissions = result.submissions || [];
      const student = result.student || null;

      const scores = submissions
        .filter(s => s.totalScore !== null && s.totalScore !== undefined)
        .map(s => s.totalScore);

      const stats = {
        total: submissions.length,
        avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0,
        highScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowScore: scores.length > 0 ? Math.min(...scores) : 0,
      };

      this.setData({
        student,
        submissions,
        stats,
      });
    } catch (error) {
      showToast(pickErrorMessage(error, '加载失败'));
    } finally {
      this.setData({ loading: false });
      hideLoading();
    }
  },

  goSubmissionDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/teacher/submission-detail/index?id=${id}`,
    });
  },
});
