const { fetchGradingPreference, updateGradingPreference } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    mode: 'cheap',
    loading: false,
  },

  onLoad() {
    this.loadPreference();
  },

  async loadPreference() {
    this.setData({ loading: true });
    try {
      const result = await fetchGradingPreference();
      this.setData({ mode: result.mode || 'cheap' });
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onSelectMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === this.data.mode) return;

    showLoading('保存中...');
    try {
      await updateGradingPreference(mode);
      this.setData({ mode });
      hideLoading();
      showToast('设置已保存', 'success');
    } catch (error) {
      hideLoading();
      showToast('保存失败');
    }
  },
});
