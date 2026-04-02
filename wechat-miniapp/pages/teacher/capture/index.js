const { fetchHomeworks, fetchClasses } = require('../../../services/teacher');
const { uploadFiles } = require('../../../lib/request');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const errorHandler = require('../../../lib/error-handler');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    mode: 'cheap',
    images: [],
    selectedClassId: '',
    selectedClassName: '选择班级',
    selectedHomeworkId: '',
    selectedHomeworkTitle: '请选择',
    classes: [],
    homeworks: [],
    previewResult: null,
    showModeSelector: false,
    showHomeworkSelector: false,
    showClassSelector: false,
    uploading: false,
    classSelectedIndex: 0,
  },

  onLoad(options) {
    const { homeworkId, classId } = options;
    if (homeworkId) {
      this.setData({ selectedHomeworkId: homeworkId });
    }
    if (classId) {
      this.setData({ selectedClassId: classId });
    }
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      if (classes.length > 0) {
        // 确定选中的班级
        let selectedClassId = this.data.selectedClassId || classes[0].id;
        let classSelectedIndex = classes.findIndex(c => c.id === selectedClassId);
        if (classSelectedIndex < 0) {
          classSelectedIndex = 0;
          selectedClassId = classes[0].id;
        }

        const selectedClassName = classes[classSelectedIndex].name;
        this.setData({
          classes,
          selectedClassId,
          selectedClassName,
          classSelectedIndex,
        });
        this.loadHomeworks();
      } else {
        this.setData({
          classes: [],
          selectedClassId: '',
          selectedClassName: '暂无班级',
        });
        showToast('暂无班级，请先创建班级');
      }
    } catch (error) {
      console.error('加载班级失败:', error);
      showToast('加载班级失败');
    }
  },

  async loadHomeworks() {
    const { selectedClassId, selectedHomeworkId: currentHomeworkId } = this.data;
    if (!selectedClassId) {
      this.setData({
        homeworks: [],
        selectedHomeworkId: '',
        selectedHomeworkTitle: '请先选择班级',
      });
      return;
    }

    try {
      const homeworks = await fetchHomeworks({ classId: selectedClassId });
      if (homeworks.length > 0) {
        // 保持当前选中的作业，如果没有则选中第一个
        let selectedHomeworkId = currentHomeworkId || homeworks[0].id;
        let selectedHomeworkTitle = homeworks[0].title;

        // 查找当前选中的作业
        const currentIndex = homeworks.findIndex(h => h.id === selectedHomeworkId);
        if (currentIndex >= 0) {
          selectedHomeworkTitle = homeworks[currentIndex].title;
        } else {
          selectedHomeworkId = homeworks[0].id;
          selectedHomeworkTitle = homeworks[0].title;
        }

        this.setData({
          homeworks,
          selectedHomeworkId,
          selectedHomeworkTitle,
        });
      } else {
        this.setData({
          homeworks: [],
          selectedHomeworkId: '',
          selectedHomeworkTitle: '该班级暂无作业',
        });
      }
    } catch (error) {
      console.error('加载作业失败:', error);
      showToast('加载作业失败');
    }
  },

  onClassChange() {
    if (this.data.classes.length === 0) {
      showToast('暂无班级');
      return;
    }
    this.setData({ showClassSelector: true });
  },

  onSelectClass(e) {
    const { id } = e.currentTarget.dataset;
    const index = e.currentTarget.dataset.index;
    const cls = this.data.classes.find(c => c.id === id);
    if (cls) {
      this.setData({
        selectedClassId: id,
        selectedClassName: cls.name,
        classSelectedIndex: index,
        showClassSelector: false,
        selectedHomeworkId: '',
        selectedHomeworkTitle: '请选择',
        images: [],
        previewResult: null,
      });
      this.loadHomeworks();
    }
  },

  onCloseClassSelector() {
    this.setData({ showClassSelector: false });
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
    const maxCount = 9 - this.data.images.length;
    if (maxCount <= 0) {
      showToast('最多只能上传9张图片');
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size,
        }));
        this.setData({
          images: [...this.data.images, ...newImages],
          previewResult: null, // 清除之前的预览结果
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
      }
    });
  },

  onRemoveImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({
      images,
      previewResult: null, // 清除之前的预览结果
    });
  },

  async onPreview() {
    const { images } = this.data;
    if (images.length === 0) {
      showToast('请先选择图片');
      return;
    }

    // 重置预览结果
    this.setData({ previewResult: null });
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

      hideLoading();
      this.setData({ previewResult: result });
      this.showPreviewResult(result);
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '识别失败'));
    }
  },

  showPreviewResult(result) {
    const { totalImages = 0, matchedImages = 0, unmatchedCount = 0, createdSubmissions = 0 } = result;

    let message = `共 ${totalImages} 张图片\n`;
    message += `✓ 已匹配: ${matchedImages} 张\n`;

    if (unmatchedCount > 0) {
      message += `✗ 未匹配: ${unmatchedCount} 张\n`;
    }

    if (createdSubmissions > 0) {
      message += `\n预计创建提交: ${createdSubmissions} 条`;
    }

    wx.showModal({
      title: '识别结果',
      content: message,
      confirmText: '确认上传',
      cancelText: '取消',
      confirmColor: '#10b981',
      success: (res) => {
        if (res.confirm) {
          this.onUpload();
        }
      },
    });
  },

  async onUpload() {
    const { images, mode, selectedHomeworkId } = this.data;

    if (images.length === 0) {
      showToast('请先选择图片');
      return;
    }

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
      wx.redirectTo({
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
    if (this.data.homeworks.length === 0) {
      showToast('请先选择班级');
      return;
    }
    this.setData({ showHomeworkSelector: true });
  },

  onSelectHomework(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    const title = homework ? homework.title : '请选择';
    this.setData({
      selectedHomeworkId: id,
      selectedHomeworkTitle: title,
      showHomeworkSelector: false,
    });
  },

  onCloseHomeworkSelector() {
    this.setData({ showHomeworkSelector: false });
  },

  onShowHelp() {
    showHelp('capture');
  },
});
