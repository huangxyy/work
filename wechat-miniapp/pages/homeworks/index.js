const { fetchStudentHomeworks } = require('../../services/homeworks');
const { fetchStudentReportOverview } = require('../../services/reports');
const { fetchStudentSubmissions } = require('../../services/submissions');
const { fetchUnreadCount } = require('../../services/notifications');
const { hasSubmitDraft } = require('../../lib/draft');
const { ensureLogin, syncUser, getUser } = require('../../lib/page');
const { showToast } = require('../../lib/ui');
const { formatDateTime, getHomeworkStatus, pickErrorMessage } = require('../../lib/utils');

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '进行中', value: 'open' },
  { label: '逾期可补交', value: 'late' },
  { label: '已截止', value: 'overdue' },
  { label: '未设截止', value: 'nodue' },
];

const FILTER_STORAGE_KEY = 'homeworks_filter_state';

function getStoredFilters() {
  try {
    const stored = wx.getStorageSync(FILTER_STORAGE_KEY) || {};
    const statusIndex = Number(stored.statusIndex);
    return {
      keyword: typeof stored.keyword === 'string' ? stored.keyword : '',
      statusIndex: Number.isInteger(statusIndex) && statusIndex >= 0 && statusIndex < STATUS_OPTIONS.length ? statusIndex : 0,
    };
  } catch (_error) {
    return { keyword: '', statusIndex: 0 };
  }
}

function enrichList(list) {
  return (list || []).map((item) => {
    const status = getHomeworkStatus(item.dueAt, item.allowLateSubmission);
    return {
      ...item,
      status,
      statusClass: getStatusClassForList(status.key),
      hasDraft: hasSubmitDraft(item.id),
      dueLabel: item.dueAt ? formatDateTime(item.dueAt) : '灵活截止',
      descText: item.desc || '暂未提供作业说明',
      className: item.class && item.class.name ? item.class.name : '未分班级',
    };
  });
}

// 计算作业状态样式类 (用于列表显示)
function getStatusClassForList(statusKey) {
  const statusMap = {
    'open': 'progress',
    'late': 'late',
    'overdue': 'expired',
    'nodue': 'progress',
  };
  return statusMap[statusKey] || '';
}

