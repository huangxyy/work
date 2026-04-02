const { fetchStudentSubmissions, deleteSubmission } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    studentId: '',
    studentName: '学生',
    studentAccount: '',
    classId: '',
    submissions: [],
    loading: false,
    stats: {
      totalHomeworks: 0,
      submittedCount: 0,
      unsubmittedCount: 0,
      averageScore: 0,
      completionRate: 0,
    },
    // 批量操作相关
    selectMode: false,
    selectedCount: 0,
    showDeleteConfirm: false,
  },

  onLoad(options) {
    const { studentId, studentName, studentAccount, classId } = options;
    if (!studentId) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({
      studentId,
      studentName: studentName || '学生',
      studentAccount: studentAccount || '',
      classId: classId || '',
    });
    this.loadData();
  },

  async loadData() {
    const { studentId, classId } = this.data;

    if (!classId) {
      showToast('缺少班级信息');
      return;
    }

    this.setData({ loading: true });
    try {
      // 使用优化的 API 一次性获取学生在班级中的所有提交记录
      const submissions = await fetchStudentSubmissions(studentId, classId);

      if (!submissions || submissions.length === 0) {
        this.setData({
          submissions: [],
          stats: {
            totalHomeworks: 0,
            submittedCount: 0,
            unsubmittedCount: 0,
            averageScore: 0,
            completionRate: 0,
          },
        });
        return;
      }

      // 分离有提交和未提交的记录
      const submittedSubmissions = submissions.filter(s => s.submitted);

      // 计算统计数据
      const totalHomeworks = submissions.length || 0;
      const submittedCount = submittedSubmissions.length || 0;
      const unsubmittedCount = totalHomeworks - submittedCount;

      // 计算平均分（只统计已完成的提交）
      const completedSubmissions = submittedSubmissions.filter(s =>
        s.status === 'DONE' && s.totalScore !== null && typeof s.totalScore === 'number'
      );
      let averageScore = 0;
      if (completedSubmissions.length > 0) {
        const totalScore = completedSubmissions.reduce((sum, s) => sum + s.totalScore, 0);
        averageScore = Math.round(totalScore / completedSubmissions.length);
      }

      // 计算完成率（修正逻辑：已提交 / 总作业数）
      const completionRate = totalHomeworks > 0 ? Math.round((submittedCount / totalHomeworks) * 100) : 0;

      // 在列表中只显示有提交记录的作业
      this.setData({
        submissions: submittedSubmissions.map(s => ({ ...s, selected: false })),
        stats: {
          totalHomeworks,
          submittedCount,
          unsubmittedCount,
          averageScore,
          completionRate,
        },
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      showToast('加载数据失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  // 进入选择模式
  onSelectMode() {
    this.setData({
      selectMode: true,
      selectedCount: 0,
    });
  },

  // 退出选择模式
  exitSelectMode() {
    const submissions = this.data.submissions.map(s => ({ ...s, selected: false }));
    this.setData({
      selectMode: false,
      selectedCount: 0,
      submissions,
    });
  },

  // 选择模式下的卡片点击
  onSelectModeTap(e) {
    if (!this.data.selectMode) return;

    const { id } = e.currentTarget.dataset;
    const submissions = this.data.submissions.map(s => {
      if (s.id === id) {
        return { ...s, selected: !s.selected };
      }
      return s;
    });

    const selectedCount = submissions.filter(s => s.selected).length;
    this.setData({ submissions, selectedCount });
  },

  // 查看提交详情
  onViewSubmission(e) {
    if (this.data.selectMode) return; // 选择模式下不跳转

    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/submission-detail/index?id=${id}`,
    });
  },

  // 批量删除
  onBatchDelete() {
    if (this.data.selectedCount === 0) {
      showToast('请先选择要删除的项');
      return;
    }
    this.setData({ showDeleteConfirm: true });
  },

  // 取消删除
  onCancelDelete() {
    this.setData({ showDeleteConfirm: false });
  },

  // 确认删除
  async onConfirmDelete() {
    const selectedSubmissions = this.data.submissions.filter(s => s.selected);

    if (selectedSubmissions.length === 0) {
      this.setData({ showDeleteConfirm: false });
      return;
    }

    showLoading('删除中...');

    try {
      let successCount = 0;
      let failCount = 0;

      // 逐个删除
      for (const submission of selectedSubmissions) {
        try {
          await deleteSubmission(submission.id);
          successCount++;
        } catch (error) {
          console.error(`删除提交 ${submission.id} 失败:`, error);
          failCount++;
        }
      }

      hideLoading();

      if (failCount > 0) {
        showToast(`成功删除 ${successCount} 项，失败 ${failCount} 项`);
      } else {
        showToast(`已删除 ${successCount} 项`);
      }

      // 退出选择模式并重新加载数据
      this.exitSelectMode();
      this.setData({ showDeleteConfirm: false });
      this.loadData();
    } catch (error) {
      hideLoading();
      console.error('批量删除失败:', error);
      showToast('删除失败，请重试');
    }
  },

  // 批量导出
  onBatchExport() {
    const selectedSubmissions = this.data.submissions.filter(s => s.selected);

    if (selectedSubmissions.length === 0) {
      showToast('请先选择要导出的项');
      return;
    }

    // 生成导出数据
    const exportData = selectedSubmissions.map(s => ({
      作业: s.homeworkTitle,
      得分: s.totalScore !== null ? s.totalScore : '未批改',
      状态: this.getStatusText(s.status),
      提交时间: s.submittedAt ? new Date(s.submittedAt).toLocaleString('zh-CN') : '-',
    }));

    console.log('导出数据:', exportData);

    // 复制到剪贴板
    const text = exportData.map(item =>
      `${item.作业}\t得分: ${item.得分}\t状态: ${item.状态}\t提交时间: ${item.提交时间}`
    ).join('\n');

    wx.setClipboardData({
      data: text,
      success: () => {
        showToast('已复制到剪贴板，可粘贴到Excel');
      },
      fail: () => {
        showToast('复制失败，请重试');
      }
    });
  },

  getStatusText(status) {
    const statusMap = {
      DONE: '已完成',
      PROCESSING: '批改中',
      QUEUED: '排队中',
      FAILED: '失败',
      NOT_SUBMITTED: '未提交',
    };
    return statusMap[status] || status;
  },

  onViewHomeworks() {
    const { classId } = this.data;
    if (classId) {
      wx.navigateTo({
        url: `/pages/teacher/homeworks/index?classId=${classId}`,
      });
    } else {
      wx.navigateTo({
        url: '/pages/teacher/homeworks/index',
      });
    }
  },

  onViewAllSubmissions() {
    const { classId, studentId } = this.data;
    // 暂时提示功能开发中
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },
});
