const { fetchClasses, fetchClassStudents } = require('../../../services/teacher');
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
    isLoadingDetail: false, // 防止重复加载
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
      if (classes && classes.length > 0) {
        const selectedClassId = this.data.selectedClassId || classes[0].id;
        const selectedIndex = classes.findIndex(c => c.id === selectedClassId);
        const index = selectedIndex >= 0 ? selectedIndex : 0;
        const selectedClass = classes[index];
        const selectedClassName = selectedClass ? selectedClass.name : '请选择班级';
        this.setData({
          classes,
          selectedClassId: selectedClass ? selectedClass.id : '',
          selectedIndex: index,
          selectedClassName,
        });
        this.loadClassDetail();
      } else {
        this.setData({
          classes: [],
          selectedClassId: '',
          selectedIndex: 0,
          selectedClassName: '暂无班级',
          classDetail: null,
          studentCount: 0,
        });
      }
    } catch (error) {
      console.error('加载班级失败:', error);
      showToast('加载班级失败');
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadClassDetail() {
    const { selectedClassId, classes, isLoadingDetail } = this.data;
    if (!selectedClassId || isLoadingDetail) return;

    this.setData({ isLoadingDetail: true, loadingDetail: true });
    try {
      // 获取班级基本信息（从已加载的列表中）
      const classInfo = classes.find(c => c.id === selectedClassId);
      if (!classInfo) {
        showToast('班级信息错误');
        return;
      }
      // 获取学生列表
      const students = await fetchClassStudents(selectedClassId);
      const studentCount = students ? students.length : 0;
      this.setData({
        classDetail: {
          ...classInfo,
          students: students || [],
        },
        studentCount,
      });
    } catch (error) {
      console.error('加载班级详情失败:', error);
      showToast('加载班级详情失败');
    } finally {
      this.setData({ loadingDetail: false, isLoadingDetail: false });
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

  onClassSelect(e) {
    const { id } = e.currentTarget.dataset;
    const selectedClass = this.data.classes.find(c => c.id === id);
    if (selectedClass && selectedClass.id !== this.data.selectedClassId) {
      const index = this.data.classes.findIndex(c => c.id === id);
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
    const { id, name, account } = e.currentTarget.dataset;
    const { selectedClassId } = this.data;
    if (id) {
      const params = [
        `studentId=${id}`,
        `studentName=${encodeURIComponent(name || '学生')}`,
        `studentAccount=${encodeURIComponent(account || '')}`,
        `classId=${selectedClassId || ''}`,
      ].join('&');
      wx.navigateTo({
        url: `/pages/teacher/student-submissions/index?${params}`,
      });
    }
  },

  // 跳转到班级作业
  goToClassHomeworks() {
    const { selectedClassId, selectedClassName } = this.data;
    
    if (!selectedClassId) {
      showToast('请先选择班级');
      return;
    }
    
    getApp().globalData.selectedClassId = selectedClassId;
    wx.switchTab({
      url: '/pages/teacher/homeworks/index',
    });
  },

  goToClassReport() {
    const { selectedClassId, selectedClassName } = this.data;
    
    if (!selectedClassId) {
      showToast('请先选择班级');
      return;
    }
    
    getApp().globalData.selectedClassId = selectedClassId;
    wx.switchTab({
      url: '/pages/teacher/report/index',
    });
  },
});
