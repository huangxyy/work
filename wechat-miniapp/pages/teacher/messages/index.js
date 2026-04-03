const { ensureLogin } = require('../../../lib/page');
const { showToast, showLoading, hideLoading, confirm } = require('../../../lib/ui');
const { formatDateTime, pickErrorMessage } = require('../../../lib/utils');
const { fetchNotifications, fetchUnreadCount, markAsRead, markAllRead } = require('../../../services/notifications');
const { fetchAnnouncements, createAnnouncement, deleteAnnouncement } = require('../../../services/announcements');
const { fetchClasses } = require('../../../services/teacher');

Page({
  data: {
    loading: false,
    error: '',
    tab: 'notifications',
    activeFilter: 'all',
    notifications: [],
    announcements: [],
    filteredMessages: [],
    unreadCount: 0,
    hasUnreadMessages: false,
    classes: [],
    classPickerOptions: ['全校'],
    selectedClassPickerIndex: 0,
    showCreateModal: false,
    newAnnouncement: {
      classId: '',
      title: '',
      content: '',
    },
  },

  onLoad() {
    this.loadClasses();
  },

  onShow() {
    if (!ensureLogin('/pages/teacher/messages/index')) {
      return;
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData(true);
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      const classList = classes || [];
      const classPickerOptions = ['全校', ...classList.map(c => c.name)];
      this.setData({ 
        classes: classList,
        classPickerOptions,
      });
    } catch (error) {
      console.error('加载班级失败:', error);
    }
  },

  async loadData(fromPullDown) {
    this.setData({ loading: true, error: '' });
    try {
      const [notifications, announcements, unreadResult] = await Promise.all([
        fetchNotifications(false),
        fetchAnnouncements(),
        fetchUnreadCount(),
      ]);

      const processedNotifications = (notifications || []).map((item) => ({
        ...item,
        type: 'notification',
        read: item.isRead,
        content: item.body || '',
        source: this.getTypeLabel(item.type),
        createdAt: item.createdAt,
      }));

      const processedAnnouncements = (announcements || []).map((item) => ({
        ...item,
        type: 'announcement',
        read: true,
        content: item.content,
        source: item.class && item.class.name ? item.class.name : '全校',
        authorName: item.author && item.author.name ? item.author.name : '系统',
        createdAt: item.createdAt,
      }));

      const unreadCount = unreadResult && typeof unreadResult.count === 'number' ? unreadResult.count : 0;
      const hasUnreadMessages = unreadCount > 0;

      this.setData({
        notifications: processedNotifications,
        announcements: processedAnnouncements,
        unreadCount,
        hasUnreadMessages,
      });

      this.applyFilter();

      if (hasUnreadMessages) {
        wx.setTabBarBadge({
          index: 3,
          text: unreadCount > 99 ? '99+' : String(unreadCount),
        });
      } else {
        wx.removeTabBarBadge({ index: 3 });
      }
    } catch (error) {
      const errorText = pickErrorMessage(error, '消息加载失败');
      this.setData({ error: errorText });
      showToast(errorText);
    } finally {
      this.setData({ loading: false });
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  getTypeLabel(type) {
    const map = {
      ANNOUNCEMENT: '公告',
      GRADING_DONE: '批改完成',
      HOMEWORK_NEW: '新作业',
      HOMEWORK_DEADLINE: '截止提醒',
      TEACHER_FEEDBACK: '教师反馈',
      SYSTEM: '系统',
    };
    return map[type] || type || '通知';
  },

  applyFilter() {
    const { activeFilter, notifications, announcements } = this.data;
    const allMessages = [...notifications, ...announcements].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    let filtered = allMessages;
    if (activeFilter === 'unread') {
      filtered = allMessages.filter(m => !m.read);
    } else if (activeFilter === 'notification') {
      filtered = notifications;
    } else if (activeFilter === 'announcement') {
      filtered = announcements;
    }

    this.setData({ filteredMessages: filtered });
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: filter }, () => {
      this.applyFilter();
    });
  },

  async onMessageTap(e) {
    const { id, type } = e.currentTarget.dataset;

    if (type === 'announcement') {
      const announcement = this.data.announcements.find(a => a.id === id);
      if (announcement) {
        wx.showModal({
          title: announcement.title,
          content: `${announcement.content}\n\n发布者: ${announcement.authorName || '系统'}\n班级: ${announcement.source}`,
          showCancel: false,
        });
      }
    } else {
      const notification = this.data.notifications.find(n => n.id === id);
      if (notification && !notification.read) {
        try {
          await markAsRead(id);
          const notifications = this.data.notifications.map((item) => {
            if (item.id === id) {
              return { ...item, read: true, isRead: true };
            }
            return item;
          });
          const unreadCount = Math.max(0, this.data.unreadCount - 1);
          const hasUnreadMessages = unreadCount > 0;
          this.setData({ notifications, unreadCount, hasUnreadMessages });
          this.applyFilter();

          if (hasUnreadMessages) {
            wx.setTabBarBadge({
              index: 3,
              text: unreadCount > 99 ? '99+' : String(unreadCount),
            });
          } else {
            wx.removeTabBarBadge({ index: 3 });
          }
        } catch (error) {
          console.error('标记已读失败:', error);
        }
      }

      if (notification && notification.linkTo) {
        this.navigateByLink(notification.linkTo);
      }
    }
  },

  navigateByLink(linkTo) {
    if (!linkTo) return;

    if (linkTo.indexOf('/teacher/homeworks') >= 0) {
      wx.switchTab({ url: '/pages/teacher/homeworks/index' });
    } else if (linkTo.indexOf('/teacher/classes') >= 0) {
      wx.switchTab({ url: '/pages/teacher/classes/index' });
    } else if (linkTo.indexOf('/teacher/report') >= 0) {
      wx.switchTab({ url: '/pages/teacher/report/index' });
    }
  },

  async onMarkAllRead() {
    if (!this.data.unreadCount) return;

    const confirmed = await confirm({
      title: '全部已读',
      content: '确定将所有消息标记为已读吗？',
      confirmText: '确定',
    });

    if (!confirmed) return;

    showLoading('处理中...');
    try {
      await markAllRead();
      const notifications = this.data.notifications.map((item) => ({
        ...item,
        read: true,
        isRead: true,
      }));
      this.setData({
        notifications,
        unreadCount: 0,
        hasUnreadMessages: false,
      });
      this.applyFilter();
      wx.removeTabBarBadge({ index: 3 });
      hideLoading();
      showToast('已全部标为已读', 'success');
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '操作失败'));
    }
  },

  onShowCreateModal() {
    this.setData({ 
      showCreateModal: true,
      selectedClassPickerIndex: 0,
    });
  },

  onHideCreateModal() {
    this.setData({
      showCreateModal: false,
      selectedClassPickerIndex: 0,
      'newAnnouncement.classId': '',
      'newAnnouncement.title': '',
      'newAnnouncement.content': '',
    });
  },

  onClassChange(e) {
    const index = parseInt(e.detail.value);
    const classId = index === 0 ? '' : (this.data.classes[index - 1]?.id || '');
    this.setData({ 
      'newAnnouncement.classId': classId,
      selectedClassPickerIndex: index,
    });
  },

  onTitleInput(e) {
    this.setData({ 'newAnnouncement.title': e.detail.value });
  },

  onContentInput(e) {
    this.setData({ 'newAnnouncement.content': e.detail.value });
  },

  async onCreateAnnouncement() {
    const { classId, title, content } = this.data.newAnnouncement;

    if (!title.trim()) {
      showToast('请输入公告标题');
      return;
    }
    if (!content.trim()) {
      showToast('请输入公告内容');
      return;
    }

    showLoading('发布中...');
    try {
      await createAnnouncement({
        classId: classId || undefined,
        title: title.trim(),
        content: content.trim(),
      });
      hideLoading();
      showToast('发布成功', 'success');
      this.onHideCreateModal();
      this.loadData();
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '发布失败'));
    }
  },

  async onDeleteAnnouncement(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    const confirmed = await confirm({
      title: '删除公告',
      content: '确定要删除这条公告吗？',
      confirmText: '删除',
    });

    if (!confirmed) return;

    showLoading('删除中...');
    try {
      await deleteAnnouncement(id);
      hideLoading();
      showToast('删除成功', 'success');
      this.loadData();
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '删除失败'));
    }
  },

  onRetry() {
    this.loadData();
  },
});
