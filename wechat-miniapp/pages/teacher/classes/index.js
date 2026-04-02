const { fetchClasses, fetchClassDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { ensureLogin } = require('../../../lib/page');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    selectedIndex: 0,
    classDetail: null,
    loading: false,
    loadingDetail: false,
  },

  onLoad() {
    if (!ensureLogin('/pages/teacher/classes/index')) {
      return;
    }
    this.loadClasses();
  },

  onPullDownRefresh() {
    this.loadClasses(true);
  },

  async loadClasses(fromPullDown = false) {
    this.setData({ loading: true });
    try {
      const classes = await fetchClasses();
      const selectedClassId = this.data.selectedClassId || (classes.length > 0 ? classes[0].id : '');
      const selectedIndex = classes.findIndex(c => c.id === selectedClassId);
      this.setData({
        classes,
        selectedClassId: classes.length > 0 ? classes[selectedIndex >= 0 ? selectedIndex : 0].id : '',
        selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
      });
      if (classes.length > 0) {
        this.loadClassDetail();
      }
    } catch (error) {
      showToast('加载班级失败');
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadClassDetail() {
    const { selectedClassId } = this.data;
    if (!selectedClassId) return;

    this.setData({ loadingDetail: true });
    try {
      const classDetail = await fetchClassDetail(selectedClassId);
      this.setData({ classDetail });
    } catch (error) {
      showToast('加载班级详情失败');
    } finally {
      this.setData({ loadingDetail: false });
    }
  },

  onClassChange(e) {
    const index = parseInt(e.detail.value);
    const selectedClass = this.data.classes[index];
    if (selectedClass) {
      this.setData({
        selectedClassId: selectedClass.id,
        selectedIndex: index,
      });
      this.loadClassDetail();
    }
  },

  // 查看学生详情
  onStudentTap(e) {
    const { studentId } = e.currentTarget.dataset;
    if (studentId) {
      wx.navigateTo({
        url: `/pages/teacher/submission-detail/index?studentId=${studentId}`,
      });
    }
  },

  // 跳转到班级作业
  goToClassHomeworks() {
    const { selectedClassId } = this.data;
    if (selectedClassId) {
      wx.navigateTo({
        url: `/pages/teacher/homeworks/index?classId=${selectedClassId}`,
      });
    }
  },

  // 跳转到班级报告
  goToClassReport() {
    const { selectedClassId } = this.data;
    if (selectedClassId) {
      wx.navigateTo({
        url: `/pages/teacher/reports/index?classId=${selectedClassId}`,
      });
    }
  },
});
