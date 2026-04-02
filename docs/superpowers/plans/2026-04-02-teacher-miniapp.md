# 微信小程序老师端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在微信小程序中新增老师端功能，支持拍照上传批改作业

**Architecture:**
- 复用现有学生端的组件、样式和工具库
- 新增老师专用页面和 API 服务层
- 登录页改造为支持多角色跳转
- 拍照上传采用"先拍照后匹配"模式

**Tech Stack:**
- 微信小程序原生框架
- 现有 Rainbow World 主题系统
- 后端 API 复用 Web 端老师接口

---

## 文件结构

### 新增文件

| 文件 | 功能 |
|------|------|
| `pages/teacher/homeworks/index.{js,wxml,wxss,json}` | 作业列表页 |
| `pages/teacher/homework-detail/index.{js,wxml,wxss,json}` | 作业详情页 |
| `pages/teacher/capture/index.{js,wxml,wxss,json}` | 拍照上传页（核心） |
| `pages/teacher/upload-result/index.{js,wxml,wxss,json}` | 上传结果页 |
| `pages/teacher/submission-detail/index.{js,wxml,wxss,json}` | 提交详情页 |
| `pages/teacher/report/index.{js,wxml,wxss,json}` | 报告页 |
| `pages/teacher/classes/index.{js,wxml,wxss,json}` | 班级管理页 |
| `pages/teacher/profile/index.{js,wxml,wxss,json}` | 个人中心页 |
| `services/teacher.js` | 老师端 API 服务 |
| `services/homeworks.js` | 作业 API 服务（新建） |
| `lib/teacher.js` | 老师端工具函数 |
| `styles/teacher.wxss` | 老师端主题样式 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `app.json` | 新增老师端页面路由和 tabBar |
| `app.js` | 扩展 globalData 支持角色信息 |
| `pages/login/index.js` | 支持老师登录和角色跳转 |
| `pages/login/index.wxml` | 移除"仅支持学生"提示 |
| `services/auth.js` | 扩展登录返回值 |

---

## Task 1: 登录页改造

**Files:**
- Modify: `pages/login/index.js:39-41, 88-96`
- Modify: `pages/login/index.wxml`
- Modify: `services/auth.js:10-15`

- [ ] **Step 1: 修改登录验证逻辑**

找到 `pages/login/index.js` 中的 onLoad 方法，移除角色限制：

```javascript
// 原代码（第 38-41 行）
const token = getToken();
const user = getUser();
if (token && user && user.role === 'STUDENT') {
  navigateAfterLogin(from || '/pages/homeworks/index');
}

// 修改为
const token = getToken();
const user = getUser();
if (token && user) {
  navigateAfterLogin(user, from || '/pages/homeworks/index');
}
```

- [ ] **Step 2: 修改登录成功处理**

找到 `pages/login/index.js` 中的 handleLogin 方法（第 86-96 行）：

```javascript
// 原代码
if (!response || !response.user || response.user.role !== 'STUDENT') {
  clearSession();
  // ...
  showToast('当前首版仅支持学生账号');
  return;
}

// 修改为
if (!response || !response.user) {
  showToast('登录失败，请稍后重试');
  return;
}
const { user } = response;
showToast('登录成功', 'success');
setTimeout(() => {
  navigateAfterLogin(user, this.data.from || '/pages/homeworks/index');
}, 280);
```

- [ ] **Step 3: 修改导航函数**

```javascript
// 原代码
function navigateAfterLogin(path) {
  if (!path || path === '/pages/homeworks/index') {
    wx.switchTab({ url: '/pages/homeworks/index' });
    return;
  }
  // ...
}

// 修改为
function navigateAfterLogin(user, path) {
  const defaultPath = user.role === 'TEACHER'
    ? '/pages/teacher/homeworks/index'
    : '/pages/homeworks/index';
  if (!path || path === '/pages/homeworks/index' || path === '/pages/teacher/homeworks/index') {
    wx.switchTab({ url: defaultPath });
    return;
  }
  if (path === '/pages/submissions/index') {
    wx.switchTab({ url: '/pages/submissions/index' });
    return;
  }
  if (path === '/pages/profile/index' || path === '/pages/teacher/profile/index') {
    wx.switchTab({ url: user.role === 'TEACHER' ? '/pages/teacher/profile/index' : '/pages/profile/index' });
    return;
  }
  wx.reLaunch({ url: path });
}
```

- [ ] **Step 4: 更新 onLoad 中的调用**

```javascript
onLoad(options) {
  const from = options && options.from ? decodeURIComponent(options.from) : '';
  this.setData({
    apiBaseUrl: getApiBaseUrl(),
    from,
  });
  const token = getToken();
  const user = getUser();
  if (token && user) {
    navigateAfterLogin(user, from || (user.role === 'TEACHER' ? '/pages/teacher/homeworks/index' : '/pages/homeworks/index'));
  }
},
```

- [ ] **Step 5: 移除 WXML 中的角色提示**

在 `pages/login/index.wxml` 中找到并移除类似"当前仅支持学生账号"的提示文本。

- [ ] **Step 6: 测试登录功能**

1. 启动小程序：在微信开发者工具中打开项目
2. 使用老师账号登录（teacher01 / 123456）
3. 验证登录成功后跳转到老师端页面（如果页面存在）

预期：登录成功，不再有"仅支持学生"的错误

- [ ] **Step 7: 提交**

```bash
git add pages/login/index.js pages/login/index.wxml
git commit -m "feat: 登录页支持老师角色"
```

---

## Task 2: 更新 app.json 配置

**Files:**
- Modify: `wechat-miniapp/app.json`

- [ ] **Step 1: 添加老师端页面路由**

在 `app.json` 的 `pages` 数组中添加老师端页面：

```json
{
  "pages": [
    "pages/login/index",
    "pages/homeworks/index",
    "pages/submissions/index",
    "pages/report/index",
    "pages/homework-detail/index",
    "pages/submit/index",
    "pages/submission-result/index",
    "pages/profile/index",
    "pages/messages/index",
    "pages/teacher/homeworks/index",
    "pages/teacher/capture/index",
    "pages/teacher/upload-result/index",
    "pages/teacher/homework-detail/index",
    "pages/teacher/submission-detail/index",
    "pages/teacher/report/index",
    "pages/teacher/classes/index",
    "pages/teacher/profile/index"
  ]
}
```

