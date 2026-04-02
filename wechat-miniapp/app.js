const { getApiBaseUrl } = require('./lib/config');
const { getToken, getUser } = require('./lib/auth');

const STUDENT_TABS = [
  { pagePath: '/pages/homeworks/index', text: '作业', icon: '📝' },
  { pagePath: '/pages/submissions/index', text: '提交', icon: '📤' },
  { pagePath: '/pages/profile/index', text: '我的', icon: '👤' },
];

const TEACHER_TABS = [
  { pagePath: '/pages/teacher/homeworks/index', text: '作业', icon: '📝' },
  { pagePath: '/pages/teacher/capture/index', text: '拍照', icon: '📸' },
  { pagePath: '/pages/teacher/report/index', text: '报告', icon: '📈' },
  { pagePath: '/pages/teacher/profile/index', text: '我的', icon: '👨‍🏫' },
];

App({
  globalData: {
    apiBaseUrl: '',
    token: '',
    user: null,
    role: '',
    selectedClassId: '',
  },

  onLaunch() {
    this.globalData.apiBaseUrl = getApiBaseUrl();
    this.globalData.token = getToken();
    const user = getUser();
    this.globalData.user = user;
    this.globalData.role = (user && user.role) || '';
  },

  refreshSession() {
    this.globalData.apiBaseUrl = getApiBaseUrl();
    this.globalData.token = getToken();
    const user = getUser();
    this.globalData.user = user;
    this.globalData.role = (user && user.role) || '';
  },

  getTabBarList() {
    return this.globalData.role === 'TEACHER' ? TEACHER_TABS : STUDENT_TABS;
  },

  getSelectedColor() {
    return this.globalData.role === 'TEACHER' ? '#0891b2' : '#667eea';
  },
});
