const { fetchStudentHomeworks } = require('../../services/homeworks');
const { createSubmission } = require('../../services/submissions');
const { ensureLogin } = require('../../lib/page');
const { getSubmitDraftStorageKey } = require('../../lib/draft');
const { showToast, showLoading, hideLoading, confirm } = require('../../lib/ui');
const { formatDateTime, getHomeworkStatus, pickErrorMessage } = require('../../lib/utils');
const imageCompressor = require('../../utils/image-compressor');

const MODE_OPTIONS = [
  { label: '标准批改', value: 'quality' },
  { label: '快速批改', value: 'cheap' },
];

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

function mapTempFile(file) {
  const sourcePath = file.path || file.tempFilePath || '';
  const name = sourcePath.split('/').pop() || sourcePath.split('\\').pop() || `image-${Date.now()}.jpg`;
  return {
    path: sourcePath,
    size: file.size || 0,
    name,
    type: /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg',
  };
}

Page({
  data: {
    homeworkId: '',
    loading: true,
    submitting: false,
    progress: 0,
    errorText: '',
    homework: null,
    status: null,
    dueLabel: '',
    canSubmit: false,
    modeOptions: MODE_OPTIONS,
    modeIndex: 0,
    needRewrite: true,
    files: [],
    hasDraft: false,
    draftNotice: '',
  },

  onLoad(options) {
    this.setData({
      homeworkId: options && options.homeworkId ? options.homeworkId : '',
    }, () => {
      this.restoreDraft();
    });
  },

  onShow() {
    if (!ensureLogin(`/pages/submit/index?homeworkId=${this.data.homeworkId}`)) {
      return;
    }
    this.loadHomework();
  },

  onPullDownRefresh() {
    this.loadHomework(true);
  },

  async loadHomework(fromPullDown) {
    const homeworkId = this.data.homeworkId;
    if (!homeworkId) {
      this.setData({ loading: false, errorText: '缺少作业标识' });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
      return;
    }
    this.setData({ loading: true, errorText: '' });
    try {
      const homeworks = await fetchStudentHomeworks();
      const homework = (homeworks || []).find((item) => item.id === homeworkId) || null;
      if (!homework) {
        this.setData({ loading: false, errorText: '未找到对应作业' });
        if (fromPullDown) {
          wx.stopPullDownRefresh();
        }
        return;
      }
      const status = getHomeworkStatus(homework.dueAt, homework.allowLateSubmission);
      this.setData({
        homework,
        status,
        dueLabel: homework.dueAt ? formatDateTime(homework.dueAt) : '灵活截止',
        canSubmit: status.key !== 'overdue',
      });
    } catch (error) {
      this.setData({ errorText: pickErrorMessage(error, '作业加载失败') });
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async restoreDraft() {
    const homeworkId = this.data.homeworkId;
    if (!homeworkId) {
      return;
    }
    let draft = null;
    try {
      draft = wx.getStorageSync(getSubmitDraftStorageKey(homeworkId)) || null;
    } catch (_error) {
      draft = null;
    }
    if (!draft) {
      return;
    }
    const savedPathSet = await getSavedFilePathSet();
    const restoredFiles = (draft.files || []).filter((item) => {
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
    const modeIndex = Number.isInteger(draft.modeIndex) && draft.modeIndex >= 0 && draft.modeIndex < MODE_OPTIONS.length
      ? draft.modeIndex
      : 0;
    const needRewrite = typeof draft.needRewrite === 'boolean' ? draft.needRewrite : true;
    const hasDraft = restoredFiles.length > 0 || modeIndex !== 0 || needRewrite !== true;
    if (!hasDraft) {
      return;
    }
    this.setData({
      files: restoredFiles,
      modeIndex,
      needRewrite,
      hasDraft: true,
      draftNotice: restoredFiles.length
        ? `已恢复上次未提交草稿（${restoredFiles.length} 张图片）`
        : '已恢复上次未提交设置',
    });
  },

  persistDraft(notice) {
    const homeworkId = this.data.homeworkId;
    if (!homeworkId) {
      return;
    }
    const hasDraft = (this.data.files || []).length > 0 || this.data.modeIndex !== 0 || this.data.needRewrite !== true;
    if (!hasDraft) {
      try {
        wx.removeStorageSync(getSubmitDraftStorageKey(homeworkId));
      } catch (_error) {
      }
      this.setData({ hasDraft: false, draftNotice: '' });
      return;
    }
    try {
      wx.setStorageSync(getSubmitDraftStorageKey(homeworkId), {
        modeIndex: this.data.modeIndex,
        needRewrite: this.data.needRewrite,
        files: (this.data.files || []).map((item) => ({
          path: item.path,
          size: item.size || 0,
          name: item.name || '',
          type: item.type || 'image/jpeg',
        })),
      });
    } catch (_error) {
    }
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
      content: '清空后需要重新选择图片和批改设置。',
      confirmText: '清空',
    });
    if (!confirmed) {
      return;
    }
    const currentFiles = (this.data.files || []).slice();
    await this.clearDraftFiles(currentFiles);
    try {
      wx.removeStorageSync(getSubmitDraftStorageKey(this.data.homeworkId));
    } catch (_error) {
    }
    this.setData({
      files: [],
      modeIndex: 0,
      needRewrite: true,
      hasDraft: false,
      draftNotice: '',
      progress: 0,
    });
    showToast('已清空草稿', 'success');
  },

  // 从相册选择图片
  async chooseFromAlbum() {
    const remain = 3 - this.data.files.length;
    if (remain <= 0) {
      showToast('最多上传 3 张图片');
      return;
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['original'],
      sourceType: ['album'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' });

        try {
          const tempFiles = res.tempFiles || res.tempFilePaths.map((path) => ({ path, size: 0 }));
          const nextFiles = tempFiles.map(mapTempFile);

          const invalid = nextFiles.find((item) => item.size > 10 * 1024 * 1024);
          if (invalid) {
            wx.hideLoading();
            showToast('单张图片不能超过 10MB');
            return;
          }

          const compressedPaths = await imageCompressor.compressImages(
            nextFiles.map((f) => f.path),
            80,
            1200
          );

          const compressedFiles = nextFiles.map((file, index) => ({
            ...file,
            path: compressedPaths[index] || file.path,
          }));

          const persistedFiles = await Promise.all(compressedFiles.map((item) => persistFile(item)));
          this.setData({
            files: this.data.files.concat(persistedFiles).slice(0, 3),
          }, () => {
            this.persistDraft(`已保存图片草稿（${this.data.files.length} 张）`);
          });
        } catch (err) {
          console.error('图片处理失败:', err);
          wx.hideLoading();
          showToast('图片处理失败，请重试');
        }

        wx.hideLoading();
      },
    });
  },

  // 拍照
  async takePhoto() {
    const remain = 3 - this.data.files.length;
    if (remain <= 0) {
      showToast('最多上传 3 张图片');
      return;
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['original'],
      sourceType: ['camera'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' });

        try {
          const tempFiles = res.tempFiles || res.tempFilePaths.map((path) => ({ path, size: 0 }));
          const nextFiles = tempFiles.map(mapTempFile);

          const invalid = nextFiles.find((item) => item.size > 10 * 1024 * 1024);
          if (invalid) {
            wx.hideLoading();
            showToast('单张图片不能超过 10MB');
            return;
          }

          const compressedPaths = await imageCompressor.compressImages(
            nextFiles.map((f) => f.path),
            80,
            1200
          );

          const compressedFiles = nextFiles.map((file, index) => ({
            ...file,
            path: compressedPaths[index] || file.path,
          }));

          const persistedFiles = await Promise.all(compressedFiles.map((item) => persistFile(item)));
          this.setData({
            files: this.data.files.concat(persistedFiles).slice(0, 3),
          }, () => {
            this.persistDraft(`已保存图片草稿（${this.data.files.length} 张）`);
          });
        } catch (err) {
          console.error('图片处理失败:', err);
          wx.hideLoading();
          showToast('图片处理失败，请重试');
        }

        wx.hideLoading();
      },
    });
  },

  // 选择图片（兼容旧调用，同时支持相册和相机）
  async chooseImages() {
    const remain = 3 - this.data.files.length;
    if (remain <= 0) {
      showToast('最多上传 3 张图片');
      return;
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' });

        try {
          const tempFiles = res.tempFiles || res.tempFilePaths.map((path) => ({ path, size: 0 }));
          const nextFiles = tempFiles.map(mapTempFile);

          const invalid = nextFiles.find((item) => item.size > 10 * 1024 * 1024);
          if (invalid) {
            wx.hideLoading();
            showToast('单张图片不能超过 10MB');
            return;
          }

          const compressedPaths = await imageCompressor.compressImages(
            nextFiles.map((f) => f.path),
            80,
            1200
          );

          const compressedFiles = nextFiles.map((file, index) => ({
            ...file,
            path: compressedPaths[index] || file.path,
          }));

          const persistedFiles = await Promise.all(compressedFiles.map((item) => persistFile(item)));
          this.setData({
            files: this.data.files.concat(persistedFiles).slice(0, 3),
          }, () => {
            this.persistDraft(`已保存图片草稿（${this.data.files.length} 张）`);
          });
        } catch (err) {
          console.error('图片处理失败:', err);
          wx.hideLoading();
          showToast('图片处理失败，请重试');
        }

        wx.hideLoading();
      },
    });
  },

  previewImage(event) {
    const { path } = event.currentTarget.dataset;
    if (!path) {
      return;
    }
    wx.previewImage({
      current: path,
      urls: this.data.files.map((item) => item.path),
    });
  },

  async removeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    const files = this.data.files.slice();
    const removed = files[index];
    files.splice(index, 1);
    if (removed && removed.path && !files.some((item) => item.path === removed.path)) {
      await removeSavedFile(removed.path);
    }
    this.setData({ files }, () => {
      this.persistDraft(files.length ? `已更新图片草稿（${files.length} 张）` : '已清空图片草稿');
    });
  },

  // 切换批改模式（点击卡片）
  onModeChange(e) {
    const mode = Number(e.currentTarget.dataset.mode);
    this.setData({ modeIndex: mode }, () => {
      this.persistDraft('已保存批改设置');
    });
  },

  handleModeChange(event) {
    this.setData({ modeIndex: Number(event.detail.value || 0) }, () => {
      this.persistDraft('已保存批改设置');
    });
  },

  handleRewriteChange(event) {
    this.setData({ needRewrite: Boolean(event.detail.value) }, () => {
      this.persistDraft('已保存改写设置');
    });
  },

  async handleSubmit() {
    if (!this.data.homeworkId) {
      showToast('缺少作业标识');
      return;
    }
    if (!this.data.canSubmit) {
      showToast('该作业已截止');
      return;
    }
    if (!this.data.files.length) {
      showToast('请至少选择一张图片');
      return;
    }
    this.setData({ submitting: true, progress: 0 });
    showLoading('正在提交');
    try {
      const mode = this.data.modeOptions[this.data.modeIndex].value;
      const currentFiles = this.data.files.slice();
      const result = await createSubmission({
        homeworkId: this.data.homeworkId,
        files: this.data.files,
        mode,
        needRewrite: this.data.needRewrite,
        onProgress: (progress) => {
          this.setData({ progress });
        },
      });
      await this.clearDraftFiles(currentFiles);
      try {
        wx.removeStorageSync(getSubmitDraftStorageKey(this.data.homeworkId));
      } catch (_error) {
      }
      this.setData({ hasDraft: false, draftNotice: '' });
      showToast('提交成功', 'success');
      const submissionId = result && (result.submissionId || result.id);
      if (submissionId) {
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/submission-result/index?id=${submissionId}`,
          });
        }, 280);
      }
    } catch (error) {
      showToast(pickErrorMessage(error, '提交失败，请稍后再试'));
    } finally {
      hideLoading();
      this.setData({ submitting: false });
    }
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
    this.loadHomework();
  },
});
