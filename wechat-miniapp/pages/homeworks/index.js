const { fetchStudentHomeworks } = require('../../services/homeworks');
const { hasSubmitDraft } = require('../../lib/draft');
const { ensureLogin, syncUser, getUser } = require('../../lib/page');
const { showToast } = require('../../lib/ui');
const { formatDateTime, getHomeworkStatus, pickErrorMessage } = require('../../lib/utils');

const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '进行中', value: 'open' },
  { label: '逾期可补交', value: 'late' },
  { label: '已截止', value: 'overdue' },
];

const FILTER_STORAGE_KEY = 'homeworks_filter_state';

function getStoredFilters() {
  try {
    const stored = wx.getStorageSync(FILTER_STORAGE_KEY) || {};
    const statusIndex = Number(stored.statusIndex);
    return {
      statusIndex: Number.isInteger(statusIndex) && statusIndex >= 0 && statusIndex < STATUS_OPTIONS.length ? statusIndex : 0,
    };
  } catch (_error) {
    return { statusIndex: 0 };
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
    statusIndex: 0,
    statusOptions: STATUS_OPTIONS,
    userName: '同学',
    list: [],
    filteredList: [],
    hasActiveFilters: false,
    openCount: 0,
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
  persistFilters() {
    try {
      wx.setStorageSync(FILTER_STORAGE_KEY, {
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
      const homeworksResult = await fetchStudentHomeworks();
      const list = enrichList(homeworksResult).sort((left, right) => {
        const leftValue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightValue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue;
      });
      this.setData({ list });
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
    const statusValue = this.data.statusOptions[this.data.statusIndex].value;
    const list = this.data.list || [];
    const hasActiveFilters = statusValue !== 'all';
    const filteredList = list.filter((item) => {
      if (statusValue !== 'all' && item.status.key !== statusValue) {
        return false;
      }
      return true;
    });
    const openCount = list.filter((item) => item.status.key === 'open').length;
    this.setData({
      filteredList,
      hasActiveFilters,
      openCount,
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
});
