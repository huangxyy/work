const { fetchClasses, fetchClassDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { ensureLogin } = require('../../../lib/page');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    selectedIndex: 0,
    selectedClassName: '请选择班级',
    classDetail: null,
    loading: false,
    loadingDetail: false,
    studentCount: 0,
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
      const selectedClass = classes[selectedIndex >= 0 ? selectedIndex : 0];
      const selectedClassName = selectedClass ? selectedClass.name : '请选择班级';
      this.setData({
        classes,
        selectedClassId: selectedClass ? selectedClass.id : '',
        selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
        selectedClassName,
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
      const students = classDetail.students || [];
      const studentCount = students.length;
      this.setData({ classDetail, studentCount });
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
        selectedClassName: selectedClass.name,
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
