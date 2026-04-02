const { fetchHomeworks } = require('../../../services/teacher');
const { uploadFiles } = require('../../../lib/request');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

Page({
  data: {
    mode: 'cheap',
    images: [],
    selectedHomeworkId: '',
    selectedHomeworkTitle: '请选择',
    homeworks: [],
    previewResult: null,
    showModeSelector: false,
    showHomeworkSelector: false,
    uploading: false,
  },

  onLoad() {
    this.loadHomeworks();
  },

  async loadHomeworks() {
    try {
      const homeworks = await fetchHomeworks();
      const selectedHomeworkId = homeworks[0]?.id || '';
      const selectedHomeworkTitle = homeworks[0]?.title || '请选择';
      this.setData({ homeworks, selectedHomeworkId, selectedHomeworkTitle });
    } catch (error) {
      console.error('加载作业失败:', error);
    }
  },

  onModeChange() {
    this.setData({ showModeSelector: true });
  },

  onSelectMode(e) {
    const { mode } = e.currentTarget.dataset;
    this.setData({ mode, showModeSelector: false });
  },

  onCloseModeSelector() {
    this.setData({ showModeSelector: false });
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size,
        }));
        this.setData({
          images: [...this.data.images, ...newImages],
        });
      },
    });
  },

  onRemoveImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images, previewResult: null });
  },

  async onPreview() {
    const { images } = this.data;
    if (images.length === 0) {
      showToast('请先选择图片');
      return;
    }

    showLoading('识别中...');
    try {
      const formData = {
        dryRun: 'true',
      };

      const result = await uploadFiles({
        url: '/teacher/submissions/batch',
        files: images.map(img => ({ path: img.path, type: 'image/jpeg' })),
        formData,
      });

      this.setData({ previewResult: result });
      hideLoading();

      this.showPreviewResult(result);
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '识别失败'));
    }
  },

  showPreviewResult(result) {
    let message = `共 ${result.totalImages} 张图片\n`;
    message += `已匹配: ${result.matchedImages} 张\n`;
    message += `未匹配: ${result.unmatchedCount} 张\n`;

    wx.showModal({
      title: '识别结果',
      content: message,
      confirmText: '继续上传',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.onUpload();
        }
      },
    });
  },

  async onUpload() {
    const { images, mode, selectedHomeworkId } = this.data;

    if (!selectedHomeworkId) {
      showToast('请选择作业');
      return;
    }

    this.setData({ uploading: true });
    showLoading('上传中...');

    try {
      const formData = {
        homeworkId: selectedHomeworkId,
        mode,
        needRewrite: mode === 'quality',
      };

      const result = await uploadFiles({
        url: '/teacher/submissions/batch',
        files: images.map(img => ({ path: img.path, type: 'image/jpeg' })),
        formData,
      });

      hideLoading();
      showToast('上传成功', 'success');

      const batchId = result.batchId;
      wx.navigateTo({
        url: `/pages/teacher/upload-result/index?batchId=${batchId}`,
      });
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '上传失败'));
    } finally {
      this.setData({ uploading: false });
    }
  },

  onHomeworkChange() {
    this.setData({ showHomeworkSelector: true });
  },

  onSelectHomework(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    const title = homework ? homework.title : '请选择';
    this.setData({ selectedHomeworkId: id, selectedHomeworkTitle: title, showHomeworkSelector: false });
  },

  onCloseHomeworkSelector() {
    this.setData({ showHomeworkSelector: false });
  },
});
