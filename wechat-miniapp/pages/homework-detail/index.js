const { fetchStudentHomeworks } = require('../../services/homeworks');
const { fetchStudentSubmissions } = require('../../services/submissions');
const { hasSubmitDraft } = require('../../lib/draft');
const { ensureLogin } = require('../../lib/page');
const { showToast } = require('../../lib/ui');
const { formatDateTime, getHomeworkStatus, getSubmissionStatus, pickErrorMessage } = require('../../lib/utils');

Page({
  data: {
    id: '',
    loading: true,
    errorText: '',
    homework: null,
    status: null,
    dueLabel: '',
    canSubmit: false,
    hasDraft: false,
    latestSubmission: null,
    history: [],
  },
  onLoad(options) {
    this.setData({ id: options && options.id ? options.id : '' });
  },
  onShow() {
    if (!ensureLogin(`/pages/homework-detail/index?id=${this.data.id}`)) {
      return;
    }
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData(true);
  },
  async loadData(fromPullDown) {
    const id = this.data.id;
    if (!id) {
      this.setData({ loading: false, errorText: '缺少作业标识' });
      return;
    }
    this.setData({ loading: true, errorText: '' });
    try {
      const [homeworks, submissions] = await Promise.all([
        fetchStudentHomeworks(),
        fetchStudentSubmissions({ homeworkId: id }),
      ]);
      const homework = (homeworks || []).find((item) => item.id === id) || null;
      if (!homework) {
        this.setData({ loading: false, errorText: '未找到对应作业' });
        return;
      }
      const status = getHomeworkStatus(homework.dueAt, homework.allowLateSubmission);
      const history = (submissions || []).map((item) => ({
        ...item,
        statusMeta: getSubmissionStatus(item.status),
        updatedLabel: item.updatedAt ? formatDateTime(item.updatedAt) : '暂无时间',
        scoreLabel: item.totalScore !== null && item.totalScore !== undefined ? item.totalScore : '--',
      })).sort((left, right) => {
        const leftValue = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightValue = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightValue - leftValue;
      });
      this.setData({
        homework,
        status,
        dueLabel: homework.dueAt ? formatDateTime(homework.dueAt) : '灵活截止',
        canSubmit: status.key !== 'overdue',
        hasDraft: hasSubmitDraft(homework.id),
        latestSubmission: history[0] || null,
        history,
      });
    } catch (error) {
      const errorText = pickErrorMessage(error, '作业详情加载失败');
      this.setData({ errorText });
      showToast(errorText);
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
  goSubmit() {
    if (!this.data.homework) {
      return;
    }
    if (!this.data.canSubmit) {
      showToast('该作业已截止，当前不可提交');
      return;
    }
    wx.navigateTo({
      url: `/pages/submit/index?homeworkId=${this.data.homework.id}`,
    });
  },
  goResult(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/submission-result/index?id=${id}`,
    });
  },
  goAllSubmissions() {
    wx.switchTab({
      url: '/pages/submissions/index',
    });
  },
  goLatestResult() {
    const latestSubmission = this.data.latestSubmission;
    if (!latestSubmission || !latestSubmission.id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/submission-result/index?id=${latestSubmission.id}`,
    });
  },
  goReport() {
    wx.navigateTo({
      url: '/pages/report/index',
    });
  },
  retryLoad() {
    this.loadData();
  },
});
