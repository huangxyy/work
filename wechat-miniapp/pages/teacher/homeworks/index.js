const { fetchHomeworks, fetchClasses, deleteHomework } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const performance = require('../../../lib/performance');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    homeworks: [],
    classes: [],
    selectedClassId: '',
    selectedIndex: 0,
    selectedClassName: '选择班级',
    loading: false,
    error: '',
    userName: '老师',
    activeFilter: 'all',
    showClassSelector: false,
    homeworkCount: 0,
    classCount: 0,
    openCount: 0,
    closedCount: 0,
    filteredHomeworks: [],
    isInitialLoad: true,
    page: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
  },

  onLoad() {
    this.loadUserInfo();
    this.loadClasses();
  },

  onShow() {
    const globalClassId = getApp().globalData.selectedClassId;
    if (globalClassId && globalClassId !== this.data.selectedClassId) {
      const index = this.data.classes.findIndex(c => c.id === globalClassId);
      if (index >= 0) {
        this.setData({
          selectedClassId: globalClassId,
          selectedIndex: index,
          selectedClassName: this.data.classes[index].name,
        });
        this.loadHomeworks(true);
        return;
      }
    }
    if (!this.data.isInitialLoad && this.data.selectedClassId) {
      this.loadHomeworks(true);
    }
  },

  onPullDownRefresh() {
    this.loadHomeworks(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.name) {
        this.setData({ userName: userInfo.name });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      if (classes && classes.length > 0) {
        // 优先使用之前选中的班级
        let selectedClassId = this.data.selectedClassId || classes[0].id;
        let selectedIndex = classes.findIndex(c => c.id === selectedClassId);
        if (selectedIndex < 0) {
          selectedIndex = 0;
          selectedClassId = classes[0].id;
        }

        const selectedClass = classes[selectedIndex];
        this.setData({
          classes,
          selectedClassId,
          selectedClassName: selectedClass.name,
          selectedIndex,
          classCount: classes.length,
        });
        this.loadHomeworks();
      } else {
        this.setData({
          classes: [],
          selectedClassId: '',
          selectedClassName: '暂无班级',
          selectedIndex: 0,
          classCount: 0,
          homeworks: [],
          filteredHomeworks: [],
          homeworkCount: 0,
          openCount: 0,
          closedCount: 0,
        });
      }
    } catch (error) {
      console.error('加载班级失败:', error);
      showToast('加载班级失败');
      this.setData({ error: '加载班级失败，请重试' });
    } finally {
      this.setData({ isInitialLoad: false });
    }
  },

  async loadHomeworks(refresh = false) {
    const { selectedClassId, page, pageSize, loadingMore, hasMore } = this.data;
    
    if (!selectedClassId) {
      this.setData({
        homeworks: [],
        filteredHomeworks: [],
        homeworkCount: 0,
        openCount: 0,
        closedCount: 0,
      });
      return;
    }

    if (loadingMore || (!refresh && !hasMore)) return;

    if (refresh) {
      this.setData({ 
        page: 1, 
        hasMore: true, 
        homeworks: [],
        loading: true 
      });
    } else {
      this.setData({ loadingMore: true });
    }

    this.setData({ error: '' });
    
    const startTime = Date.now();
    
    try {
      const homeworks = await fetchHomeworks({ 
        classId: selectedClassId,
        page: refresh ? 1 : page,
        pageSize 
      });

      const validHomeworks = Array.isArray(homeworks) ? homeworks : [];

      this.setData({ 
        homeworks: refresh ? validHomeworks : [...this.data.homeworks, ...validHomeworks],
        page: (refresh ? 1 : page) + 1,
        hasMore: validHomeworks.length === pageSize
      }, () => {
        this.calculateStats();
        this.applyFilter();
      });

      const duration = Date.now() - startTime;
      performance.recordPageLoad('homeworks', duration);
      
      if (refresh) {
        cache.set(`homeworks_${selectedClassId}`, validHomeworks, 5 * 60 * 1000);
      }
    } catch (error) {
      errorHandler.handle(error, {
        onRetry: () => this.loadHomeworks(refresh)
      });
    } finally {
      this.setData({ 
        loading: false,
        loadingMore: false
      });
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadHomeworks();
    }
  },

  calculateStats() {
    const { homeworks } = this.data;
    const now = new Date();

    const ongoingCount = homeworks.filter(h => {
      if (!h.dueAt) return true;
      return new Date(h.dueAt) > now;
    }).length;

    const expiredCount = homeworks.filter(h => {
      if (!h.dueAt) return false;
      return new Date(h.dueAt) <= now;
    }).length;

    this.setData({
      homeworkCount: homeworks.length,
      openCount: ongoingCount,
      closedCount: expiredCount,
    });
  },

  applyFilter() {
    const { homeworks, activeFilter } = this.data;
    const now = new Date();

    let filteredHomeworks = [];

    if (activeFilter === 'all') {
      filteredHomeworks = [...homeworks];
    } else if (activeFilter === 'ongoing') {
      filteredHomeworks = homeworks.filter(h => !h.dueAt || new Date(h.dueAt) > now);
    } else if (activeFilter === 'expired') {
      filteredHomeworks = homeworks.filter(h => h.dueAt && new Date(h.dueAt) <= now);
    }

    this.setData({ filteredHomeworks });
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: filter }, () => {
      this.applyFilter();
    });
  },

  onShowClassSelector() {
    this.setData({ showClassSelector: true });
  },

  onHideClassSelector() {
    this.setData({ showClassSelector: false });
  },

  onSelectClass(e) {
    const classId = e.currentTarget.dataset.id;
    const selectedClass = this.data.classes.find(c => c.id === classId);

    if (selectedClass) {
      this.setData({
        selectedClassId: selectedClass.id,
        selectedClassName: selectedClass.name,
        showClassSelector: false,
      });
      this.loadHomeworks();
    }
  },

  onRetry() {
    this.loadClasses();
  },

  onAddHomework() {
    const { selectedClassId } = this.data;
    const url = selectedClassId
      ? `/pages/teacher/homework-edit/index?classId=${selectedClassId}`
      : '/pages/teacher/homework-edit/index';
    wx.navigateTo({ url });
  },

  onHomeworkTap(e) {
    const { id } = e.currentTarget.dataset;
    const { selectedClassId } = this.data;
    wx.navigateTo({
      url: `/pages/teacher/homework-detail/index?id=${id}&classId=${selectedClassId}`
    });
  },

  onHomeworkLongPress(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    if (!homework) return;

    wx.showActionSheet({
      itemList: ['编辑作业', '删除作业'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.onEditHomework(id);
        } else if (res.tapIndex === 1) {
          this.onDeleteHomework(id);
        }
      },
    });
  },

  onEditHomework(homeworkId) {
    const { selectedClassId } = this.data;
    wx.navigateTo({
      url: `/pages/teacher/homework-edit/index?homeworkId=${homeworkId}&classId=${selectedClassId}`
    });
  },

  async onDeleteHomework(e) {
    let id;
    if (typeof e === 'string') {
      id = e;
    } else {
      id = e.currentTarget.dataset.id;
    }
    const homework = this.data.homeworks.find(h => h.id === id);
    if (!homework) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除作业"${homework.title}"吗？删除后无法恢复。`,
        confirmColor: '#ef4444',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    showLoading('删除中...');
    try {
      await deleteHomework(id);
      hideLoading();
      showToast('删除成功', 'success');
      this.loadHomeworks(true);
    } catch (error) {
      hideLoading();
      const errorMsg = pickErrorMessage(error, '删除失败');
      
      if (errorMsg.includes('still queued') || errorMsg.includes('being graded')) {
        wx.showModal({
          title: '无法删除',
          content: '有提交正在批改中，是否强制删除？（未完成的批改将丢失）',
          confirmText: '强制删除',
          confirmColor: '#ef4444',
          success: async (res) => {
            if (res.confirm) {
              showLoading('删除中...');
              try {
                await deleteHomework(id, true);
                hideLoading();
                showToast('删除成功', 'success');
                this.loadHomeworks(true);
              } catch (err2) {
                hideLoading();
                showToast(pickErrorMessage(err2, '删除失败'));
              }
            }
          },
        });
      } else {
        showToast(errorMsg);
      }
    }
  },

  onShowHelp() {
    showHelp('homeworks');
  },
});