Page({
  data: {
    loading: false,
    errorText: '',
    keyword: '',
    statusIndex: 0,
    statusOptions: STATUS_OPTIONS,
    userName: '同学',
    list: [],
    filteredList: [],
    hasActiveFilters: false,
    totalCount: 0,
    openCount: 0,
    lateCount: 0,
    overdueCount: 0,
    reportAvgScore: '--',
    reportSubmissionCount: 0,
    reportNextStep: '继续保持提交频率，系统会逐步沉淀更稳定的学习建议。',
    urgentList: [],
    pendingResultList: [],
    unreadCount: 0,
    showTodoSection: true,
    activeFilter: 'all',
  },
  onLoad() {
    this.setData(getStoredFilters());
  },
  onShow() {
    if (!ensureLogin('/pages/homeworks/index')) {
      return;
    }
    const user = getUser();
    this.setData({ userName: user && user.name ? user.name : '同学' });
    if (!user) {
      syncUser()
        .then((nextUser) => {
          this.setData({ userName: nextUser && nextUser.name ? nextUser.name : '同学' });
        })
        .catch(() => {});
    }
    this.loadData();
  },
  onReady() {
    wx.setNavigationBarTitle({ title: '我的作业' });
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
  // 筛选切换 (用于新的 filter-chips)
  onFilterChange(event) {
    const filter = event.currentTarget.dataset.filter;
    const statusIndex = this.data.statusOptions.findIndex(opt => opt.value === filter);
    this.setData({
      activeFilter: filter,
      statusIndex: statusIndex >= 0 ? statusIndex : 0,
    }, () => {
      this.applyFilters();
    });
  },
  // 作业卡片点击
  onHomeworkTap(event) {
    const { id } = event.currentTarget.dataset;
    if (id) {
      this.goDetail({ currentTarget: { dataset: { id } } });
    }
  },
  resetFilters() {
    this.setData({
      keyword: '',
      statusIndex: 0,
      activeFilter: 'all',
    }, () => {
      this.applyFilters();
    });
  },
  persistFilters() {
    try {
      wx.setStorageSync(FILTER_STORAGE_KEY, {
        keyword: this.data.keyword || '',
        statusIndex: this.data.statusIndex || 0,
      });
    } catch (_error) {
    }
  },
  async loadData(fromPullDown) {
    if (!ensureLogin('/pages/homeworks/index')) {
      return;
    }
    this.setData({ loading: true, errorText: '' });
    try {
      const [homeworksResult, reportResult, submissionsResult, unreadResult] = await Promise.allSettled([
        fetchStudentHomeworks(),
        fetchStudentReportOverview(7),
        fetchStudentSubmissions({ status: 'QUEUED,PROCESSING' }),
        fetchUnreadCount(),
      ]);
      if (homeworksResult.status !== 'fulfilled') {
        throw homeworksResult.reason;
      }
      const list = enrichList(homeworksResult.value).sort((left, right) => {
        const leftValue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightValue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue;
      });
      const report = reportResult.status === 'fulfilled' ? reportResult.value : null;
      const summary = report && report.summary ? report.summary : null;
      const nextSteps = report && Array.isArray(report.nextSteps) ? report.nextSteps : [];
      const now = Date.now();
      const urgentThreshold = 48 * 60 * 60 * 1000;
      const urgentList = list.filter((item) => {
        if (item.status.key !== 'open' || !item.dueAt) return false;
        const diff = new Date(item.dueAt).getTime() - now;
        return diff > 0 && diff <= urgentThreshold;
      }).map((item) => {
        const hoursLeft = Math.max(0, Math.round((new Date(item.dueAt).getTime() - now) / 3600000));
        return { ...item, urgentLabel: hoursLeft <= 1 ? '不足 1 小时' : `剩余 ${hoursLeft} 小时` };
      });
      const pendingSubmissions = submissionsResult.status === 'fulfilled'
        ? (Array.isArray(submissionsResult.value) ? submissionsResult.value : (submissionsResult.value && submissionsResult.value.data ? submissionsResult.value.data : []))
        : [];
      const pendingResultList = pendingSubmissions.slice(0, 5).map((sub) => ({
        ...sub,
        statusLabel: sub.status === 'QUEUED' ? '排队中' : '批改中',
        homeworkTitle: sub.homework && sub.homework.title ? sub.homework.title : '作业',
        timeLabel: sub.createdAt ? formatDateTime(sub.createdAt) : '',
      }));
      const unreadCount = unreadResult.status === 'fulfilled' && unreadResult.value && typeof unreadResult.value.count === 'number' ? unreadResult.value.count : 0;
      this.setData({
        list,
        urgentList,
        pendingResultList,
        unreadCount,
        reportAvgScore: summary && typeof summary.avg === 'number' ? summary.avg.toFixed(1) : '--',
        reportSubmissionCount: summary && typeof summary.count === 'number' ? summary.count : 0,
        reportNextStep: nextSteps.length && nextSteps[0] && nextSteps[0].text
          ? nextSteps[0].text
          : '继续保持提交频率，系统会逐步沉淀更稳定的学习建议。',
      });
      this.applyFilters();
    } catch (error) {
      const errorText = pickErrorMessage(error, '作业加载失败，请稍后重试');
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
    const list = this.data.list || [];
    const hasActiveFilters = Boolean(keyword) || statusValue !== 'all';
    const filteredList = list.filter((item) => {
      if (statusValue !== 'all' && item.status.key !== statusValue) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [item.title, item.descText, item.className]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
    const openCount = list.filter((item) => item.status.key === 'open').length;
    const lateCount = list.filter((item) => item.status.key === 'late').length;
    const overdueCount = list.filter((item) => item.status.key === 'overdue').length;
    this.setData({
      filteredList,
      hasActiveFilters,
      totalCount: list.length,
      openCount,
      lateCount,
      overdueCount,
      activeFilter: statusValue,
    });
    this.persistFilters();
  },
  goDetail(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/homework-detail/index?id=${id}`,
    });
  },
  goSubmit(event) {
    const { id, closed } = event.currentTarget.dataset;
    if (closed) {
      showToast('该作业已截止，当前不可提交');
      return;
    }
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/submit/index?homeworkId=${id}`,
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
  toggleTodoSection() {
    this.setData({ showTodoSection: !this.data.showTodoSection });
  },
  goMessages() {
    wx.navigateTo({ url: '/pages/messages/index' });
  },
  goSubmissionResult(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/submission-result/index?id=${id}` });
  },
  // 辅助方法：计算作业状态样式类
  getStatusClass(status) {
    const statusMap = {
      'OPEN': 'progress',
      'LATE': 'late',
      'EXPIRED': 'expired',
      'DONE': 'done'
    };
    return statusMap[status] || '';
  },
  // 辅助方法：格式化截止时间
  formatDeadline(deadline) {
    if (!deadline) return '未设截止';
    const date = new Date(deadline);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return '已截止';
    if (diff < 86400000) return '今天 ' + this.formatTime(date);
    if (diff < 172800000) return '明天 ' + this.formatTime(date);
    return this.formatDate(date);
  },
  // 辅助方法：格式化时间
  formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },
  // 辅助方法：格式化日期
  formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${this.formatTime(date)}`;
  },
});