- [ ] **Step 2: 修改 tabBar 为动态配置**

由于学生和老师需要不同的 tabBar，我们需要在代码中动态设置。先移除 `app.json` 中的静态 tabBar 配置，改为在每个页面中单独配置或使用自定义 tabBar 组件。

暂时保留学生端 tabBar 作为默认值，后续可优化为动态切换。

- [ ] **Step 3: 测试配置**

1. 保存 `app.json`
2. 在微信开发者工具中点击"编译"
3. 验证页面路由正常，无语法错误

预期：编译成功，无错误

- [ ] **Step 4: 提交**

```bash
git add app.json
git commit -m "feat: 添加老师端页面路由"
```

---

## Task 3: 创建老师端 API 服务层

**Files:**
- Create: `services/teacher.js`
- Create: `services/homeworks.js`

- [ ] **Step 1: 创建 teacher.js 服务**

```javascript
const { request } = require('../lib/request');

/**
 * 获取老师的班级列表
 */
async function fetchClasses() {
  return request({
    url: '/teacher/classes',
    method: 'GET',
  });
}

/**
 * 获取班级详情
 */
async function fetchClassDetail(classId) {
  return request({
    url: `/teacher/classes/${classId}`,
    method: 'GET',
  });
}

/**
 * 获取作业列表
 */
async function fetchHomeworks(params) {
  return request({
    url: '/teacher/homeworks',
    method: 'GET',
    data: params,
  });
}

/**
 * 创建作业
 */
async function createHomework(data) {
  return request({
    url: '/teacher/homeworks',
    method: 'POST',
    data,
  });
}

/**
 * 更新作业
 */
async function updateHomework(homeworkId, data) {
  return request({
    url: `/teacher/homeworks/${homeworkId}`,
    method: 'PATCH',
    data,
  });
}

/**
 * 删除作业
 */
async function deleteHomework(homeworkId) {
  return request({
    url: `/teacher/homeworks/${homeworkId}`,
    method: 'DELETE',
  });
}

/**
 * 获取作业提交列表
 */
async function fetchSubmissions(homeworkId) {
  return request({
    url: '/teacher/submissions',
    method: 'GET',
    data: { homeworkId },
  });
}

/**
 * 获取提交详情
 */
async function fetchSubmissionDetail(submissionId) {
  return request({
    url: `/teacher/submissions/${submissionId}`,
    method: 'GET',
  });
}

/**
 * 批量上传预览（识别匹配）
 */
async function previewBatchUpload(formData) {
  return request({
    url: '/teacher/submissions/batch',
    method: 'POST',
    data: formData,
  });
}

/**
 * 创建批量上传
 */
async function createBatchUpload(formData) {
  return request({
    url: '/teacher/submissions/batch',
    method: 'POST',
    data: formData,
  });
}

/**
 * 获取批量上传列表
 */
async function fetchBatchUploads(homeworkId) {
  return request({
    url: '/teacher/submissions/batches',
    method: 'GET',
    data: { homeworkId },
  });
}

/**
 * 获取批量上传详情
 */
async function fetchBatchDetail(batchId) {
  return request({
    url: `/teacher/submissions/batches/${batchId}`,
    method: 'GET',
  });
}

/**
 * 重试跳过的提交
 */
async function retrySkipped(data) {
  return request({
    url: '/teacher/submissions/retry-skipped',
    method: 'POST',
    data,
  });
}

/**
 * 删除提交
 */
async function deleteSubmission(submissionId) {
  return request({
    url: `/teacher/submissions/${submissionId}`,
    method: 'DELETE',
  });
}

/**
 * 获取班级报告概览
 */
async function fetchClassReport(classId, rangeDays) {
  return request({
    url: '/teacher/reports/class',
    method: 'GET',
    data: { classId, rangeDays },
  });
}

/**
 * 获取评分偏好设置
 */
async function fetchGradingPreference() {
  return request({
    url: '/teacher/settings/grading/preference',
    method: 'GET',
  });
}

/**
 * 更新评分偏好设置
 */
async function updateGradingPreference(mode) {
  return request({
    url: '/teacher/settings/grading/preference',
    method: 'POST',
    data: { mode },
  });
}

module.exports = {
  fetchClasses,
  fetchClassDetail,
  fetchHomeworks,
  createHomework,
  updateHomework,
  deleteHomework,
  fetchSubmissions,
  fetchSubmissionDetail,
  previewBatchUpload,
  createBatchUpload,
  fetchBatchUploads,
  fetchBatchDetail,
  retrySkipped,
  deleteSubmission,
  fetchClassReport,
  fetchGradingPreference,
  updateGradingPreference,
};
```

- [ ] **Step 2: 创建 homeworks.js 服务（学生端通用）**

```javascript
const { request } = require('../lib/request');

/**
 * 获取作业详情
 */
async function fetchHomeworkDetail(homeworkId) {
  return request({
    url: `/homeworks/${homeworkId}`,
    method: 'GET',
  });
}

/**
 * 获取作业模板列表
 */
async function fetchTemplates() {
  return request({
    url: '/homework-templates',
    method: 'GET',
  });
}

module.exports = {
  fetchHomeworkDetail,
  fetchTemplates,
};
```

- [ ] **Step 3: 测试服务模块**

在微信开发者工具控制台测试：

```javascript
const teacher = require('../../services/teacher');
teacher.fetchClasses().then(console.log).catch(console.error);
```

预期：无语法错误，能正常加载模块

- [ ] **Step 4: 提交**

```bash
git add services/teacher.js services/homeworks.js
git commit -m "feat: 添加老师端和作业 API 服务"
```

---

## Task 4: 创建老师端主题样式

**Files:**
- Create: `styles/teacher.wxss`
- Create: `lib/teacher.js`

- [ ] **Step 1: 创建老师端主题样式**

