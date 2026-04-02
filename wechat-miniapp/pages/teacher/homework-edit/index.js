const { createHomework, updateHomework, fetchHomeworks, fetchClasses } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const errorHandler = require('../../../lib/error-handler');

Page({
  data: {
    homeworkId: '',
    classId: '',
    classes: [],
    selectedClassIndex: 0,
    selectedClassName: '选择班级',
    title: '',
    description: '',
    dueAt: '',
    dueAtText: '选择截止时间',
    loading: false,
    isEditMode: false,
    loadingDetail: false,
    errors: {
      title: '',
      dueAt: ''
    }
  },

  onLoad(options) {
    const { classId, homeworkId, title, desc } = options;
    const isEditMode = !!homeworkId;

    this.setData({
      homeworkId: homeworkId || '',
      classId: classId || '',
      isEditMode,
    });

    // 从 URL 参数预填充（用于从其他页面跳转过来创建）
    if (title) {
      try {
        this.setData({ title: decodeURIComponent(title) });
      } catch (e) {
        this.setData({ title: title });
      }
    }
    if (desc) {
      try {
        this.setData({ description: decodeURIComponent(desc) });
      } catch (e) {
        this.setData({ description: desc });
      }
    }

    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      if (classes.length > 0) {
        let selectedClassIndex = 0;
        let selectedClass = classes[0];

        // 如果有指定的 classId，找到对应的索引
        if (this.data.classId) {
          const index = classes.findIndex(c => c.id === this.data.classId);
          if (index >= 0) {
            selectedClassIndex = index;
            selectedClass = classes[index];
          }
        }

        this.setData({
          classes,
          selectedClassIndex,
          selectedClassName: selectedClass.name,
          classId: selectedClass.id,
        });

        // 如果是编辑模式，加载作业详情
        if (this.data.isEditMode && this.data.homeworkId) {
          this.loadHomeworkDetail();
        }
      } else {
        showToast('暂无班级，请先创建班级');
      }
    } catch (error) {
      console.error('加载班级失败:', error);
      showToast('加载班级失败');
    }
  },

  async loadHomeworkDetail() {
    const { homeworkId, classId } = this.data;

    if (!homeworkId || !classId) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }

    this.setData({ loadingDetail: true });
    try {
      const homeworks = await fetchHomeworks({ classId });
      const homework = homeworks.find(h => h.id === homeworkId);

      if (!homework) {
        showToast('作业不存在或已被删除');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      // 解析截止时间
      let dueAt = '';
      let dueAtText = '选择截止时间';
      if (homework.dueAt) {
        const date = new Date(homework.dueAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dueAt = `${year}-${month}-${day}`;
        dueAtText = `${year}-${month}-${day}`;
      }

      this.setData({
        title: homework.title || '',
        description: homework.description || '',
        dueAt,
        dueAtText,
      });
    } catch (error) {
      console.error('加载作业详情失败:', error);
      showToast('加载作业详情失败');
    } finally {
      this.setData({ loadingDetail: false });
    }
  },

  onClassChange(e) {
    const index = parseInt(e.detail.value);
    const selectedClass = this.data.classes[index];
    if (selectedClass) {
      this.setData({
        classId: selectedClass.id,
        selectedClassIndex: index,
        selectedClassName: selectedClass.name,
      });
    }
  },

  onTitleInput(e) {
    const title = e.detail.value;
    const error = this.validateTitle(title);
    this.setData({ 
      title,
      'errors.title': error
    });
  },

  validateTitle(title) {
    if (!title || !title.trim()) {
      return '请输入作业标题';
    }
    if (title.length > 255) {
      return '标题不能超过255个字符';
    }
    return '';
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  onDateChange(e) {
    const value = e.detail.value;
    const error = this.validateDueAt(value);
    this.setData({
      dueAt: value,
      dueAtText: value || '选择截止时间',
      'errors.dueAt': error
    });
  },

  validateDueAt(dueAt) {
    if (!dueAt) {
      return '';
    }
    const dueDate = new Date(dueAt);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (dueDate < now) {
      return '截止时间不能早于今天';
    }
    return '';
  },

  validateForm() {
    const { title, dueAt } = this.data;
    
    const titleError = this.validateTitle(title);
    const dueAtError = this.validateDueAt(dueAt);

    this.setData({
      'errors.title': titleError,
      'errors.dueAt': dueAtError
    });

    return !titleError && !dueAtError;
  },

  async onSave() {
    const { classId, title, description, dueAt, isEditMode, homeworkId } = this.data;

    if (!classId) {
      showToast('请选择班级');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({ loading: true });
    showLoading(isEditMode ? '更新中...' : '保存中...');

    try {
      const data = {
        classId,
        title: title.trim(),
        description: description.trim() || '',
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      };

      if (isEditMode && homeworkId) {
        await updateHomework(homeworkId, data);
        hideLoading();
        showToast('更新成功', 'success');
      } else {
        await createHomework(data);
        hideLoading();
        showToast('创建成功', 'success');
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      hideLoading();
      errorHandler.handle(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  onCancel() {
    if (this.data.loading) return;
    wx.navigateBack();
  },
});
