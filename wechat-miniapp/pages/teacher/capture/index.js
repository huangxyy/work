const { fetchHomeworks, fetchClasses } = require('../../../services/teacher');
const { uploadFiles } = require('../../../lib/request');
const { showToast, showLoading, hideLoading, confirm } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

const CAPTURE_DRAFT_KEY = 'teacher_capture_draft';

function isPersistentFilePath(filePath) {
  return typeof filePath === 'string' && filePath.indexOf('wxfile://usr/') === 0;
}

function persistFile(file) {
  if (!file || !file.path) {
    return Promise.resolve(file);
  }
  if (isPersistentFilePath(file.path)) {
    return Promise.resolve({
      ...file,
      persisted: true,
    });
  }
  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath: file.path,
      success(res) {
        resolve({
          ...file,
          path: res.savedFilePath || file.path,
          persisted: Boolean(res.savedFilePath),
        });
      },
      fail() {
        resolve({
          ...file,
          persisted: false,
        });
      },
    });
  });
}

function getSavedFilePathSet() {
  return new Promise((resolve) => {
    wx.getSavedFileList({
      success(res) {
        resolve(new Set((res.fileList || []).map((item) => item.filePath)));
      },
      fail() {
        resolve(null);
      },
    });
  });
}

function removeSavedFile(filePath) {
  if (!isPersistentFilePath(filePath)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.removeSavedFile({
      filePath,
      complete() {
        resolve();
      },
    });
  });
}

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
    hasDraft: false,
    draftNotice: '',
  },

  onLoad(options) {
    const { homeworkId, classId } = options;
    if (homeworkId) {
      this.setData({ selectedHomeworkId: homeworkId });
    }
    if (classId) {
      this.setData({ selectedClassId: classId });
    }
    this.loadClasses().then(() => {
      this.restoreDraft();
    });
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      if (classes.length > 0) {
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
        await this.loadHomeworks();
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
        let selectedHomeworkId = currentHomeworkId || homeworks[0].id;
        let selectedHomeworkTitle = homeworks[0].title;

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

  async restoreDraft() {
    let draft = null;
    try {
      draft = wx.getStorageSync(CAPTURE_DRAFT_KEY) || null;
    } catch (_error) {
      draft = null;
    }
    if (!draft) {
      return;
    }

    const savedPathSet = await getSavedFilePathSet();
    const restoredImages = (draft.images || []).filter((item) => {
      if (!item || !item.path) {
        return false;
      }
      if (!savedPathSet) {
        return true;
      }
      if (isPersistentFilePath(item.path)) {
        return savedPathSet.has(item.path);
      }
      return true;
    });

    const hasDraft = restoredImages.length > 0;
    if (!hasDraft) {
      return;
    }

    const cls = this.data.classes.find(c => c.id === draft.selectedClassId);
    const hw = this.data.homeworks.find(h => h.id === draft.selectedHomeworkId);

    this.setData({
      images: restoredImages,
      mode: draft.mode || 'cheap',
      hasDraft: true,
      draftNotice: `已恢复上次未上传草稿（${restoredImages.length} 张图片）`,
      selectedClassId: cls ? draft.selectedClassId : this.data.selectedClassId,
      selectedClassName: cls ? cls.name : this.data.selectedClassName,
      selectedHomeworkId: hw ? draft.selectedHomeworkId : this.data.selectedHomeworkId,
      selectedHomeworkTitle: hw ? hw.title : this.data.selectedHomeworkTitle,
    });
  },

  persistDraft(notice) {
    const { images, mode, selectedClassId, selectedHomeworkId } = this.data;
    const hasDraft = images.length > 0;

    if (!hasDraft) {
      try {
        wx.removeStorageSync(CAPTURE_DRAFT_KEY);
      } catch (_error) {}
      this.setData({ hasDraft: false, draftNotice: '' });
      return;
    }

    try {
      wx.setStorageSync(CAPTURE_DRAFT_KEY, {
        images: images.map((item) => ({
          path: item.path,
          size: item.size || 0,
        })),
        mode,
        selectedClassId,
        selectedHomeworkId,
      });
    } catch (_error) {}

    this.setData({
      hasDraft: true,
      draftNotice: notice || '草稿已自动保存',
    });
  },

  async clearDraftFiles(files) {
    await Promise.all((files || []).map((item) => removeSavedFile(item && item.path)));
  },

  async clearDraftManually() {
    const confirmed = await confirm({
      title: '清空草稿',
      content: '清空后需要重新选择图片和设置。',
      confirmText: '清空',
    });
    if (!confirmed) {
      return;
    }

    const currentImages = (this.data.images || []).slice();
    await this.clearDraftFiles(currentImages);

    try {
      wx.removeStorageSync(CAPTURE_DRAFT_KEY);
    } catch (_error) {}

    this.setData({
      images: [],
      mode: 'cheap',
      hasDraft: false,
      draftNotice: '',
      previewResult: null,
    });
    showToast('已清空草稿', 'success');
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
        hasDraft: false,
        draftNotice: '',
      });
      try {
        wx.removeStorageSync(CAPTURE_DRAFT_KEY);
      } catch (_error) {}
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
    this.persistDraft('已保存评分模式');
  },

  onCloseModeSelector() {
    this.setData({ showModeSelector: false });
  },

  async onChooseImage() {
    const maxCount = 9 - this.data.images.length;
    if (maxCount <= 0) {
      showToast('最多只能上传9张图片');
      return;
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size,
        }));

        const persistedImages = await Promise.all(tempImages.map((item) => persistFile(item)));
        const newImages = [...this.data.images, ...persistedImages];

        this.setData({
          images: newImages,
          previewResult: null,
        }, () => {
          this.persistDraft(`已保存图片草稿（${newImages.length} 张）`);
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
      }
    });
  },

  async onRemoveImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    const removed = images[index];
    images.splice(index, 1);

    if (removed && removed.path && !images.some((item) => item.path === removed.path)) {
      await removeSavedFile(removed.path);
    }

    this.setData({
      images,
      previewResult: null,
    }, () => {
      this.persistDraft(images.length ? `已更新图片草稿（${images.length} 张）` : '已清空图片草稿');
    });
  },

  async onPreview() {
    const { images } = this.data;
    if (images.length === 0) {
      showToast('请先选择图片');
      return;
    }

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

      const currentImages = this.data.images.slice();

      const result = await uploadFiles({
        url: '/teacher/submissions/batch',
        files: images.map(img => ({ path: img.path, type: 'image/jpeg' })),
        formData,
      });

      await this.clearDraftFiles(currentImages);
      try {
        wx.removeStorageSync(CAPTURE_DRAFT_KEY);
      } catch (_error) {}

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
    this.persistDraft('已保存作业选择');
  },

  onCloseHomeworkSelector() {
    this.setData({ showHomeworkSelector: false });
  },
});
