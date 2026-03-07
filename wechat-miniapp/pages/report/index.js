const { ensureLogin } = require('../../lib/page');
const { showToast, showLoading, hideLoading } = require('../../lib/ui');
const { formatDateTime, pickErrorMessage } = require('../../lib/utils');
const { fetchStudentReportOverview, fetchClassComparison, downloadStudentReportPdf } = require('../../services/reports');

const RANGE_OPTIONS = [
  { label: '近 7 天', value: 7 },
  { label: '近 14 天', value: 14 },
  { label: '近 30 天', value: 30 },
];

const REPORT_RANGE_STORAGE_KEY = 'report_range_index';

function getStoredRangeIndex() {
  try {
    const value = Number(wx.getStorageSync(REPORT_RANGE_STORAGE_KEY));
    if (Number.isInteger(value) && value >= 0 && value < RANGE_OPTIONS.length) {
      return value;
    }
  } catch (_error) {
  }
  return 0;
}

function setStoredRangeIndex(index) {
  try {
    wx.setStorageSync(REPORT_RANGE_STORAGE_KEY, index);
  } catch (_error) {
  }
}

function toPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRatio(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }
  return `${Math.round(value * 100)}%`;
}

function localizeErrorType(type) {
  const map = {
    grammar: '语法',
    vocabulary: '词汇',
    structure: '结构',
    content: '内容',
    coherence: '连贯',
    GRAMMAR: '语法',
    VOCABULARY: '词汇',
    STRUCTURE: '结构',
    CONTENT: '内容',
    COHERENCE: '连贯',
  };
  return map[type] || type || '未知';
}

Page({
  data: {
    loading: false,
    exporting: false,
    errorText: '',
    rangeOptions: RANGE_OPTIONS,
    rangeIndex: 0,
    reportOwnerName: '当前学生',
    reportRangeLabel: '近 7 天',
    reportSampleCount: 0,
    lastUpdatedLabel: '未刷新',
    isReportEmpty: false,
    canExpandRange: true,
    reportEmptyTip: '当前时间范围内还没有足够的提交数据。',
    report: null,
    comparisonList: [],
    summaryCards: [],
    trendList: [],
    errorTypes: [],
    nextSteps: [],
  },
  onLoad() {
    this.setData({
      rangeIndex: getStoredRangeIndex(),
    });
  },
  onShow() {
    if (!ensureLogin('/pages/report/index')) {
      return;
    }
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData(true);
  },
  handleRangeChange(event) {
    const rangeIndex = Number(event.detail.value || 0);
    setStoredRangeIndex(rangeIndex);
    this.setData({
      rangeIndex,
    }, () => {
      this.loadData();
    });
  },
  useWiderRange() {
    const nextIndex = Math.min(this.data.rangeIndex + 1, this.data.rangeOptions.length - 1);
    if (nextIndex === this.data.rangeIndex) {
      return;
    }
    setStoredRangeIndex(nextIndex);
    this.setData({
      rangeIndex: nextIndex,
    }, () => {
      this.loadData();
    });
  },
  async loadData(fromPullDown) {
    if (!ensureLogin('/pages/report/index')) {
      return;
    }
    this.setData({ loading: true, errorText: '' });
    const currentRange = this.data.rangeOptions[this.data.rangeIndex];
    const days = currentRange.value;
    try {
      const [report, comparisonList] = await Promise.all([
        fetchStudentReportOverview(days),
        fetchClassComparison(days),
      ]);
      const summary = report && report.summary ? report.summary : { avg: 0, min: 0, max: 0, count: 0 };
      const summaryCards = [
        { key: 'avg', label: '平均分', value: typeof summary.avg === 'number' ? summary.avg.toFixed(1) : '--' },
        { key: 'max', label: '最高分', value: typeof summary.max === 'number' ? summary.max : '--' },
        { key: 'min', label: '最低分', value: typeof summary.min === 'number' ? summary.min : '--' },
        { key: 'count', label: '提交次数', value: typeof summary.count === 'number' ? summary.count : '--' },
      ];
      const trendList = (report && Array.isArray(report.trend) ? report.trend : []).map((item) => ({
        ...item,
        avgPercent: toPercent(item.avg),
      }));
      const errorTypes = (report && Array.isArray(report.errorTypes) ? report.errorTypes : []).map((item) => ({
        ...item,
        typeLabel: localizeErrorType(item.type),
        ratioLabel: normalizeRatio(item.ratio),
      }));
      const nextSteps = report && Array.isArray(report.nextSteps) ? report.nextSteps : [];
      const sampleCount = summary && typeof summary.count === 'number' ? summary.count : 0;
      const canExpandRange = this.data.rangeIndex < this.data.rangeOptions.length - 1;
      const isReportEmpty = sampleCount <= 0;
      const normalizedComparison = (comparisonList || []).map((item) => ({
        ...item,
        classAvgValue: typeof item.classAvg === 'number' ? item.classAvg : 0,
        studentAvgValue: typeof item.studentAvg === 'number' ? item.studentAvg : 0,
        classAvgPercent: toPercent(item.classAvg),
        studentAvgPercent: toPercent(item.studentAvg),
      }));
      this.setData({
        reportOwnerName: report && report.studentName ? report.studentName : '当前学生',
        reportRangeLabel: report && report.rangeDays ? `近 ${report.rangeDays} 天` : currentRange.label,
        reportSampleCount: sampleCount,
        lastUpdatedLabel: formatDateTime(new Date()),
        isReportEmpty,
        canExpandRange,
        reportEmptyTip: canExpandRange
          ? '你可以先扩大统计时间范围，或者先去提交新的作业。'
          : '当前最长范围内仍没有足够数据，建议先去提交新的作业。',
        report,
        comparisonList: normalizedComparison,
        summaryCards,
        trendList,
        errorTypes,
        nextSteps,
      });
    } catch (error) {
      const errorText = pickErrorMessage(error, '学习报告加载失败，请稍后重试');
      this.setData({ errorText });
      showToast(errorText);
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
  goHomeworks() {
    wx.switchTab({
      url: '/pages/homeworks/index',
    });
  },
  goSubmissions() {
    wx.switchTab({
      url: '/pages/submissions/index',
    });
  },
  async exportPdf() {
    if (this.data.exporting) {
      return;
    }
    const days = this.data.rangeOptions[this.data.rangeIndex].value;
    this.setData({ exporting: true });
    showLoading('正在导出');
    try {
      const result = await downloadStudentReportPdf(days, 'zh-CN');
      if (!result || !result.tempFilePath) {
        showToast('导出失败，请稍后重试');
        return;
      }
      await new Promise((resolve, reject) => {
        wx.openDocument({
          filePath: result.tempFilePath,
          showMenu: true,
          success() {
            resolve();
          },
          fail(err) {
            reject(err);
          },
        });
      });
      showToast('报告已打开', 'success');
    } catch (error) {
      showToast(pickErrorMessage(error, '导出失败，请稍后重试'));
    } finally {
      hideLoading();
      this.setData({ exporting: false });
    }
  },
  retryLoad() {
    this.loadData();
  },
});
