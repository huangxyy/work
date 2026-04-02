const helpTips = {
  'homeworks': {
    title: '作业管理',
    tips: [
      '点击作业卡片查看详情和提交情况',
      '点击右下角"+"按钮创建新作业',
      '使用筛选器快速查找作业',
      '下拉刷新获取最新数据'
    ]
  },
  'capture': {
    title: '批量上传',
    tips: [
      '选择班级和目标作业',
      '一次最多上传9张图片',
      '系统会自动识别学生姓名和内容',
      '选择评分模式：快速评分速度快，详细评分更全面'
    ]
  },
  'report': {
    title: '班级报告',
    tips: [
      '查看班级整体学习情况',
      '切换时间范围查看不同周期数据',
      '点击图表查看详细数据',
      '导出 PDF 报告分享给家长'
    ]
  },
  'profile': {
    title: '个人中心',
    tips: [
      '查看和修改个人信息',
      '管理班级和评分设置',
      '切换 API 地址',
      '查看缓存和清理数据'
    ]
  }
};

function showHelp(pageId) {
  const help = helpTips[pageId];
  if (!help) return;

  wx.showModal({
    title: help.title,
    content: help.tips.join('\n'),
    showCancel: false,
    confirmText: '知道了'
  });
}

function getHelpTips(pageId) {
  return helpTips[pageId] || null;
}

module.exports = {
  showHelp,
  getHelpTips
};
