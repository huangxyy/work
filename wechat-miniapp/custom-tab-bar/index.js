const { getUser } = require('../lib/auth');

Component({
  data: {
    selected: 0,
    isTeacher: false,
    studentList: [
      { pagePath: "pages/homeworks/index", text: "作业", icon: "📋" },
      { pagePath: "pages/submissions/index", text: "提交", icon: "📝" },
      { pagePath: "pages/profile/index", text: "我的", icon: "👤" }
    ],
    teacherList: [
      { pagePath: "pages/teacher/homeworks/index", text: "作业", icon: "📋" },
      { pagePath: "pages/teacher/capture/index", text: "拍照", icon: "📷" },
      { pagePath: "pages/teacher/report/index", text: "报告", icon: "📊" },
      { pagePath: "pages/teacher/profile/index", text: "我的", icon: "👤" }
    ]
  },

  lifetimes: {
    attached() {
      this.updateRole();
    }
  },

  methods: {
    updateRole() {
      const user = getUser();
      const isTeacher = user && user.role === 'TEACHER';
      this.setData({ isTeacher });

      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const route = currentPage.route;
      const list = isTeacher ? this.data.teacherList : this.data.studentList;
      const selected = list.findIndex(item => item.pagePath === route);
      this.setData({ selected: selected >= 0 ? selected : 0 });
    },

    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = `/${data.path}`;
      wx.switchTab({ url });
    }
  }
});
