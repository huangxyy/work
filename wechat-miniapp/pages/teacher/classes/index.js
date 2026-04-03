const { fetchClasses, fetchClassStudents, deleteClass, importStudents, removeStudent } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading, showConfirm } = require('../../../lib/ui');
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
    isLoadingDetail: false,
    showStudentModal: false,
    studentInputText: '',
    showClassActions: false,
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
      const classInfo = classes.find(c => c.id === selectedClassId);
      if (!classInfo) {
        showToast('班级信息错误');
        return;
      }
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

  showClassActionSheet() {
    const { selectedClassId } = this.data;
    if (!selectedClassId) {
      showToast('请先选择班级');
      return;
    }
    wx.showActionSheet({
      itemList: ['导入学生', '删除班级'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.openStudentModal();
        } else if (res.tapIndex === 1) {
          this.confirmDeleteClass();
        }
      },
    });
  },

  openStudentModal() {
    this.setData({ showStudentModal: true, studentInputText: '' });
  },

  closeStudentModal() {
    this.setData({ showStudentModal: false, studentInputText: '' });
  },

  onStudentInputChange(e) {
    this.setData({ studentInputText: e.detail.value });
  },

  async confirmImportStudents() {
    const { selectedClassId, studentInputText } = this.data;
    if (!studentInputText.trim()) {
      showToast('请输入学生信息');
      return;
    }

    const lines = studentInputText.trim().split('\n');
    const students = lines
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          return { name: parts[0], account: parts[1] };
        } else if (parts.length === 1 && parts[0]) {
          return { name: parts[0], account: parts[0] };
        }
        return null;
      })
      .filter(s => s !== null);

    if (students.length === 0) {
      showToast('请输入有效的学生信息');
      return;
    }

    showLoading('导入中...');
    try {
      await importStudents(selectedClassId, students);
      showToast('导入成功');
      this.closeStudentModal();
      this.loadClassDetail();
    } catch (error) {
      console.error('导入学生失败:', error);
      showToast('导入失败');
    } finally {
      hideLoading();
    }
  },

  async confirmDeleteClass() {
    const { selectedClassId, selectedClassName } = this.data;
    
    wx.showModal({
      title: '删除班级',
      content: `确定要删除班级"${selectedClassName}"吗？此操作不可恢复。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          showLoading('删除中...');
          try {
            await deleteClass(selectedClassId);
            showToast('删除成功');
            this.setData({ selectedClassId: '', classDetail: null });
            this.loadClasses();
          } catch (error) {
            console.error('删除班级失败:', error);
            showToast('删除失败');
          } finally {
            hideLoading();
          }
        }
      },
    });
  },

  async onRemoveStudent(e) {
    const { id, name } = e.currentTarget.dataset;
    const { selectedClassId } = this.data;
    
    wx.showModal({
      title: '移除学生',
      content: `确定要将"${name}"从班级中移除吗？`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          showLoading('移除中...');
          try {
            await removeStudent(selectedClassId, id);
            showToast('移除成功');
            this.loadClassDetail();
          } catch (error) {
            console.error('移除学生失败:', error);
            showToast('移除失败');
          } finally {
            hideLoading();
          }
        }
      },
    });
  },
});
