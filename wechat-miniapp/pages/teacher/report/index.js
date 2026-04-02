const { fetchClasses, fetchClassReport } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    rangeDays: 7,
    report: null,
    loading: false,
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes, selectedClassId: classes[0]?.id || '' });
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
      this.setData({ report });
    } catch (error) {
      showToast('加载报告失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    this.setData({ selectedClassId: e.detail.value });
    this.loadReport();
  },

  onRangeChange(e) {
    this.setData({ rangeDays: e.detail.value });
    this.loadReport();
  },
});
