const { fetchStudentSubmissions } = require('../../services/submissions');
const { ensureLogin } = require('../../lib/page');
const { showToast } = require('../../lib/ui');
const { formatDateTime, getSubmissionStatus, pickErrorMessage } = require('../../lib/utils');

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '排队中', value: 'QUEUED' },
  { label: '批改中', value: 'PROCESSING' },
  { label: '已完成', value: 'DONE' },
  { label: '失败', value: 'FAILED' },
];

const FILTER_STORAGE_KEY = 'submissions_filter_state';

function getStoredFilters() {
  try {
    const stored = wx.getStorageSync(FILTER_STORAGE_KEY) || {};
    const statusIndex = Number(stored.statusIndex);
    return {
      keyword: typeof stored.keyword === 'string' ? stored.keyword : '',
      statusIndex: Number.isInteger(statusIndex) && statusIndex >= 0 && statusIndex < STATUS_OPTIONS.length ? statusIndex : 0,
      scoreMin: typeof stored.scoreMin === 'string' ? stored.scoreMin : '',
      scoreMax: typeof stored.scoreMax === 'string' ? stored.scoreMax : '',
    };
  } catch (_error) {
    return {
      keyword: '',
      statusIndex: 0,
      scoreMin: '',
      scoreMax: '',
    };
  }
}

function enrichList(list) {
  return (list || []).map((item) => ({
    ...item,
    statusMeta: getSubmissionStatus(item.status),
    updatedLabel: item.updatedAt ? formatDateTime(item.updatedAt) : '暂无时间',
    imageCountLabel: item.imageCount || 0,
    scoreLabel: typeof item.totalScore === 'number' ? `${item.totalScore}` : '--',
    errorText: item.errorMsg || item.errorCode || '',
  })).sort((left, right) => {
    const leftValue = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightValue = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightValue - leftValue;
  });
}

Page({
  data: {
    loading: false,
    errorText: '',
    keyword: '',
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    scoreMin: '',
    scoreMax: '',
    list: [],
    filteredList: [],
    hasActiveFilters: false,
    totalCount: 0,
    doneCount: 0,
    processingCount: 0,
    failedCount: 0,
    averageScore: '--',
    completionRate: '--',
  },
  onLoad() {
    this.setData(getStoredFilters());
  },
  onShow() {
    if (!ensureLogin('/pages/submissions/index')) {
      return;
    }
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData(true);
  },
  handleKeywordInput(event) {
    this.setData({ keyword: event.detail.value || '' }, () => {
      this.applyFilters();
    });
  },
  handleStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value || 0) }, () => {
      this.applyFilters();
    });
  },
  handleScoreMinInput(event) {
    this.setData({ scoreMin: event.detail.value || '' }, () => {
      this.applyFilters();
    });
  },
  handleScoreMaxInput(event) {
    this.setData({ scoreMax: event.detail.value || '' }, () => {
      this.applyFilters();
    });
  },
  resetFilters() {
    this.setData({
      keyword: '',
      statusIndex: 0,
      scoreMin: '',
      scoreMax: '',
    }, () => {
      this.applyFilters();
    });
  },
  persistFilters() {
    try {
      wx.setStorageSync(FILTER_STORAGE_KEY, {
        keyword: this.data.keyword || '',
        statusIndex: this.data.statusIndex || 0,
        scoreMin: this.data.scoreMin || '',
        scoreMax: this.data.scoreMax || '',
      });
    } catch (_error) {
    }
  },
  async loadData(fromPullDown) {
    if (!ensureLogin('/pages/submissions/index')) {
      return;
    }
    this.setData({ loading: true, errorText: '' });
    try {
      const response = await fetchStudentSubmissions();
      const list = enrichList(response);
      this.setData({ list });
      this.applyFilters();
    } catch (error) {
      const errorText = pickErrorMessage(error, '提交记录加载失败，请稍后重试');
      this.setData({ errorText });
      showToast(errorText);
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
  applyFilters() {
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    const statusValue = this.data.statusOptions[this.data.statusIndex].value;
    const scoreMin = this.data.scoreMin === '' ? null : Number(this.data.scoreMin);
    const scoreMax = this.data.scoreMax === '' ? null : Number(this.data.scoreMax);
    const list = this.data.list || [];
    const hasActiveFilters = Boolean(keyword)
      || statusValue !== 'all'
      || this.data.scoreMin !== ''
      || this.data.scoreMax !== '';
    const doneList = list.filter((item) => item.status === 'DONE');
    const scoreList = doneList
      .map((item) => item.totalScore)
      .filter((item) => typeof item === 'number');
    const averageScore = scoreList.length
      ? (scoreList.reduce((sum, item) => sum + item, 0) / scoreList.length).toFixed(1)
      : '--';
    const completionRate = list.length
      ? `${Math.round((doneList.length / list.length) * 100)}%`
      : '--';
    const filteredList = list.filter((item) => {
      if (statusValue !== 'all' && item.status !== statusValue) {
        return false;
      }
      if (keyword && !item.homeworkTitle.toLowerCase().includes(keyword)) {
        return false;
      }
      if (scoreMin !== null && (!Number.isFinite(scoreMin) || typeof item.totalScore !== 'number' || item.totalScore < scoreMin)) {
        return false;
      }
      if (scoreMax !== null && (!Number.isFinite(scoreMax) || typeof item.totalScore !== 'number' || item.totalScore > scoreMax)) {
        return false;
      }
      return true;
    });
    this.setData({
      filteredList,
      hasActiveFilters,
      totalCount: list.length,
      doneCount: doneList.length,
      processingCount: list.filter((item) => item.status === 'QUEUED' || item.status === 'PROCESSING').length,
      failedCount: list.filter((item) => item.status === 'FAILED').length,
      averageScore,
      completionRate,
    });
    this.persistFilters();
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
  goHomeworkDetail(event) {
    const { homeworkid } = event.currentTarget.dataset;
    if (!homeworkid) {
      return;
    }
    wx.navigateTo({
      url: `/pages/homework-detail/index?id=${homeworkid}`,
    });
  },
  goResubmit(event) {
    const { homeworkid } = event.currentTarget.dataset;
    if (!homeworkid) {
      showToast('缺少作业标识');
      return;
    }
    wx.navigateTo({
      url: `/pages/submit/index?homeworkId=${homeworkid}`,
    });
  },
  goHomeworks() {
    wx.switchTab({
      url: '/pages/homeworks/index',
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
  stopPropagation() {
    // Prevent event bubbling for card action buttons
  },
});
