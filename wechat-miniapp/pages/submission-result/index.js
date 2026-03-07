const { fetchSubmission } = require('../../services/submissions');
const { ensureLogin } = require('../../lib/page');
const { showToast } = require('../../lib/ui');
const { formatDateTime, getSubmissionStatus, safeJsonParse, pickErrorMessage } = require('../../lib/utils');

Page({
  data: {
    id: '',
    loading: true,
    errorText: '',
    submission: null,
    statusMeta: null,
    grading: null,
    dimensionScores: null,
    score: '--',
    updatedLabel: '',
    timeline: [],
    isFailed: false,
    errorCount: 0,
    nextStepCount: 0,
    imageCount: 0,
    isPolling: false,
    pollingHint: '',
    hasNextSteps: false,
    hasErrors: false,
    hasTeacherFeedback: false,
  },
  timer: null,
  onLoad(options) {
    this.setData({
      id: options && options.id ? options.id : '',
    });
  },
  onShow() {
    if (!ensureLogin(`/pages/submission-result/index?id=${this.data.id}`)) {
      return;
    }
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData(true);
  },
  onUnload() {
    this.clearTimer();
  },
  onHide() {
    this.clearTimer();
  },
  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },
  async loadData(fromPullDown) {
    const id = this.data.id;
    if (!id) {
      this.setData({ loading: false, errorText: '缺少提交标识' });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
      return;
    }
    this.clearTimer();
    this.setData({ loading: true, errorText: '' });
    try {
      const submission = await fetchSubmission(id);
      const statusMeta = getSubmissionStatus(submission.status);
      const grading = safeJsonParse(submission.gradingJson, null);
      const dimensionScores = grading && grading.dimensionScores ? grading.dimensionScores : null;
      const errorCount = grading && Array.isArray(grading.errors) ? grading.errors.length : 0;
      const nextStepCount = grading && Array.isArray(grading.nextSteps) ? grading.nextSteps.length : 0;
      const imageCount = submission.images && Array.isArray(submission.images) ? submission.images.length : 0;
      const hasTeacherFeedback = Boolean(
        submission.teacherComment
        || submission.manualScore === 0
        || submission.manualScore,
      );
      const timeline = [
        { key: 'queued', label: '已进入队列', active: true },
        { key: 'processing', label: 'OCR / AI 批改中', active: submission.status !== 'QUEUED' },
        { key: 'done', label: '批改完成', active: submission.status === 'DONE' },
        { key: 'failed', label: '处理失败', active: submission.status === 'FAILED' },
      ];
      const pollDelay = submission.status === 'QUEUED'
        ? 2000
        : submission.status === 'PROCESSING'
          ? 4000
          : 0;
      const isPolling = pollDelay > 0;
      const pollingHint = submission.status === 'QUEUED'
        ? '当前仍在排队，页面会每 2 秒自动刷新一次。'
        : submission.status === 'PROCESSING'
          ? '正在执行 OCR 与 AI 批改，页面会每 4 秒自动刷新一次。'
          : '';
      this.setData({
        submission,
        statusMeta,
        grading,
        dimensionScores,
        score: submission.totalScore !== null && submission.totalScore !== undefined ? submission.totalScore : grading && grading.totalScore !== undefined ? grading.totalScore : '--',
        updatedLabel: submission.updatedAt ? formatDateTime(submission.updatedAt) : '暂无时间',
        timeline,
        isFailed: submission.status === 'FAILED',
        errorCount,
        nextStepCount,
        imageCount,
        isPolling,
        pollingHint,
        hasNextSteps: nextStepCount > 0,
        hasErrors: errorCount > 0,
        hasTeacherFeedback,
      });
      if (pollDelay > 0) {
        this.timer = setTimeout(() => {
          this.loadData();
        }, pollDelay);
      }
    } catch (error) {
      const errorText = pickErrorMessage(error, '结果加载失败');
      this.setData({ errorText, isPolling: false, pollingHint: '' });
      showToast(errorText);
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
  previewImage(event) {
    const { current } = event.currentTarget.dataset;
    if (!current || !this.data.submission || !this.data.submission.images) {
      return;
    }
    wx.previewImage({
      current,
      urls: this.data.submission.images.map((item) => item.url),
    });
  },
  goResubmit() {
    const homework = this.data.submission && this.data.submission.homework;
    if (!homework || !homework.id) {
      return;
    }
    wx.redirectTo({
      url: `/pages/submit/index?homeworkId=${homework.id}`,
    });
  },
  goHomeworkDetail() {
    const homework = this.data.submission && this.data.submission.homework;
    if (!homework || !homework.id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/homework-detail/index?id=${homework.id}`,
    });
  },
  goSubmissions() {
    wx.switchTab({
      url: '/pages/submissions/index',
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
})
