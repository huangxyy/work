const { fetchClasses, fetchClassReport } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    rangeDays: 7,
    report: null,
    loading: false,
    submissionCount: 0,
    submissionRateText: '0%',
    trendChartData: [],
    scoreDistribution: [],
    chartColors: ['#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    scoreLegend: [
      { name: '优秀(90+)', color: '#10b981' },
      { name: '良好(80-89)', color: '#0891b2' },
      { name: '及格(60-79)', color: '#f59e0b' },
      { name: '不及格(<60)', color: '#ef4444' }
    ]
  },

  onLoad() {
    this.loadClasses();
  },

  onShow() {
    const globalClassId = getApp().globalData.selectedClassId;
    if (globalClassId && globalClassId !== this.data.selectedClassId) {
      const index = this.data.classes.findIndex(c => c.id === globalClassId);
      if (index >= 0) {
        this.setData({ selectedClassId: globalClassId });
        this.loadReport();
        return;
      }
    }
    if (this.data.selectedClassId) {
      this.loadReport();
    }
  },

  onPullDownRefresh() {
    this.loadReport().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      if (classes.length > 0) {
        const selectedClassId = classes[0].id;
        this.setData({ classes, selectedClassId });
        this.loadReport();
      } else {
        this.setData({ classes: [], selectedClassId: '' });
      }
    } catch (error) {
      console.error('加载班级失败:', error);
      showToast('加载班级失败');
    }
  },

  async loadReport() {
    const { selectedClassId, rangeDays } = this.data;
    if (!selectedClassId) return;

    this.setData({ loading: true });
    try {
      const report = await fetchClassReport(selectedClassId, rangeDays);
      const submissionCount = report.submittedStudents || 0;
      const totalStudents = report.totalStudents || 0;
      const submissionRateText = report.submissionRate 
        ? (report.submissionRate * 100).toFixed(1) + '%' 
        : '0%';

      const trendChartData = this.processTrendData(report.trend || []);
      const scoreDistribution = this.processDistributionData(report.distribution || []);

      this.setData({
        report,
        submissionCount,
        totalStudents,
        submissionRateText,
        trendChartData,
        scoreDistribution
      });
    } catch (error) {
      console.error('加载报告失败:', error);
      showToast('加载报告失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  processTrendData(trend) {
    if (!trend || trend.length === 0) return [];

    return trend.map(item => {
      const date = new Date(item.date);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      return {
        label: label,
        value: Math.round(item.avg || 0)
      };
    });
  },

  processDistributionData(distribution) {
    if (!distribution || distribution.length === 0) return [];

    const bucketMap = {
      '90-100': { label: '优秀', value: 0 },
      '80-89': { label: '良好', value: 0 },
      '60-79': { label: '及格', value: 0 },
      '0-59': { label: '不及格', value: 0 },
    };

    distribution.forEach(item => {
      const bucket = item.bucket;
      if (bucket === '90-100' || bucket === '90+') {
        bucketMap['90-100'].value += item.count || 0;
      } else if (bucket === '80-89' || bucket === '80-89') {
        bucketMap['80-89'].value += item.count || 0;
      } else if (bucket === '60-79' || bucket === '60-69' || bucket === '70-79') {
        bucketMap['60-79'].value += item.count || 0;
      } else if (bucket === '0-59' || bucket === '0-59') {
        bucketMap['0-59'].value += item.count || 0;
      }
    });

    return Object.values(bucketMap).filter(item => item.value > 0);
  },

  onSelectClass(e) {
    const classId = e.currentTarget.dataset.id;
    if (classId && classId !== this.data.selectedClassId) {
      this.setData({ selectedClassId: classId, report: null });
      this.loadReport();
    }
  },

  onRangeChange(e) {
    const days = parseInt(e.currentTarget.dataset.days);
    if (days && days !== this.data.rangeDays) {
      this.setData({ rangeDays: days, report: null });
      this.loadReport();
    }
  },

  onShowHelp() {
    showHelp('report');
  }
});