```css
/* styles/teacher.wxss */

/* 老师端主题色变量 */
:root {
  --teacher-primary: #10b981;
  --teacher-primary-dark: #059669;
  --teacher-blue: #3b82f6;
  --teacher-blue-dark: #2563eb;
  --teacher-orange: #f59e0b;
  --teacher-orange-dark: #d97706;
  --teacher-cyan: #06b6d4;
  --teacher-cyan-dark: #0891b2;
}

/* 登录页绿色主题 */
.teacher-login-bg {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

/* 作业页蓝色主题 */
.teacher-homeworks-bg {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

/* 拍照页橙色主题 */
.teacher-capture-bg {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

/* 报告页青色主题 */
.teacher-report-bg {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

/* 个人中心绿色主题 */
.teacher-profile-bg {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

/* 老师端卡片 */
.teacher-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 老师端列表项 */
.teacher-list-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.teacher-list-item:last-child {
  border-bottom: none;
}

/* 状态标签 */
.status-tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.status-tag.done {
  background: #e6f4ea;
  color: #10b981;
}

.status-tag.processing {
  background: #e8f4fd;
  color: #3b82f6;
}

.status-tag.failed {
  background: #fee2e2;
  color: #ef4444;
}

.status-tag.queued {
  background: #f3f4f6;
  color: #6b7280;
}

/* 拍照预览网格 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding: 16rpx;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
  background: #f5f5f5;
}

.photo-item image {
  width: 100%;
  height: 100%;
}

.photo-item .remove-btn {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24rpx;
}

/* 匹配结果卡片 */
.match-result-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx;
}

.match-result-card.matched {
  border-left: 4rpx solid #10b981;
}

.match-result-card.unmatched {
  border-left: 4rpx solid #f59e0b;
}

.match-result-card.skipped {
  border-left: 4rpx solid #ef4444;
}
```

- [ ] **Step 2: 创建老师端工具库**

```javascript
// lib/teacher.js

/**
 * 获取作业状态文本
 */
function getHomeworkStatusText(status) {
  const map = {
    DRAFT: '草稿',
    PUBLISHED: '已发布',
    CLOSED: '已关闭',
  };
  return map[status] || status;
}

/**
 * 获取提交状态文本
 */
function getSubmissionStatusText(status) {
  const map = {
    QUEUED: '排队中',
    PROCESSING: '处理中',
    DONE: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
}

/**
 * 获取提交状态颜色
 */
function getSubmissionStatusColor(status) {
  const map = {
    QUEUED: 'default',
    PROCESSING: 'processing',
    DONE: 'success',
    FAILED: 'error',
  };
  return map[status] || 'default';
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 跳过原因文本
 */
function getSkipReasonText(reason) {
  const map = {
    NON_IMAGE: '非图片文件',
    ACCOUNT_NOT_FOUND: '账号不存在',
    STUDENT_NOT_FOUND: '学生不存在',
    OCR_EMPTY: '无法识别文字',
    OCR_FAILED: 'OCR识别失败',
    AI_NO_MATCH: '无法匹配学生',
    AI_AMBIGUOUS: '匹配结果不明确',
    AI_PARSE_FAILED: 'AI解析失败',
    AI_NOT_CONFIGURED: 'AI未配置',
    AI_FAILED: 'AI处理失败',
  };
  return map[reason] || reason;
}

module.exports = {
  getHomeworkStatusText,
  getSubmissionStatusText,
  getSubmissionStatusColor,
  formatDateTime,
  formatDate,
  getSkipReasonText,
};
```

- [ ] **Step 3: 测试样式和工具**

在微信开发者工具中验证样式文件无语法错误。

- [ ] **Step 4: 提交**

```bash
git add styles/teacher.wxss lib/teacher.js
git commit -m "feat: 添加老师端主题样式和工具库"
```

---

## Task 5: 创建老师端作业列表页

**Files:**
- Create: `pages/teacher/homeworks/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置文件**

```json
{
  "usingComponents": {
    "gradient-button": "/components/gradient-button/index"
  },
  "navigationBarTitleText": "作业管理"
}
```

- [ ] **Step 2: 创建页面 JS 逻辑**

```javascript
const { fetchHomeworks, fetchClasses, deleteHomework } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');
const { formatDate, getHomeworkStatusText } = require('../../../lib/teacher');

