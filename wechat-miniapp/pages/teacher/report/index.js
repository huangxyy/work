const { fetchClasses, fetchClassReport } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    selectedClassName: '选择班级',
    rangeDays: 7,
    report: null,
    loading: false,
    // 计算属性用于 WXML 显示
    submissionCount: 0,
    submissionRateText: '0%',
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      const selectedClassId = classes[0]?.id || '';
      const selectedClassName = classes[0]?.name || '选择班级';
      this.setData({ classes, selectedClassId, selectedClassName });
      if (classes.length > 0) {
        this.loadReport();
      }
    } catch (error) {
      showToast('加载班级失败');
    }
  },

  async loadReport() {
    const { selectedClassId, rangeDays } = this.data;
    if (!selectedClassId) return;

    this.setData({ loading: true });
    try {
      const report = await fetchClassReport(selectedClassId, rangeDays);
      const submissionCount = report.summary && report.summary.count ? report.summary.count : 0;
      const submissionRate = report.submissionRate ? (report.submissionRate * 100).toFixed(1) : '0';
      const submissionRateText = submissionRate + '%';
      this.setData({ report, submissionCount, submissionRateText });
    } catch (error) {
      showToast('加载报告失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    const classId = e.detail.value;
    const selectedClass = this.data.classes.find(c => c.id === classId);
    const selectedClassName = selectedClass ? selectedClass.name : '选择班级';
    this.setData({ selectedClassId: classId, selectedClassName });
    this.loadReport();
  },

  onRangeChange(e) {
    this.setData({ rangeDays: e.detail.value });
    this.loadReport();
  },
});
