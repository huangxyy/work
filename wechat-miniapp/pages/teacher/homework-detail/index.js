const { fetchHomeworkById, fetchSubmissions, deleteHomework } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

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
      const [homework, submissions] = await Promise.all([
        fetchHomeworkById(homeworkId),
        fetchSubmissions({ homeworkId }),
      ]);
      const classId = homework?.classId || homework?.class?.id || this.data.classId || '';
      this.setData({ homework, submissions, classId });
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
    const { homeworkId, classId } = this.data;
    wx.navigateTo({ 
      url: `/pages/teacher/capture/index?homeworkId=${homeworkId}&classId=${classId}` 
    });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/submission-detail/index?id=${id}` });
  },

  onRefresh() {
    this.loadData();
  },

  onMoreActions() {
    const { homeworkId } = this.data;
    wx.showActionSheet({
      itemList: ['编辑作业', '删除作业'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.onEditHomework();
        } else if (res.tapIndex === 1) {
          this.onDeleteHomework();
        }
      },
    });
  },

  onEditHomework() {
    const { homeworkId, classId } = this.data;
    wx.navigateTo({
      url: `/pages/teacher/homework-edit/index?homeworkId=${homeworkId}&classId=${classId}`
    });
  },

  onDeleteHomework() {
    const { homework } = this.data;
    if (!homework) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除作业"${homework.title}"吗？删除后无法恢复。`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          showLoading('删除中...');
          try {
            await deleteHomework(this.data.homeworkId);
            hideLoading();
            showToast('删除成功', 'success');
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            hideLoading();
            const errorMsg = pickErrorMessage(error, '删除失败');
            
            if (errorMsg.includes('still queued') || errorMsg.includes('being graded')) {
              wx.showModal({
                title: '无法删除',
                content: '有提交正在批改中，是否强制删除？（未完成的批改将丢失）',
                confirmText: '强制删除',
                confirmColor: '#ef4444',
                success: async (res2) => {
                  if (res2.confirm) {
                    showLoading('删除中...');
                    try {
                      await deleteHomework(this.data.homeworkId, true);
                      hideLoading();
                      showToast('删除成功', 'success');
                      setTimeout(() => {
                        wx.navigateBack();
                      }, 1500);
                    } catch (err2) {
                      hideLoading();
                      showToast(pickErrorMessage(err2, '删除失败'));
                    }
                  }
                },
              });
            } else {
              showToast(errorMsg);
            }
          }
        }
      },
    });
  },
});