Page({
  data: {
    homeworks: [],
    classes: [],
    selectedClassId: '',
    loading: false,
  },

  onLoad() {
    this.loadClasses();
    this.loadHomeworks();
  },

  onShow() {
    // 从其他页面返回时刷新
    if (this.data.homeworks.length > 0) {
      this.loadHomeworks();
    }
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes, selectedClassId: classes[0]?.id || '' });
    } catch (error) {
      console.error('加载班级失败:', error);
    }
  },

  async loadHomeworks() {
    const { selectedClassId } = this.data;
    this.setData({ loading: true });
    try {
      const homeworks = await fetchHomeworks({ classId: selectedClassId });
      this.setData({ homeworks });
    } catch (error) {
      showToast(pickErrorMessage(error, '加载作业失败'));
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    this.setData({ selectedClassId: e.detail.value });
    this.loadHomeworks();
  },

  onAddHomework() {
    wx.navigateTo({ url: '/pages/teacher/homework-edit/index' });
  },

  onHomeworkTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/homework-detail/index?id=${id}` });
  },

  async onDeleteHomework(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    if (!homework) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除作业"${homework.title}"吗？`,
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    showLoading('删除中...');
    try {
      await deleteHomework(id);
      showToast('删除成功', 'success');
      this.loadHomeworks();
    } catch (error) {
      showToast(pickErrorMessage(error, '删除失败'));
    } finally {
      hideLoading();
    }
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="teacher-homeworks-page">
  <!-- 班级选择器 -->
  <view class="class-selector">
    <picker mode="selector" range="{{classes}}" range-key="name" value="{{selectedClassId}}" bindchange="onClassChange">
      <view class="picker-value">
        {{classes.find(c => c.id === selectedClassId)?.name || '选择班级'}}
      </view    </picker>
  </view>

  <!-- 作业列表 -->
  <view class="homework-list">
    <view wx:if="{{loading}}" class="loading">
      <text>加载中...</text>
    </view>

    <view wx:elif="{{homeworks.length === 0}}" class="empty">
      <text>暂无作业</text>
    </view>

    <view wx:else>
      <view
        wx:for="{{homeworks}}"
        wx:key="id"
        class="homework-item"
        data-id="{{item.id}}"
        bindtap="onHomeworkTap"
      >
        <view class="homework-header">
          <text class="homework-title">{{item.title}}</text>
          <text class="homework-status status-{{item.status}}">{{getHomeworkStatusText(item.status)}}</text>
        </view>
        <view class="homework-info">
          <text>截止：{{formatDate(item.dueAt)}}</text>
          <text>提交：{{item.submissionCount || 0}}/{{item.studentCount || 0}}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 添加按钮 -->
  <view class="add-btn" bindtap="onAddHomework">
    <text>+</text>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.teacher-homeworks-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.class-selector {
  padding: 24rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f0f0f0;
}

.picker-value {
  padding: 16rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  text-align: center;
}

.homework-list {
  padding: 16rpx;
}

.homework-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.homework-title {
  font-size: 32rpx;
  font-weight: bold;
}

.homework-status {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.homework-info {
  display: flex;
  justify-content: space-between;
  color: #666;
  font-size: 28rpx;
}

.add-btn {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 48rpx;
  box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.4);
}
```

- [ ] **Step 5: 测试页面**

1. 在开发者工具中编译
2. 验证作业列表页显示正常

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/homeworks/
git commit -m "feat: 添加老师端作业列表页"
```

---

## Task 6: 创建拍照上传页（核心功能）

**Files:**
- Create: `pages/teacher/capture/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {
    "gradient-button": "/components/gradient-button/index"
  },
  "navigationBarTitleText": "拍照上传"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { previewBatchUpload, createBatchUpload, fetchHomeworks } = require('../../../services/teacher');
const { uploadFiles } = require('../../../lib/request');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { pickErrorMessage } = require('../../../lib/utils');

Page({
  data: {
    mode: 'cheap', // cheap | quality
    images: [],
    selectedHomeworkId: '',
    homeworks: [],
    previewResult: null,
    showModeSelector: false,
    showHomeworkSelector: false,
    uploading: false,
  },

  onLoad() {
    this.loadHomeworks();
  },

  async loadHomeworks() {
    try {
      const homeworks = await fetchHomeworks();
      this.setData({ homeworks, selectedHomeworkId: homeworks[0]?.id || '' });
    } catch (error) {
      console.error('加载作业失败:', error);
    }
  },

  onModeChange() {
    this.setData({ showModeSelector: true });
  },

  onSelectMode(e) {
    const { mode } = e.currentTarget.dataset;
    this.setData({ mode, showModeSelector: false });
  },

  onCloseModeSelector() {
    this.setData({ showModeSelector: false });
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size,
        }));
        this.setData({
          images: [...this.data.images, ...newImages],
        });
      },
    });
  },

  onRemoveImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images, previewResult: null });
  },

  async onPreview() {
    const { images } = this.data;
    if (images.length === 0) {
      showToast('请先选择图片');
      return;
    }

    showLoading('识别中...');
    try {
      // 构建表单数据
      const formData = {
        dryRun: 'true',
      };

      // 使用自定义上传函数
      const result = await uploadFiles({
        url: '/teacher/submissions/batch',
        files: images.map(img => ({ path: img.path, type: 'image/jpeg' })),
        formData,
      });

      this.setData({ previewResult: result });
      hideLoading();

      // 显示结果
      this.showPreviewResult(result);
    } catch (error) {
      hideLoading();
      showToast(pickErrorMessage(error, '识别失败'));
    }
  },

  showPreviewResult(result) {
    const { matchedImages, unmatchedCount, groups, unmatched, skipped } = result;

    let message = `共 ${result.totalImages} 张图片\n`;
    message += `已匹配: ${matchedImages} 张\n`;
    message += `未匹配: ${unmatchedCount} 张\n`;

    if (skipped && skipped.length > 0) {
      message += `跳过: ${skipped.length} 张`;
    }

    wx.showModal({
      title: '识别结果',
      content: message,
      confirmText: '继续上传',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.onUpload();
        }
      },
    });
  },

  async onUpload() {
    const { images, mode, previewResult, selectedHomeworkId } = this.data;

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

      const result = await uploadFiles({
        url: '/teacher/submissions/batch',
        files: images.map(img => ({ path: img.path, type: 'image/jpeg' })),
        formData,
      });

      hideLoading();
      showToast('上传成功', 'success');

      // 跳转到结果页
      const batchId = result.batchId;
      wx.navigateTo({
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
    this.setData({ showHomeworkSelector: true });
  },

  onSelectHomework(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ selectedHomeworkId: id, showHomeworkSelector: false });
  },

  onCloseHomeworkSelector() {
    this.setData({ showHomeworkSelector: false });
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="capture-page">
  <!-- 模式选择 -->
  <view class="mode-selector" bindtap="onModeChange">
    <text class="mode-label">评分模式：</text>
    <text class="mode-value">{{mode === 'cheap' ? '快速评分' : '详细评分'}}</text>
  </view>

  <!-- 作业选择 -->
  <view class="homework-selector" bindtap="onHomeworkChange">
    <text class="homework-label">目标作业：</text>
    <text class="homework-value">{{homeworks.find(h => h.id === selectedHomeworkId)?.title || '请选择'}}</text>
  </view>

  <!-- 图片预览 -->
  <view class="photo-preview">
    <view class="photo-grid">
      <view wx:for="{{images}}" wx:key="index" class="photo-item">
        <image src="{{item.path}}" mode="aspectFill" />
        <view class="remove-btn" data-index="{{index}}" bindtap="onRemoveImage">×</view>
      </view>
      <view wx:if="{{images.length < 9}}" class="photo-item add-btn" bindtap="onChooseImage">
        <text>+</text>
      </view>
    </view>
  </view>

  <!-- 操作按钮 -->
  <view class="actions">
    <gradient-button bindtap="onPreview" disabled="{{images.length === 0 || uploading}}">
      识别并上传
    </gradient-button>
  </view>

  <!-- 模式选择器 -->
  <view class="selector-modal" wx:if="{{showModeSelector}}" bindtap="onCloseModeSelector">
    <view class="selector-content" catchtap="">
      <view class="selector-title">选择评分模式</view>
      <view class="selector-options">
        <view class="selector-option" data-mode="cheap" bindtap="onSelectMode">
          <text class="option-name">快速评分</text>
          <text class="option-desc">速度快，适合批量处理</text>
        </view>
        <view class="selector-option" data-mode="quality" bindtap="onSelectMode">
          <text class="option-name">详细评分</text>
          <text class="option-desc">评分详细，包含改写建议</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 作业选择器 -->
  <view class="selector-modal" wx:if="{{showHomeworkSelector}}" bindtap="onCloseHomeworkSelector">
    <view class="selector-content" catchtap="">
      <view class="selector-title">选择作业</view>
      <scroll-view class="selector-list" scroll-y>
        <view
          wx:for="{{homeworks}}"
          wx:key="id"
          class="selector-option"
          data-id="{{item.id}}"
          bindtap="onSelectHomework"
        >
          <text class="option-name">{{item.title}}</text>
          <text class="option-desc">{{item.dueAt}}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.capture-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.mode-selector,
.homework-selector {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mode-label,
.homework-label {
  font-size: 28rpx;
  color: #666;
}

.mode-value,
.homework-value {
  font-size: 28rpx;
  color: #3b82f6;
  font-weight: bold;
}

.photo-preview {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
  background: #f5f5f5;
}

.photo-item image {
  width: 100%;
  height: 100%;
}

.photo-item.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #999;
  border: 2rpx dashed #ddd;
}

.remove-btn {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24rpx;
}

.actions {
  padding: 24rpx 0;
}

.selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.selector-content {
  width: 100%;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 24rpx;
}

.selector-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
  text-align: center;
}

.selector-list {
  max-height: 60vh;
}

.selector-option {
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.option-name {
  display: block;
  font-size: 30rpx;
  margin-bottom: 8rpx;
}

.option-desc {
  display: block;
  font-size: 24rpx;
  color: #999;
}
```

- [ ] **Step 5: 测试拍照上传**

1. 选择图片
2. 点击识别
3. 验证识别结果
4. 上传到作业

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/capture/
git commit -m "feat: 添加老师端拍照上传页"
```

---

## Task 7: 创建上传结果页

**Files:**
- Create: `pages/teacher/upload-result/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "上传结果"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { fetchBatchDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText, getSkipReasonText } = require('../../../lib/teacher');

Page({
  data: {
    batchId: '',
    batch: null,
    activeTab: 0,
  },

  onLoad(options) {
    const { batchId } = options;
    if (!batchId) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ batchId });
    this.loadBatchDetail();
  },

  async loadBatchDetail() {
    const { batchId } = this.data;
    showLoading('加载中...');
    try {
      const batch = await fetchBatchDetail(batchId);
      this.setData({ batch });
    } catch (error) {
      showToast('加载失败');
    } finally {
      hideLoading();
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/submission-detail/index?id=${id}` });
  },

  onRetry() {
    this.loadBatchDetail();
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="upload-result-page">
  <view wx:if="{{!batch}}" class="loading">
    <text>加载中...</text>
  </view>

  <view wx:else>
    <!-- 概要信息 -->
    <view class="summary-card">
      <view class="summary-item">
        <text class="summary-label">总图片</text>
        <text class="summary-value">{{batch.totalImages}}</text>
      </view>
      <view class="summary-item">
        <text class="summary-label">已匹配</text>
        <text class="summary-value success">{{batch.matchedImages}}</text>
      </view>
      <view class="summary-item">
        <text class="summary-label">未匹配</text>
        <text class="summary-value warning">{{batch.unmatchedCount}}</text>
      </view>
      <view class="summary-item">
        <text class="summary-label">创建提交</text>
        <text class="summary-value">{{batch.createdSubmissions}}</text>
      </view>
    </view>

    <!-- 提交列表 -->
    <view class="section">
      <view class="section-title">提交列表</view>
      <view class="submission-list">
        <view
          wx:for="{{batch.submissions}}"
          wx:key="id"
          class="submission-item"
          data-id="{{item.id}}"
          bindtap="onViewSubmission"
        >
          <view class="submission-header">
            <text class="student-name">{{item.studentName}}</text>
            <text class="status status-{{item.status}}">{{getSubmissionStatusText(item.status)}}</text>
          </view>
          <view wx:if="{{item.totalScore}}" class="submission-score">
            得分：{{item.totalScore}}
          </view>
        </view>
      </view>
    </view>

    <!-- 跳过列表 -->
    <view wx:if="{{batch.skipped && batch.skipped.length > 0}}" class="section">
      <view class="section-title">跳过列表</view>
      <view class="skipped-list">
        <view wx:for="{{batch.skipped}}" wx:key="file" class="skipped-item">
          <text class="file-name">{{item.file}}</text>
          <text class="skip-reason">{{getSkipReasonText(item.reason)}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.upload-result-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.summary-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-around;
}

.summary-item {
  text-align: center;
}

.summary-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.summary-value {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
}

.summary-value.success {
  color: #10b981;
}

.summary-value.warning {
  color: #f59e0b;
}

.section {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.submission-item,
.skipped-item {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.submission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.student-name {
  font-size: 30rpx;
  font-weight: bold;
}

.status {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.status.DONE {
  background: #e6f4ea;
  color: #10b981;
}

.status.PROCESSING {
  background: #e8f4fd;
  color: #3b82f6;
}

.status.FAILED {
  background: #fee2e2;
  color: #ef4444;
}

.submission-score {
  font-size: 28rpx;
  color: #666;
}

.file-name {
  display: block;
  font-size: 28rpx;
  margin-bottom: 8rpx;
}

.skip-reason {
  display: block;
  font-size: 24rpx;
  color: #ef4444;
}
```

- [ ] **Step 5: 测试结果页**

1. 完成一次上传后查看结果
2. 验证状态显示正确

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/upload-result/
git commit -m "feat: 添加老师端上传结果页"
```

---

## Task 8: 创建提交详情页

**Files:**
- Create: `pages/teacher/submission-detail/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "提交详情"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { fetchSubmissionDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText } = require('../../../lib/teacher');

Page({
  data: {
    submissionId: '',
    submission: null,
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ submissionId: id });
    this.loadSubmission();
  },

  async loadSubmission() {
    const { submissionId } = this.data;
    showLoading('加载中...');
    try {
      const submission = await fetchSubmissionDetail(submissionId);
      this.setData({ submission });
    } catch (error) {
      showToast('加载失败');
    } finally {
      hideLoading();
    }
  },

  onViewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      urls: [url],
    });
  },

  onRetry() {
    this.loadSubmission();
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="submission-detail-page">
  <view wx:if="{{!submission}}" class="loading">
    <text>加载中...</text>
  </view>

  <view wx:else>
    <!-- 学生信息 -->
    <view class="info-card">
      <view class="info-row">
        <text class="label">学生</text>
        <text class="value">{{submission.studentName}}</text>
      </view>
      <view class="info-row">
        <text class="label">账号</text>
        <text class="value">{{submission.studentAccount}}</text>
      </view>
      <view class="info-row">
        <text class="label">状态</text>
        <text class="status status-{{submission.status}}">{{getSubmissionStatusText(submission.status)}}</text>
      </view>
      <view wx:if="{{submission.totalScore !== null}}" class="info-row">
        <text class="label">得分</text>
        <text class="value score">{{submission.totalScore}}</text>
      </view>
    </view>

    <!-- 图片列表 -->
    <view class="section" wx:if="{{submission.images && submission.images.length > 0}}">
      <view class="section-title">作业图片</view>
      <view class="image-list">
        <view
          wx:for="{{submission.images}}"
          wx:key="id"
          class="image-item"
          data-url="{{item.url}}"
          bindtap="onViewImage"
        >
          <image src="{{item.url}}" mode="aspectFill" />
        </view>
      </view>
    </view>

    <!-- 评分结果 -->
    <view class="section" wx:if="{{submission.gradingJson}}">
      <view class="section-title">评分详情</view>
      <view class="grading-content">
        <text>{{submission.gradingJson}}</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.submission-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.info-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #666;
}

