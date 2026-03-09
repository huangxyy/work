const { ensureLogin } = require('../../lib/page');
const { showToast, showLoading, hideLoading, confirm } = require('../../lib/ui');
const { formatDateTime, pickErrorMessage } = require('../../lib/utils');
const { fetchNotifications, fetchUnreadCount, markAsRead, markAllRead } = require('../../services/notifications');
const { fetchAnnouncements } = require('../../services/announcements');

Page({
  data: {
    loading: false,
    errorText: '',
    tab: 'notifications',
    notifications: [],
    announcements: [],
    unreadCount: 0,
    markingAll: false,
  },
  onShow() {
    if (!ensureLogin('/pages/messages/index')) {
      return;
    }
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData(true);
  },
  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab && tab !== this.data.tab) {
      this.setData({ tab });
    }
  },
  async loadData(fromPullDown) {
    this.setData({ loading: true, errorText: '' });
    try {
      const [notifications, announcements, unreadResult] = await Promise.all([
        fetchNotifications(false),
        fetchAnnouncements(),
        fetchUnreadCount(),
      ]);
      this.setData({
        notifications: (notifications || []).map((item) => ({
          ...item,
          timeLabel: item.createdAt ? formatDateTime(item.createdAt) : '',
          typeLabel: this.getTypeLabel(item.type),
        })),
        announcements: (announcements || []).map((item) => ({
          ...item,
          timeLabel: item.createdAt ? formatDateTime(item.createdAt) : '',
          authorName: item.author && item.author.name ? item.author.name : '系统',
          className: item.class && item.class.name ? item.class.name : '全校',
        })),
        unreadCount: unreadResult && typeof unreadResult.count === 'number' ? unreadResult.count : 0,
      });
    } catch (error) {
      const errorText = pickErrorMessage(error, '消息加载失败');
      this.setData({ errorText });
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
  async handleRead(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    try {
      await markAsRead(id);
      const notifications = this.data.notifications.map((item) => {
        if (item.id === id) {
          return { ...item, isRead: true };
        }
        return item;
      });
      const unreadCount = Math.max(0, this.data.unreadCount - 1);
      this.setData({ notifications, unreadCount });
    } catch (_error) {
    }
    const notification = this.data.notifications.find((item) => item.id === id);
    if (notification && notification.linkTo) {
      this.navigateByLink(notification.linkTo);
    }
  },
  async handleMarkAllRead() {
    if (this.data.markingAll || !this.data.unreadCount) {
      return;
    }
    this.setData({ markingAll: true });
    try {
      await markAllRead();
      const notifications = this.data.notifications.map((item) => ({
        ...item,
        isRead: true,
      }));
      this.setData({ notifications, unreadCount: 0 });
      showToast('已全部标为已读', 'success');
    } catch (error) {
      showToast(pickErrorMessage(error, '操作失败'));
    } finally {
      this.setData({ markingAll: false });
    }
  },
  navigateByLink(linkTo) {
    if (!linkTo) {
      return;
    }
    if (linkTo.indexOf('/student/submissions') >= 0) {
      wx.switchTab({ url: '/pages/submissions/index' });
    } else if (linkTo.indexOf('/student/homeworks') >= 0) {
      wx.switchTab({ url: '/pages/homeworks/index' });
    } else if (linkTo.indexOf('/student/report') >= 0) {
      wx.navigateTo({ url: '/pages/report/index' });
    }
  },
  retryLoad() {
    this.loadData();
  },
});
