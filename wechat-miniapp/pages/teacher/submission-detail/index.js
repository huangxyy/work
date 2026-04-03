const { fetchSubmissionDetail, addTeacherFeedback, regradeSubmission } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading, confirm } = require('../../../lib/ui');
const { formatDateTime, pickErrorMessage } = require('../../../lib/utils');

Page({
  data: {
    submissionId: '',
    submission: null,
    gradingData: null,
    gradingError: false,
    loading: true,
    feedback: '',
    manualScore: null,
    saving: false,
    regrading: false,
    needRewrite: false,
    displayScore: '--',
    animated: false,
  },

  scoreAnimationTimer: null,

  onLoad(options) {
    const { id } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ submissionId: id });
    this.loadSubmission();
  },

  onPullDownRefresh() {
    this.loadSubmission().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onUnload() {
    this.clearTimer();
  },

  onHide() {
    this.clearTimer();
  },

  clearTimer() {
    if (this.scoreAnimationTimer) {
      clearInterval(this.scoreAnimationTimer);
      this.scoreAnimationTimer = null;
    }
  },

  animateScore(targetScore) {
    if (targetScore === '--' || targetScore === null || targetScore === undefined) {
      this.setData({ displayScore: '--' });
      return;
    }

    const target = Number(targetScore);
    if (isNaN(target)) {
      this.setData({ displayScore: '--' });
      return;
    }

    const duration = 1000;
    const steps = 30;
    const increment = target / steps;
    const stepDuration = duration / steps;

    let current = 0;
    this.setData({ displayScore: 0, animated: false });

    this.scoreAnimationTimer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(this.scoreAnimationTimer);
        this.scoreAnimationTimer = null;
        this.setData({ animated: true });
      }
      this.setData({
        displayScore: Math.round(current),
      });
    }, stepDuration);
  },

  async loadSubmission() {
    const { submissionId } = this.data;
    this.setData({ loading: true, gradingError: false, animated: false });
    this.clearTimer();
    showLoading('加载中...');
    try {
      const submission = await fetchSubmissionDetail(submissionId);
      let gradingData = null;
      let gradingError = false;

      if (submission.gradingJson) {
        try {
          gradingData = typeof submission.gradingJson === 'string'
            ? JSON.parse(submission.gradingJson)
            : submission.gradingJson;

          if (!gradingData || (typeof gradingData !== 'object')) {
            gradingError = true;
            gradingData = null;
          } else {
            gradingData = this.normalizeGradingData(gradingData);
          }
        } catch (e) {
          console.error('解析 gradingJson 失败:', e);
          gradingError = true;
        }
      }

      const feedback = submission.teacherComment || '';
      const manualScore = submission.manualScore !== null && submission.manualScore !== undefined
        ? submission.manualScore
        : null;

      this.setData({
        submission,
        gradingData,
        gradingError,
        feedback,
        manualScore,
      });

      const score = submission.totalScore !== null && submission.totalScore !== undefined
        ? submission.totalScore
        : gradingData && gradingData.totalScore !== undefined
          ? gradingData.totalScore
          : null;

      if (submission.status === 'DONE' && score !== null) {
        this.animateScore(score);
      } else {
        this.setData({ displayScore: score !== null ? score : '--' });
      }
    } catch (error) {
      console.error('加载提交详情失败:', error);
      showToast('加载失败');
    } finally {
      this.setData({ loading: false });
      hideLoading();
    }
  },

  normalizeGradingData(data) {
    const result = {
      totalScore: data.totalScore,
      scores: [],
      comment: data.summary || data.comment || '',
      rewrite: data.suggestions?.rewrite || data.rewrite || '',
      errorTypes: [],
    };

    if (data.dimensionScores) {
      const dimLabels = {
        grammar: '语法',
        vocabulary: '词汇',
        structure: '结构',
        content: '内容',
        coherence: '连贯',
        handwritingClarity: '书写',
      };
      Object.keys(data.dimensionScores).forEach(key => {
        result.scores.push({
          category: dimLabels[key] || key,
          score: data.dimensionScores[key],
        });
      });
    }

    if (data.errors && Array.isArray(data.errors)) {
      const typeCount = {};
      data.errors.forEach(err => {
        const type = err.type || '其他';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      result.errorTypes = Object.keys(typeCount).map(type => ({
        type,
        count: typeCount[type],
      }));
    }

    return result;
  },

  onViewImage(e) {
    const { url } = e.currentTarget.dataset;
    const submission = this.data.submission;
    let urls = [url];

    if (submission && submission.images && submission.images.length > 0) {
      urls = submission.images.map(img => img.url);
    }

    wx.previewImage({
      urls,
      current: url,
    });
  },

  onFeedbackInput(e) {
    this.setData({ feedback: e.detail.value });
  },

  onManualScoreInput(e) {
    const value = e.detail.value;
    const score = value === '' ? null : Math.min(100, Math.max(0, parseInt(value) || 0));
    this.setData({ manualScore: score });
  },

  onNeedRewriteChange(e) {
    this.setData({ needRewrite: e.detail.value });
  },

  async onSubmitFeedback() {
    const { submissionId, feedback, manualScore } = this.data;

    this.setData({ saving: true });
    showLoading('保存中...');
    try {
      await addTeacherFeedback(submissionId, {
        comment: feedback || undefined,
        manualScore: manualScore,
      });
      hideLoading();
      showToast('评语已保存', 'success');
      this.loadSubmission();
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '保存失败'));
    } finally {
      this.setData({ saving: false });
    }
  },

  async onRegrade(e) {
    const { mode } = e.currentTarget.dataset;
    const { submissionId, needRewrite } = this.data;

    const confirmed = await confirm({
      title: '重新批改',
      content: mode === 'quality' ? '使用高质量模式重新批改，耗时较长但结果更详细。确定继续？' : '使用快速模式重新批改。确定继续？',
      confirmText: '确定',
    });

    if (!confirmed) return;

    this.setData({ regrading: true });
    showLoading('提交中...');
    try {
      await regradeSubmission(submissionId, {
        mode: mode || 'cheap',
        needRewrite: needRewrite,
      });
      hideLoading();
      showToast('已提交重新批改', 'success');
      setTimeout(() => {
        this.loadSubmission();
      }, 1000);
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '提交失败'));
    } finally {
      this.setData({ regrading: false });
    }
  },

  onRetry() {
    this.loadSubmission();
  },
});
