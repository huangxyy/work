// 获取通知列表（模拟数据，实际应该从服务端获取）
const fetchNotifications = async () => {
  // TODO: 替换为真实的API调用
  // const { data } = await wx.request({
  //   url: `${app.globalData.apiBase}/notifications`,
  //   header: { Authorization: `Bearer ${app.globalData.token}` }
  // });
  // return data;

  // 模拟数据
  return [
    {
      id: '1',
      type: 'notification',
      title: '作业批改完成',
      content: '《英语作文练习》已批改完成，请查看学生提交情况',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
      source: '三年二班'
    },
    {
      id: '2',
      type: 'announcement',
      title: '系统维护通知',
      content: '系统将于今晚23:00-24:00进行维护升级，期间可能影响正常使用',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2小时前
      source: '系统管理员'
    },
    {
      id: '3',
      type: 'notification',
      title: '新学生加入',
      content: '张三已加入三年二班',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1天前
      source: '三年二班'
    },
    {
      id: '4',
      type: 'announcement',
      title: '功能更新公告',
      content: '新增批量上传功能，支持一次上传多个学生的作业图片',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2天前
      source: '产品团队'
    }
  ];
};

// 标记消息已读
const markAsRead = async (id) => {
  // TODO: 替换为真实的API调用
  console.log('标记已读:', id);
  return true;
};

// 批量标记已读
const markAllAsRead = async () => {
  // TODO: 替换为真实的API调用
  console.log('全部标记已读');
  return true;
};

const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    messages: [],
    filteredMessages: [],
    activeFilter: 'all',
    loading: false,
    error: '',
    hasUnreadMessages: false
  },

  onLoad() {
    this.loadMessages();
  },

  onShow() {
    // 页面显示时刷新消息列表
    if (this.data.messages.length > 0) {
      this.loadMessages();
    }
  },

  onPullDownRefresh() {
    this.loadMessages().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadMessages() {
    this.setData({ loading: true, error: '' });

    try {
      const messages = await fetchNotifications();
      this.setData({
        messages,
        loading: false
      });
      this.filterMessages();
      this.checkUnread();
    } catch (error) {
      console.error('加载消息失败:', error);
      this.setData({
        loading: false,
        error: '加载消息失败，请重试'
      });
    }
  },

  filterMessages() {
    const { messages, activeFilter } = this.data;
    let filtered = messages;

    if (activeFilter === 'unread') {
      filtered = messages.filter(m => !m.read);
    } else if (activeFilter === 'notification') {
      filtered = messages.filter(m => m.type === 'notification');
    } else if (activeFilter === 'announcement') {
      filtered = messages.filter(m => m.type === 'announcement');
    }

    this.setData({ filteredMessages: filtered });
  },

  checkUnread() {
    const hasUnread = this.data.messages.some(m => !m.read);
    this.setData({ hasUnreadMessages: hasUnread });

    // 设置TabBar徽标
    if (hasUnread) {
      const unreadCount = this.data.messages.filter(m => !m.read).length;
      wx.setTabBarBadge({
        index: 3, // 消息Tab的索引
        text: unreadCount > 99 ? '99+' : String(unreadCount)
      });
    } else {
      wx.removeTabBarBadge({ index: 3 });
    }
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: filter });
    this.filterMessages();
  },

  async onMessageTap(e) {
    const { id, type } = e.currentTarget.dataset;
    const message = this.data.messages.find(m => m.id === id);

    if (!message) return;

    // 标记为已读
    if (!message.read) {
      try {
        await markAsRead(id);
        message.read = true;
        this.setData({ messages: this.data.messages });
        this.filterMessages();
        this.checkUnread();
      } catch (error) {
        console.error('标记已读失败:', error);
      }
    }

    // 根据消息类型跳转
    if (type === 'announcement') {
      // 公告详情弹窗
      wx.showModal({
        title: message.title,
        content: message.content + '\n\n' + message.source,
        showCancel: false
      });
    } else {
      // 通知跳转到相关页面
      wx.showToast({
        title: '查看详情',
        icon: 'none'
      });
      // TODO: 跳转到相关页面
      // wx.navigateTo({
      //   url: `/pages/teacher/homework-detail/index?id=${message.homeworkId}`
      // });
    }
  },

  async onMarkAllRead() {
    try {
      showLoading('处理中...');
      await markAllAsRead();

      const messages = this.data.messages.map(m => ({ ...m, read: true }));
      this.setData({ messages });
      this.filterMessages();
      this.checkUnread();

      hideLoading();
      showToast('已全部标记为已读');
    } catch (error) {
      hideLoading();
      console.error('批量标记已读失败:', error);
      showToast('操作失败，请重试');
    }
  },

  onRetry() {
    this.loadMessages();
  }
});
