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
    chartColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    scoreLegend: [
      { name: '优秀(90+)', color: '#10b981' },
      { name: '良好(80-89)', color: '#3b82f6' },
      { name: '及格(60-79)', color: '#f59e0b' },
      { name: '不及格(<60)', color: '#ef4444' }
    ]
  },

  onLoad() {
    this.loadClasses();
  },

  onShow() {
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
      // submittedStudents 是已提交的学生人数
      const submissionCount = report.submittedStudents || 0;
      // totalStudents 是班级总学生数
      const totalStudents = report.totalStudents || 0;
      // submissionRate 是提交率
      const submissionRateText = report.submissionRate 
        ? (report.submissionRate * 100).toFixed(1) + '%' 
        : '0%';

      // 处理趋势图表数据
      const trendChartData = this.processTrendData(report.trend || []);

      // 处理分数分布数据
      const scoreDistribution = this.processScoreData(report.scores || report.distribution || []);

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

  processScoreData(scores) {
    if (!scores || scores.length === 0) return [];

    // 分数分段统计
    const distribution = [
      { label: '优秀', value: 0 },
      { label: '良好', value: 0 },
      { label: '及格', value: 0 },
      { label: '不及格', value: 0 }
    ];

    scores.forEach(score => {
      if (score >= 90) distribution[0].value++;
      else if (score >= 80) distribution[1].value++;
      else if (score >= 60) distribution[2].value++;
      else distribution[3].value++;
    });

    // 过滤掉数量为0的项
    return distribution.filter(item => item.value > 0);
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
