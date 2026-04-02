const { fetchHomeworks, fetchClasses, deleteHomework } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const { formatDate, getHomeworkStatusText } = require('../../../lib/teacher');

Page({
  data: {
    homeworks: [],
    classes: [],
    selectedClassId: '',
    loading: false,
  },

  onLoad() {
    this.loadClasses();
    this.loadHomeworks();
  },

  onShow() {
    if (this.data.homeworks.length > 0) {
      this.loadHomeworks();
    }
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes, selectedClassId: classes[0]?.id || '' });
    } catch (error) {
      console.error('加载班级失败:', error);
    }
  },

  async loadHomeworks() {
    const { selectedClassId } = this.data;
    this.setData({ loading: true });
    try {
      const homeworks = await fetchHomeworks({ classId: selectedClassId });
      this.setData({ homeworks });
    } catch (error) {
      showToast(pickErrorMessage(error, '加载作业失败'));
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    this.setData({ selectedClassId: e.detail.value });
    this.loadHomeworks();
  },

  onAddHomework() {
    wx.navigateTo({ url: '/pages/teacher/homework-edit/index' });
  },

  onHomeworkTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/homework-detail/index?id=${id}` });
  },

  async onDeleteHomework(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    if (!homework) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除作业"${homework.title}"吗？`,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    showLoading('删除中...');
    try {
      await deleteHomework(id);
      showToast('删除成功', 'success');
      this.loadHomeworks();
    } catch (error) {
      showToast(pickErrorMessage(error, '删除失败'));
    } finally {
      hideLoading();
    }
  },
});