.value {
  font-size: 28rpx;
  color: #333;
}

.value.score {
  font-size: 32rpx;
  color: #3b82f6;
  font-weight: bold;
}

.status {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.status.DONE {
  background: #e6f4ea;
  color: #10b981;
}

.status.PROCESSING {
  background: #e8f4fd;
  color: #3b82f6;
}

.status.FAILED {
  background: #fee2e2;
  color: #ef4444;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.image-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.image-item {
  aspect-ratio: 1;
  border-radius: 12rpx;
  overflow: hidden;
}

.image-item image {
  width: 100%;
  height: 100%;
}

.grading-content {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  white-space: pre-wrap;
  font-size: 28rpx;
  line-height: 1.6;
}
```

- [ ] **Step 5: 测试详情页**

1. 点击上传结果中的提交项
2. 验证详情显示正确

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/submission-detail/
git commit -m "feat: 添加老师端提交详情页"
```

---

## Task 9: 创建报告页

**Files:**
- Create: `pages/teacher/report/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "学习报告"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { fetchClasses, fetchClassReport } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    rangeDays: 7,
    report: null,
    loading: false,
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes, selectedClassId: classes[0]?.id || '' });
      if (classes.length > 0) {
        this.loadReport();
      }
    } catch (error) {
      showToast('加载班级失败');
    }
  },

  async loadReport() {
    const { selectedClassId, rangeDays } = this.data;
    if (!selectedClassId) return;

    this.setData({ loading: true });
    try {
      const report = await fetchClassReport(selectedClassId, rangeDays);
      this.setData({ report });
    } catch (error) {
      showToast('加载报告失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    this.setData({ selectedClassId: e.detail.value });
    this.loadReport();
  },

  onRangeChange(e) {
    this.setData({ rangeDays: e.detail.value });
    this.loadReport();
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="report-page">
  <!-- 筛选器 -->
  <view class="filters">
    <picker mode="selector" range="{{classes}}" range-key="name" value="{{selectedClassId}}" bindchange="onClassChange">
      <view class="filter-item">
        <text>班级：{{classes.find(c => c.id === selectedClassId)?.name || '选择'}}</text>
      </view>
    </picker>
    <picker mode="selector" range="{{[7, 14, 30]}}" bindchange="onRangeChange">
      <view class="filter-item">
        <text>范围：{{rangeDays}} 天</text>
      </view>
    </picker>
  </view>

  <!-- 统计卡片 -->
  <view wx:if="{{report}}" class="stats">
    <view class="stat-card">
      <text class="stat-value">{{report.totalStudents || 0}}</text>
      <text class="stat-label">学生总数</text>
    </view>
    <view class="stat-card">
      <text class="stat-value">{{report.summary?.count || 0}}</text>
      <text class="stat-label">提交数</text>
    </view>
    <view class="stat-card">
      <text class="stat-value">{{report.submissionRate ? (report.submissionRate * 100).toFixed(1) : 0}}%</text>
      <text class="stat-label">提交率</text>
    </view>
  </view>

  <!-- 趋势 -->
  <view wx:if="{{report && report.trend}}" class="section">
    <view class="section-title">提交趋势</view>
    <view class="trend-list">
      <view wx:for="{{report.trend}}" wx:key="date" class="trend-item">
        <text class="trend-date">{{item.date}}</text>
        <view class="trend-values">
          <text class="trend-avg">平均分: {{item.avg}}</text>
          <text class="trend-count">数量: {{item.count}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.report-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.filters {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.filter-item {
  flex: 1;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  text-align: center;
  font-size: 28rpx;
}

.stats {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.stat-card {
  flex: 1;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  text-align: center;
  color: #ffffff;
}

.stat-value {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  opacity: 0.9;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.trend-list {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.trend-item:last-child {
  border-bottom: none;
}

.trend-date {
  font-size: 28rpx;
  color: #333;
}

.trend-values {
  text-align: right;
}

.trend-avg,
.trend-count {
  display: block;
  font-size: 24rpx;
  color: #666;
}
```

- [ ] **Step 5: 测试报告页**

1. 选择班级
2. 查看统计数据

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/report/
git commit -m "feat: 添加老师端报告页"
```

---

## Task 10: 创建班级管理页

**Files:**
- Create: `pages/teacher/classes/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "班级管理"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { fetchClasses, fetchClassDetail } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    classDetail: null,
    loading: false,
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes, selectedClassId: classes[0]?.id || '' });
      if (classes.length > 0) {
        this.loadClassDetail();
      }
    } catch (error) {
      showToast('加载班级失败');
    }
  },

  async loadClassDetail() {
    const { selectedClassId } = this.data;
    if (!selectedClassId) return;

    this.setData({ loading: true });
    try {
      const classDetail = await fetchClassDetail(selectedClassId);
      this.setData({ classDetail });
    } catch (error) {
      showToast('加载班级详情失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onClassChange(e) {
    this.setData({ selectedClassId: e.detail.value });
    this.loadClassDetail();
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="classes-page">
  <!-- 班级选择器 -->
  <view class="class-selector">
    <picker mode="selector" range="{{classes}}" range-key="name" value="{{selectedClassId}}" bindchange="onClassChange">
      <view class="picker-value">
        {{classes.find(c => c.id === selectedClassId)?.name || '选择班级'}}
      </view>
    </picker>
  </view>

  <!-- 班级详情 -->
  <view wx:if="{{classDetail}}" class="class-detail">
    <view class="detail-card">
      <view class="detail-row">
        <text class="label">班级名称</text>
        <text class="value">{{classDetail.name}}</text>
      </view>
      <view class="detail-row">
        <text class="label">学生人数</text>
        <text class="value">{{classDetail.studentCount || 0}}</text>
      </view>
    </view>

    <!-- 学生列表 -->
    <view class="section">
      <view class="section-title">学生列表</view>
      <view class="student-list">
        <view wx:for="{{classDetail.students}}" wx:key="id" class="student-item">
          <text class="student-name">{{item.name}}</text>
          <text class="student-account">{{item.account}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.classes-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.class-selector {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.picker-value {
  padding: 16rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  text-align: center;
}

.detail-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #666;
}

.value {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.student-list {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx;
}

.student-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.student-item:last-child {
  border-bottom: none;
}

.student-name {
  font-size: 28rpx;
  color: #333;
}

.student-account {
  font-size: 24rpx;
  color: #999;
}
```

- [ ] **Step 5: 测试班级页**

1. 选择班级
2. 查看学生列表

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/classes/
git commit -m "feat: 添加老师端班级管理页"
```

---

## Task 11: 创建个人中心页

**Files:**
- Create: `pages/teacher/profile/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {
    "gradient-button": "/components/gradient-button/index"
  },
  "navigationBarTitleText": "我的"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { getUser } = require('../../../lib/auth');
const { logout } = require('../../../services/auth');
const { showToast } = require('../../../lib/ui');

Page({
  data: {
    user: null,
  },

  onLoad() {
    this.setData({ user: getUser() });
  },

  onShow() {
    this.setData({ user: getUser() });
  },

  async onLogout() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => resolve(res.confirm),
      });
    });

    if (!confirmed) return;

    try {
      await logout();
      showToast('已退出登录', 'success');
      wx.reLaunch({ url: '/pages/login/index' });
    } catch (error) {
      showToast('退出失败');
    }
  },

  onChangePassword() {
    wx.navigateTo({ url: '/pages/change-password/index' });
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="profile-page">
  <!-- 用户信息卡片 -->
  <view class="user-card">
    <view class="user-avatar">
      <text class="avatar-text">{{user?.name?.charAt(0) || '老'}}</text>
    </view>
    <view class="user-info">
      <text class="user-name">{{user?.name || '老师'}}</text>
      <text class="user-account">{{user?.account || ''}}</text>
    </view>
  </view>

  <!-- 菜单列表 -->
  <view class="menu-list">
    <view class="menu-item" bindtap="onChangePassword">
      <text class="menu-icon">🔒</text>
      <text class="menu-label">修改密码</text>
      <text class="menu-arrow">›</text>
    </view>
  </view>

  <!-- 退出按钮 -->
  <view class="logout-section">
    <gradient-button bindtap="onLogout">退出登录</gradient-button>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.user-card {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16rpx;
  padding: 48rpx 24rpx;
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

.user-avatar {
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.avatar-text {
  font-size: 48rpx;
  color: #ffffff;
  font-weight: bold;
}

.user-info {
  flex: 1;
}

.user-name {
  display: block;
  font-size: 32rpx;
  color: #ffffff;
  font-weight: bold;
  margin-bottom: 8rpx;
}

.user-account {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.menu-list {
  background: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 24rpx;
}

.menu-label {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-arrow {
  font-size: 48rpx;
  color: #ccc;
}

.logout-section {
  padding: 48rpx 0;
}
```

- [ ] **Step 5: 测试个人中心页**

1. 查看用户信息
2. 测试退出登录

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/profile/
git commit -m "feat: 添加老师端个人中心页"
```

---

## Task 12: 创建作业详情页

**Files:**
- Create: `pages/teacher/homework-detail/index.{js,wxml,wxss,json}`

- [ ] **Step 1: 创建页面配置**

```json
{
  "usingComponents": {},
  "navigationBarTitleText": "作业详情"
}
```

- [ ] **Step 2: 创建页面 JS**

```javascript
const { fetchHomeworks, fetchSubmissions } = require('../../../services/teacher');
const { showToast, showLoading, hideLoading } = require('../../../lib/ui');
const { getSubmissionStatusText } = require('../../../lib/teacher');

Page({
  data: {
    homeworkId: '',
    homework: null,
    submissions: [],
    loading: false,
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      showToast('参数错误');
      wx.navigateBack();
      return;
    }
    this.setData({ homeworkId: id });
    this.loadData();
  },

  async loadData() {
    const { homeworkId } = this.data;
    this.setData({ loading: true });
    try {
      const [homeworks, submissions] = await Promise.all([
        fetchHomeworks(),
        fetchSubmissions(homeworkId),
      ]);
      const homework = homeworks.find(h => h.id === homeworkId);
      this.setData({ homework, submissions });
    } catch (error) {
      showToast('加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onUploadBatch() {
    const { homeworkId } = this.data;
    wx.navigateTo({ url: `/pages/teacher/capture/index?homeworkId=${homeworkId}` });
  },

  onViewSubmission(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/submission-detail/index?id=${id}` });
  },

  onRefresh() {
    this.loadData();
  },
});
```

- [ ] **Step 3: 创建页面模板**

```xml
<view class="homework-detail-page">
  <view wx:if="{{loading}}" class="loading">
    <text>加载中...</text>
  </view>

  <view wx:elif="{{homework}}">
    <!-- 作业信息 -->
    <view class="homework-info">
      <text class="homework-title">{{homework.title}}</text>
      <text class="homework-desc">{{homework.description || ''}}</text>
      <view class="homework-meta">
        <text>截止：{{homework.dueAt || '无'}}</text>
        <text>提交：{{submissions.length}}/{{homework.studentCount || 0}}</text>
      </view>
    </view>

    <!-- 批量上传按钮 -->
    <view class="action-bar">
      <button class="upload-btn" bindtap="onUploadBatch">拍照上传</button>
    </view>

    <!-- 提交列表 -->
    <view class="section">
      <view class="section-title">提交列表 ({{submissions.length}})</view>
      <view class="submission-list">
        <view
          wx:for="{{submissions}}"
          wx:key="id"
          class="submission-item"
          data-id="{{item.id}}"
          bindtap="onViewSubmission"
        >
          <view class="submission-header">
            <text class="student-name">{{item.studentName}}</text>
            <text class="status status-{{item.status}}">{{getSubmissionStatusText(item.status)}}</text>
          </view>
          <view wx:if="{{item.totalScore !== null}}" class="submission-score">
            得分：{{item.totalScore}}
          </view>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建页面样式**

```css
.homework-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.homework-info {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.homework-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
}

.homework-desc {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.homework-meta {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: #999;
}

.action-bar {
  padding: 16rpx 0;
}

.upload-btn {
  width: 100%;
  padding: 28rpx;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  border: none;
  border-radius: 12rpx;
  font-size: 30rpx;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}

.submission-list {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx;
}

.submission-item {
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.submission-item:last-child {
  border-bottom: none;
}

.submission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.student-name {
  font-size: 28rpx;
  color: #333;
}

.status {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.status.DONE {
  background: #e6f4ea;
  color: #10b981;
}

.status.PROCESSING {
  background: #e8f4fd;
  color: #3b82f6;
}

.status.FAILED {
  background: #fee2e2;
  color: #ef4444;
}

.submission-score {
  font-size: 24rpx;
  color: #666;
}
```

- [ ] **Step 5: 测试作业详情页**

1. 从作业列表进入详情
2. 查看提交列表
3. 测试拍照上传入口

- [ ] **Step 6: 提交**

```bash
git add pages/teacher/homework-detail/
git commit -m "feat: 添加老师端作业详情页"
```

---

## Task 13: 配置老师端 tabBar

**Files:**
- Modify: `app.json`

- [ ] **Step 1: 修改 app.json**

由于微信小程序的 tabBar 是静态配置，我们需要为老师端创建单独的 tabBar。最简单的方式是创建一个自定义 tabBar 组件。

修改 `app.json`，添加自定义 tabBar 配置：

```json
{
  "pages": [
    "pages/login/index",
    "pages/homeworks/index",
    "pages/submissions/index",
    "pages/report/index",
    "pages/homework-detail/index",
    "pages/submit/index",
    "pages/submission-result/index",
    "pages/profile/index",
    "pages/messages/index",
    "pages/teacher/homeworks/index",
    "pages/teacher/capture/index",
    "pages/teacher/upload-result/index",
    "pages/teacher/homework-detail/index",
    "pages/teacher/submission-detail/index",
    "pages/teacher/report/index",
    "pages/teacher/classes/index",
    "pages/teacher/profile/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTitleText": "Homework AI",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json",
  "tabBar": {
    "custom": true,
    "color": "#7b88a1",
    "selectedColor": "#667eea",
    "backgroundColor": "#ffffff",
    "borderStyle": "white",
    "list": [
      {
        "pagePath": "pages/homeworks/index",
        "text": "作业"
      },
      {
        "pagePath": "pages/submissions/index",
        "text": "提交"
      },
      {
        "pagePath": "pages/profile/index",
        "text": "我的"
      }
    ]
  },
  "usingComponents": {
    "gradient-button": "/components/gradient-button/index"
  }
}
```

- [ ] **Step 2: 创建自定义 tabBar 组件**

创建 `custom-tab-bar/index.js`:

```javascript
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

      // 设置当前选中
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
```

创建 `custom-tab-bar/index.wxml`:

```xml
<view class="tab-bar">
  <view
    wx:for="{{isTeacher ? teacherList : studentList}}"
    wx:key="pagePath"
    class="tab-item {{selected === index ? 'selected' : ''}}"
    data-path="{{item.pagePath}}"
    data-index="{{index}}"
    bindtap="switchTab"
  >
    <text class="tab-icon">{{item.icon}}</text>
    <text class="tab-text">{{item.text}}</text>
  </view>
</view>
```

创建 `custom-tab-bar/index.wxss`:

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #ffffff;
  border-top: 1rpx solid #f0f0f0;
  display: flex;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tab-icon {
  font-size: 40rpx;
  margin-bottom: 4rpx;
}

.tab-text {
  font-size: 20rpx;
  color: #7b88a1;
}

.tab-item.selected .tab-text {
  color: #667eea;
}
```

创建 `custom-tab-bar/index.json`:

```json
{
  "component": true
}
```

- [ ] **Step 3: 测试自定义 tabBar**

1. 使用学生账号登录，查看学生 tabBar
2. 退出，使用老师账号登录，查看老师 tabBar

- [ ] **Step 4: 提交**

```bash
git add app.json custom-tab-bar/
git commit -m "feat: 添加自定义 tabBar 支持老师端"
```

---

## Task 14: 整体测试和修复

**Files:**
- 所有已修改文件

- [ ] **Step 1: 完整功能测试**

1. 使用老师账号登录
2. 测试作业列表
3. 测试拍照上传（选择图片 → 识别 → 上传）
4. 测试上传结果页
5. 测试提交详情页
6. 测试报告页
7. 测试班级管理页
8. 测试个人中心页
9. 测试退出登录

- [ ] **Step 2: 学生端回归测试**

1. 使用学生账号登录
2. 测试原有功能正常

- [ ] **Step 3: 修复发现的问题**

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "fix: 修复测试中发现的问题"
```

---

## 验收标准

- [ ] 老师账号可以正常登录
- [ ] 四个 Tab（作业、拍照、报告、我的）正常显示和切换
- [ ] 拍照上传流程完整可用（选择图片 → 识别 → 选择作业 → 上传 → 查看结果）
- [ ] 学生端功能不受影响
- [ ] 代码风格与现有代码一致
