# 微信小程序彩虹世界重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信小程序重构为"彩虹世界"设计风格，提升视觉效果和用户体验

**Architecture:** 渐进式重构 - 先建立新的样式系统和组件库，然后逐页重构。使用 CSS 变量实现主题切换，创建可复用的组件模板。

**Tech Stack:** 微信小程序原生框架、WXSS、JavaScript

---

## 文件结构映射

### 新增文件
```
wechat-miniapp/
├── styles/
│   ├── theme.wxss          # 主题变量（CSS变量、配色）
│   ├── components.wxss     # 通用组件样式
│   └── animations.wxss     # 动画效果
├── components/
│   ├── gradient-button/    # 渐变按钮组件
│   ├── status-tag/         # 状态标签组件
│   ├── rainbow-card/       # 彩虹卡片组件
│   ├── upload-area/        # 上传区域组件
│   └── skeleton-loading/   # 骨架屏组件
└── utils/
    └── image-compressor.js # 图片压缩工具
```

### 修改文件
```
wechat-miniapp/
├── app.wxss                # 全局样式（引入新样式系统）
├── app.json                # 页面配置
└── pages/*/                # 所有页面文件
```

---

## Task 1: 创建主题样式系统

**Files:**
- Create: `wechat-miniapp/styles/theme.wxss`
- Create: `wechat-miniapp/styles/components.wxss`
- Create: `wechat-miniapp/styles/animations.wxss`
- Modify: `wechat-miniapp/app.wxss:1-30`

- [ ] **Step 1: 创建主题变量文件**

```wxss
/* styles/theme.wxss */
page {
  --primary-purple: #667eea;
  --secondary-purple: #764ba2;
  --primary-pink: #f093fb;
  --secondary-pink: #f5576c;
  --primary-blue: #4facfe;
  --secondary-blue: #00f2fe;
  --primary-green: #43e97b;
  --secondary-green: #38f9d7;
  --primary-orange: #fa709a;
  --secondary-orange: #fee140;

  --text-primary: #333333;
  --text-secondary: #666666;
  --text-muted: #999999;
  --bg-page: #f5f5f5;
  --bg-card: #ffffff;

  --border-radius-large: 32rpx;
  --border-radius-medium: 24rpx;
  --border-radius-small: 16rpx;
  --border-radius-pill: 999rpx;

  --shadow-soft: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  --shadow-card: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

/* 页面主题色 - 作业列表 */
.theme-homeworks {
  --gradient-primary: linear-gradient(135deg, var(--primary-purple) 0%, var(--secondary-purple) 100%);
  --color-primary: var(--primary-purple);
}

/* 页面主题色 - 提交作业 */
.theme-submit {
  --gradient-primary: linear-gradient(135deg, var(--primary-pink) 0%, var(--secondary-pink) 100%);
  --color-primary: var(--primary-pink);
}

/* 页面主题色 - 批改结果 */
.theme-result {
  --gradient-primary: linear-gradient(135deg, var(--primary-blue) 0%, var(--secondary-blue) 100%);
  --color-primary: var(--primary-blue);
}

/* 页面主题色 - 个人中心 */
.theme-profile {
  --gradient-primary: linear-gradient(135deg, var(--primary-green) 0%, var(--secondary-green) 100%);
  --color-primary: var(--primary-green);
}

/* 页面主题色 - 消息通知 */
.theme-messages {
  --gradient-primary: linear-gradient(135deg, var(--primary-orange) 0%, var(--secondary-orange) 100%);
  --color-primary: var(--primary-orange);
}
```

- [ ] **Step 2: 创建组件样式文件**

```wxss
/* styles/components.wxss */

/* 渐变按钮 */
.btn-gradient {
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 48rpx;
  border-radius: var(--border-radius-pill);
  border: none;
  background: var(--gradient-primary);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: var(--shadow-soft);
}

.btn-gradient::after {
  border: none;
}

.btn-gradient[disabled] {
  opacity: 0.5;
}

/* 次要按钮 */
.btn-secondary {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 40rpx;
  border-radius: var(--border-radius-pill);
  background: #ffffff;
  color: var(--color-primary);
  border: 4rpx solid var(--color-primary);
  font-size: 28rpx;
  font-weight: 500;
}

.btn-secondary::after {
  border: none;
}

/* 状态标签 */
.status-tag {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 24rpx;
  border-radius: var(--border-radius-pill);
  font-size: 22rpx;
  font-weight: 500;
}

.status-tag.progress {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #ffffff;
}

.status-tag.done {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #ffffff;
}

.status-tag.late {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #ffffff;
}

.status-tag.expired {
  background: #e0e0e0;
  color: #999999;
}

.status-tag.urgent {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #ffffff;
}

/* 彩虹卡片 */
.rainbow-card {
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 32rpx;
  box-shadow: var(--shadow-card);
}

.rainbow-card-hero {
  background: var(--gradient-primary);
  color: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 48rpx 32rpx;
  box-shadow: var(--shadow-card);
}

/* 筛选胶囊 */
.filter-chips {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding: 8rpx 0;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  padding: 16rpx 32rpx;
  border-radius: var(--border-radius-pill);
  font-size: 26rpx;
  white-space: nowrap;
  background: #ffffff;
  color: var(--text-secondary);
}

.filter-chip.active {
  background: var(--gradient-primary);
  color: #ffffff;
}

/* 图片上传区 */
.upload-area {
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 48rpx 32rpx;
  text-align: center;
  border: 4rpx dashed var(--color-primary);
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.upload-hint {
  color: var(--color-primary);
  font-size: 28rpx;
  font-weight: 600;
}

.upload-subhint {
  color: var(--text-muted);
  font-size: 24rpx;
  margin-top: 8rpx;
}

/* 图片预览网格 */
.image-preview-grid {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.image-preview-item {
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--border-radius-medium);
  background: #f0f0f0;
  position: relative;
}

.image-preview-add {
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 48rpx;
}

/* 输入框组件 */
.rainbow-input {
  min-height: 88rpx;
  width: 100%;
  padding: 24rpx 32rpx;
  border-radius: var(--border-radius-medium);
  background: #f5f5f5;
  border: none;
  font-size: 28rpx;
  color: var(--text-primary);
}

.rainbow-input.focused {
  background: #ffffff;
  border: 4rpx solid var(--color-primary);
}
```

- [ ] **Step 3: 创建动画样式文件**

```wxss
/* styles/animations.wxss */

/* 淡入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

/* 缩放动画 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scaleIn 0.3s ease-out;
}

/* 旋转加载动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  display: inline-block;
  width: 48rpx;
  height: 48rpx;
  border: 6rpx solid var(--color-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 脉冲动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.pulse {
  animation: pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 4: 更新全局样式**

```wxss
/* app.wxss */
@import "styles/theme.wxss";
@import "styles/components.wxss";
@import "styles/animations.wxss";

page {
  min-height: 100%;
  background: var(--bg-page);
  color: var(--text-primary);
  font-size: 28rpx;
}

view, text, button, input, picker, switch, textarea {
  box-sizing: border-box;
}

.container {
  padding: 32rpx;
}

/* 保留有用的旧样式类，但使用新变量 */
.card {
  background: var(--bg-card);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-soft);
  padding: 32rpx;
}
```

- [ ] **Step 5: 提交变更**

```bash
git add wechat-miniapp/styles/ wechat-miniapp/app.wxss
git commit -m "feat: add rainbow world theme system"
```

---

## Task 2: 创建图片压缩工具

**Files:**
- Create: `wechat-miniapp/utils/image-compressor.js`

- [ ] **Step 1: 创建图片压缩工具**

```javascript
// utils/image-compressor.js

/**
 * 压缩图片
 * @param {string} filePath - 图片临时路径
 * @param {number} quality - 压缩质量 0-100，默认 80
 * @param {number} maxWidth - 最大宽度，默认 1200
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressImage(filePath, quality = 80, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    // 获取图片信息
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        let { width, height } = info;

        // 计算压缩后的尺寸
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        // 压缩图片
        wx.compressImage({
          src: filePath,
          quality,
          width,
          height,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            console.error('图片压缩失败:', err);
            // 压缩失败，返回原图
            resolve(filePath);
          }
        });
      },
      fail: (err) => {
        console.error('获取图片信息失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 压缩多张图片
 * @param {Array<string>} filePaths - 图片路径数组
 * @param {number} quality - 压缩质量
 * @param {number} maxWidth - 最大宽度
 * @returns {Promise<Array<string>>} 压缩后的路径数组
 */
async function compressImages(filePaths, quality = 80, maxWidth = 1200) {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const compressed = await compressImage(filePath, quality, maxWidth);
      results.push(compressed);
    } catch (err) {
      results.push(filePath); // 失败时使用原图
    }
  }
  return results;
}

module.exports = {
  compressImage,
  compressImages
};
```

- [ ] **Step 2: 提交变更**

```bash
git add wechat-miniapp/utils/image-compressor.js
git commit -m "feat: add image compression utility"
```

---

## Task 3: 重构作业列表页

**Files:**
- Modify: `wechat-miniapp/pages/homeworks/index.wxml`
- Modify: `wechat-miniapp/pages/homeworks/index.wxss`
- Modify: `wechat-miniapp/pages/homeworks/index.js`

- [ ] **Step 1: 更新作业列表页 WXML**

```xml
<!-- pages/homeworks/index.wxml -->
<view class="page theme-homeworks">
  <!-- 顶部欢迎区 -->
  <view class="welcome-hero fade-in">
    <view class="welcome-text">Hi，{{userInfo.nickname}} 👋</view>
    <view class="welcome-subtitle">今天有 {{pendingCount}} 个作业待完成</view>
  </view>

  <!-- 筛选区 -->
  <view class="filter-section scale-in">
    <scroll-view class="filter-chips" scroll-x enable-flex>
      <view class="filter-chip {{activeFilter === 'all' ? 'active' : ''}}" bindtap="onFilterChange" data-filter="all">全部</view>
      <view class="filter-chip {{activeFilter === 'ongoing' ? 'active' : ''}}" bindtap="onFilterChange" data-filter="ongoing">进行中</view>
      <view class="filter-chip {{activeFilter === 'late' ? 'active' : ''}}" bindtap="onFilterChange" data-filter="late">待补交</view>
      <view class="filter-chip {{activeFilter === 'expired' ? 'active' : ''}}" bindtap="onFilterChange" data-filter="expired">已截止</view>
    </scroll-view>
  </view>

  <!-- 作业列表 -->
  <view class="homework-list">
    <view wx:if="{{loading}}" class="loading-container">
      <view class="spinner"></view>
      <view class="loading-text">加载中...</view>
    </view>

    <view wx:elif="{{list.length === 0}}" class="empty-state">
      <view class="empty-icon">📚</view>
      <view class="empty-title">暂无作业</view>
    </view>

    <view wx:else>
      <view wx:for="{{list}}" wx:key="id" class="homework-card fade-in" style="animation-delay: {{index * 0.05}}s" bindtap="onHomeworkTap" data-id="{{item.id}}">
        <view class="card-header">
          <view class="homework-title">{{item.title}}</view>
          <view class="status-tag {{item.statusClass}}">{{item.statusText}}</view>
        </view>
        <view class="homework-meta">
          <text class="meta-text">📅 截止：{{item.deadlineText}}</text>
        </view>
        <view wx:if="{{item.urgent}}" class="urgent-hint">
          <text>⚠️ 即将截止，请尽快提交</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新作业列表页 WXSS**

```wxss
/* pages/homeworks/index.wxss */
@import "../../styles/components.wxss";

.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 120rpx;
}

/* 欢迎区 */
.welcome-hero {
  margin: -32rpx -32rpx 32rpx -32rpx;
  padding: 64rpx 32rpx 48rpx;
  background: var(--gradient-primary);
  border-radius: 0 0 48rpx 48rpx;
  color: #ffffff;
}

.welcome-text {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.welcome-subtitle {
  font-size: 28rpx;
  opacity: 0.9;
}

/* 筛选区 */
.filter-section {
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

/* 作业列表 */
.homework-list {
  padding: 0 8rpx;
}

.homework-card {
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}

.homework-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  padding-right: 16rpx;
}

.homework-meta {
  margin-top: 12rpx;
}

.meta-text {
  font-size: 24rpx;
  color: var(--text-muted);
}

.urgent-hint {
  margin-top: 16rpx;
  padding: 12rpx 16rpx;
  background: #fff5f5;
  border-radius: var(--border-radius-small);
  font-size: 24rpx;
  color: var(--secondary-pink);
}

/* 加载状态 */
.loading-container {
  padding: 80rpx 0;
  text-align: center;
}

.loading-text {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--text-muted);
}

/* 空状态 */
.empty-state {
  padding: 120rpx 32rpx;
  text-align: center;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 32rpx;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: 更新作业列表页 JS（添加主题样式类）**

在 `index.js` 的 `onReady` 方法中添加：

```javascript
// pages/homeworks/index.js

Page({
  // ... 现有代码

  onReady() {
    // 设置页面主题
    wx.setNavigationBarTitle({
      title: '我的作业'
    });
  },

  // 计算作业状态样式类
  getStatusClass(status) {
    const statusMap = {
      'OPEN': 'progress',
      'LATE': 'late',
      'EXPIRED': 'expired',
      'DONE': 'done'
    };
    return statusMap[status] || '';
  },

  // 格式化截止时间
  formatDeadline(deadline) {
    if (!deadline) return '未设截止';
    const date = new Date(deadline);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return '已截止';
    if (diff < 86400000) return '今天 ' + this.formatTime(date);
    if (diff < 172800000) return '明天 ' + this.formatTime(date);
    return this.formatDate(date);
  },

  formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${this.formatTime(date)}`;
  }
});
```

- [ ] **Step 4: 提交变更**

```bash
git add wechat-miniapp/pages/homeworks/
git commit -m "refactor(homeworks): apply rainbow world design"
```

---

## Task 4: 重构提交作业页

**Files:**
- Modify: `wechat-miniapp/pages/submit/index.wxml`
- Modify: `wechat-miniapp/pages/submit/index.wxss`
- Modify: `wechat-miniapp/pages/submit/index.js`

- [ ] **Step 1: 更新提交页 WXML**

```xml
<!-- pages/submit/index.wxml -->
<view class="page theme-submit">
  <!-- 作业信息卡片 -->
  <view class="homework-info-card rainbow-card-hero scale-in">
    <view class="info-title">{{homework.title}}</view>
    <view class="info-requirement">{{homework.requirement}}</view>
  </view>

  <!-- 图片上传区 -->
  <view class="upload-section fade-in">
    <view wx:if="{{images.length === 0}}" class="upload-area" bindtap="onChooseImage">
      <view class="upload-icon">📷</view>
      <view class="upload-hint">点击上传作业照片</view>
      <view class="upload-subhint">最多3张，单张不超过10MB</view>
    </view>

    <view wx:else class="image-preview-grid">
      <view wx:for="{{images}}" wx:key="index" class="image-preview-item" style="background-image: url({{item}}); background-size: cover; background-position: center;">
        <view class="image-remove" bindtap="onRemoveImage" data-index="{{index}}">×</view>
      </view>
      <view wx:if="{{images.length < 3}}" class="image-preview-item image-preview-add" bindtap="onChooseImage">+</view>
    </view>
  </view>

  <!-- 批改模式选择 -->
  <view class="mode-section fade-in">
    <view class="section-title">批改模式</view>
    <view class="mode-cards">
      <view class="mode-card {{mode === 'standard' ? 'active' : ''}}" bindtap="onModeChange" data-mode="standard">
        <view class="mode-icon">✨</view>
        <view class="mode-name">标准批改</view>
        <view class="mode-desc">详细反馈</view>
      </view>
      <view class="mode-card {{mode === 'fast' ? 'active' : ''}}" bindtap="onModeChange" data-mode="fast">
        <view class="mode-icon">⚡</view>
        <view class="mode-name">快速批改</view>
        <view class="mode-desc">简洁快速</view>
      </view>
    </view>
  </view>

  <!-- 提交按钮 -->
  <view class="submit-section">
    <button class="btn-gradient" bindtap="onSubmit" disabled="{{submitting}}">
      {{submitting ? '提交中...' : '🚀 提交作业'}}
    </button>
  </view>
</view>
```

- [ ] **Step 2: 更新提交页 WXSS**

```wxss
/* pages/submit/index.wxss */
@import "../../styles/components.wxss";

.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding: 32rpx;
  padding-bottom: 120rpx;
}

/* 作业信息 */
.homework-info-card {
  margin: -32rpx -32rpx 32rpx -32rpx;
}

.info-title {
  font-size: 36rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
}

.info-requirement {
  font-size: 26rpx;
  opacity: 0.9;
  line-height: 1.6;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 32rpx;
}

.image-preview-item {
  position: relative;
}

.image-remove {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 48rpx;
  height: 48rpx;
  background: var(--secondary-pink);
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  line-height: 1;
}

/* 批改模式 */
.mode-section {
  margin-bottom: 48rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20rpx;
}

.mode-cards {
  display: flex;
  gap: 16rpx;
}

.mode-card {
  flex: 1;
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 32rpx 16rpx;
  text-align: center;
  border: 4rpx solid transparent;
  transition: all 0.3s;
}

.mode-card.active {
  background: var(--gradient-primary);
  color: #ffffff;
  border-color: transparent;
}

.mode-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.mode-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.mode-desc {
  font-size: 22rpx;
  opacity: 0.8;
}

/* 提交按钮 */
.submit-section {
  padding: 16rpx 0;
}
```

- [ ] **Step 3: 更新提交页 JS（集成图片压缩）**

```javascript
// pages/submit/index.js
const imageCompressor = require('../../utils/image-compressor');

Page({
  data: {
    mode: 'standard',
    images: [],
    submitting: false
  },

  // 选择图片（带压缩）
  onChooseImage() {
    const remainCount = 3 - this.data.images.length;
    if (remainCount <= 0) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: remainCount,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' });

        try {
          // 压缩图片
          const compressedPaths = await imageCompressor.compressImages(res.tempFilePaths, 80, 1200);

          this.setData({
            images: [...this.data.images, ...compressedPaths]
          });
        } catch (err) {
          console.error('图片处理失败:', err);
          // 使用原图
          this.setData({
            images: [...this.data.images, ...res.tempFilePaths]
          });
        }

        wx.hideLoading();
      }
    });
  },

  // 移除图片
  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  // 切换批改模式
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
  }
});
```

- [ ] **Step 4: 提交变更**

```bash
git add wechat-miniapp/pages/submit/
git commit -m "refactor(submit): apply rainbow world design with image compression"
```

---

## Task 5: 重构批改结果页

**Files:**
- Modify: `wechat-miniapp/pages/submission-result/index.wxml`
- Modify: `wechat-miniapp/pages/submission-result/index.wxss`
- Modify: `wechat-miniapp/pages/submission-result/index.js`

- [ ] **Step 1: 更新结果页 WXML**

```xml
<!-- pages/submission-result/index.wxml -->
<view class="page theme-result">
  <!-- 分数展示区 -->
  <view class="score-hero scale-in">
    <view class="score-label">本次得分</view>
    <view class="score-number scale-in">{{submission.totalScore || '--'}}</view>
    <view class="score-dimensions">
      <view class="dimension-tag">语法: {{submission.grammarScore || '--'}}</view>
      <view class="dimension-tag">词汇: {{submission.vocabularyScore || '--'}}</view>
      <view class="dimension-tag">内容: {{submission.contentScore || '--'}}</view>
    </view>
  </view>

  <!-- 状态处理中 -->
  <view wx:if="{{isProcessing}}" class="processing-state">
    <view class="spinner"></view>
    <view class="processing-text">正在批改中...</view>
    <view class="processing-hint">大约需要1-2分钟</view>
  </view>

  <!-- 批改结果 -->
  <view wx:else class="result-content">

    <!-- 改进建议 -->
    <view wx:if="{{submission.suggestions}}" class="result-section fade-in">
      <view class="section-header">
        <text class="section-icon">💡</text>
        <text class="section-title">改进建议</text>
      </view>
      <view class="suggestions-card rainbow-card">
        <view class="suggestion-item" wx:for="{{submission.suggestions}}" wx:key="index">
          {{index + 1}}. {{item}}
        </view>
      </view>
    </view>

    <!-- 错误分析 -->
    <view wx:if="{{submission.errors && submission.errors.length > 0}}" class="result-section fade-in">
      <view class="section-header">
        <text class="section-icon">🔍</text>
        <text class="section-title">错误分析</text>
      </view>
      <view class="errors-list">
        <view class="error-item" wx:for="{{submission.errors}}" wx:key="index">
          <view class="error-original">{{item.original}}</view>
          <view class="error-arrow">→</view>
          <view class="error-corrected">{{item.corrected}}</view>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新结果页 WXSS**

```wxss
/* pages/submission-result/index.wxss */
@import "../../styles/components.wxss";

.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 32rpx;
}

/* 分数展示 */
.score-hero {
  margin: -32rpx -32rpx 32rpx -32rpx;
  padding: 80rpx 32rpx;
  background: var(--gradient-primary);
  border-radius: 0 0 48rpx 48rpx;
  text-align: center;
  color: #ffffff;
}

.score-label {
  font-size: 28rpx;
  opacity: 0.9;
  margin-bottom: 16rpx;
}

.score-number {
  font-size: 128rpx;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 24rpx;
}

.score-dimensions {
  display: flex;
  justify-content: center;
  gap: 12rpx;
}

.dimension-tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 8rpx 24rpx;
  border-radius: var(--border-radius-pill);
  font-size: 22rpx;
}

/* 处理中状态 */
.processing-state {
  padding: 120rpx 0;
  text-align: center;
}

.processing-text {
  font-size: 32rpx;
  color: var(--text-primary);
  margin-top: 24rpx;
}

.processing-hint {
  font-size: 24rpx;
  color: var(--text-muted);
  margin-top: 8rpx;
}

/* 结果内容 */
.result-content {
  padding: 0 32rpx;
}

.result-section {
  margin-bottom: 32rpx;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.section-icon {
  font-size: 32rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

/* 建议卡片 */
.suggestions-card {
  padding: 24rpx;
}

.suggestion-item {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.8;
  padding: 8rpx 0;
}

/* 错误列表 */
.errors-list {
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 24rpx;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.error-item:last-child {
  border-bottom: none;
}

.error-original {
  color: var(--secondary-pink);
  text-decoration: line-through;
  font-size: 28rpx;
  flex: 1;
}

.error-arrow {
  color: var(--text-muted);
  font-size: 24rpx;
}

.error-corrected {
  color: var(--primary-blue);
  font-weight: 600;
  font-size: 28rpx;
  flex: 1;
}
```

- [ ] **Step 3: 更新结果页 JS（分数动画）**

```javascript
// pages/submission-result/index.js

Page({
  data: {
    isProcessing: true,
    displayScore: 0
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '批改结果'
    });
  },

  // 显示分数动画
  animateScore(targetScore) {
    const duration = 1000;
    const steps = 30;
    const increment = targetScore / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        current = targetScore;
        clearInterval(timer);
      }
      this.setData({
        displayScore: Math.round(current)
      });
    }, stepDuration);
  }
});
```

- [ ] **Step 4: 提交变更**

```bash
git add wechat-miniapp/pages/submission-result/
git commit -m "refactor(submission-result): apply rainbow world design with score animation"
```

---

## Task 6: 重构个人中心页

**Files:**
- Modify: `wechat-miniapp/pages/profile/index.wxml`
- Modify: `wechat-miniapp/pages/profile/index.wxss`

- [ ] **Step 1: 更新个人中心页 WXML**

```xml
<!-- pages/profile/index.wxml -->
<view class="page theme-profile">
  <!-- 用户信息卡片 -->
  <view class="user-hero scale-in">
    <view class="user-avatar">
      <image src="{{userInfo.avatar || '/assets/default-avatar.png'}}" class="avatar-image" />
    </view>
    <view class="user-info">
      <view class="user-name">{{userInfo.nickname}}</view>
      <view class="user-class">{{userInfo.className || '未加入班级'}}</view>
    </view>
  </view>

  <!-- 功能菜单 -->
  <view class="menu-section fade-in">
    <view class="menu-item" bindtap="onEditProfile">
      <view class="menu-icon">👤</view>
      <view class="menu-text">修改资料</view>
      <view class="menu-arrow">›</view>
    </view>
    <view class="menu-item" bindtap="onChangePassword">
      <view class="menu-icon">🔒</view>
      <view class="menu-text">修改密码</view>
      <view class="menu-arrow">›</view>
    </view>
    <view class="menu-item" bindtap="onApiSettings">
      <view class="menu-icon">⚙️</view>
      <view class="menu-text">API设置</view>
      <view class="menu-arrow">›</view>
    </view>
    <view class="menu-item" bindtap="onClearDrafts">
      <view class="menu-icon">🗑️</view>
      <view class="menu-text">清理草稿</view>
      <view class="menu-arrow">›</view>
    </view>
  </view>

  <!-- 退出登录 -->
  <view class="logout-section">
    <button class="logout-btn" bindtap="onLogout">退出登录</button>
  </view>
</view>
```

- [ ] **Step 2: 更新个人中心页 WXSS**

```wxss
/* pages/profile/index.wxss */
@import "../../styles/components.wxss";

.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 32rpx;
}

/* 用户信息 */
.user-hero {
  margin: -32rpx -32rpx 32rpx -32rpx;
  padding: 64rpx 32rpx 48rpx;
  background: var(--gradient-primary);
  border-radius: 0 0 48rpx 48rpx;
  display: flex;
  align-items: center;
  color: #ffffff;
}

.user-avatar {
  margin-right: 24rpx;
}

.avatar-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.3);
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.user-class {
  font-size: 26rpx;
  opacity: 0.9;
}

/* 菜单 */
.menu-section {
  background: #ffffff;
  border-radius: var(--border-radius-large);
  margin: 0 32rpx 32rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.menu-text {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary);
}

.menu-arrow {
  font-size: 40rpx;
  color: var(--text-muted);
}

/* 退出登录 */
.logout-section {
  padding: 0 32rpx;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #ffffff;
  color: var(--secondary-pink);
  border: 2rpx solid var(--secondary-pink);
  border-radius: var(--border-radius-pill);
  font-size: 28rpx;
  font-weight: 600;
}

.logout-btn::after {
  border: none;
}
```

- [ ] **Step 3: 提交变更**

```bash
git add wechat-miniapp/pages/profile/
git commit -m "refactor(profile): apply rainbow world design"
```

---

## Task 7: 重构消息通知页

**Files:**
- Modify: `wechat-miniapp/pages/messages/index.wxml`
- Modify: `wechat-miniapp/pages/messages/index.wxss`

- [ ] **Step 1: 更新消息页 WXML**

```xml
<!-- pages/messages/index.wxml -->
<view class="page theme-messages">
  <!-- 顶部标题区 -->
  <view class="header-hero scale-in">
    <view class="header-title">消息通知</view>
    <view wx:if="{{unreadCount > 0}}" class="header-subtitle">{{unreadCount}} 条未读</view>
  </view>

  <!-- 消息列表 -->
  <view class="message-list">
    <view wx:if="{{messages.length === 0}}" class="empty-state">
      <view class="empty-icon">🔔</view>
      <view class="empty-title">暂无消息</view>
    </view>

    <view wx:else>
      <view wx:for="{{messages}}" wx:key="id" class="message-card fade-in {{!item.read ? 'unread' : ''}}" bindtap="onMessageTap" data-id="{{item.id}}">
        <view class="message-icon">{{item.icon}}</view>
        <view class="message-content">
          <view class="message-header">
            <view class="message-title">{{item.title}}</view>
            <view class="message-time">{{item.timeText}}</view>
          </view>
          <view class="message-text">{{item.content}}</view>
        </view>
        <view wx:if="{{!item.read}}" class="unread-dot"></view>
      </view>
    </view>
  </view>

  <!-- 全部标记已读 -->
  <view wx:if="{{messages.length > 0 && unreadCount > 0}}" class="mark-read-section">
    <button class="btn-secondary" bindtap="onMarkAllRead">全部标记已读</button>
  </view>
</view>
```

- [ ] **Step 2: 更新消息页 WXSS**

```wxss
/* pages/messages/index.wxss */
@import "../../styles/components.wxss";

.page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 32rpx;
}

/* 头部 */
.header-hero {
  margin: -32rpx -32rpx 32rpx -32rpx;
  padding: 64rpx 32rpx 48rpx;
  background: var(--gradient-primary);
  border-radius: 0 0 48rpx 48rpx;
  color: #ffffff;
}

.header-title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.header-subtitle {
  font-size: 26rpx;
  opacity: 0.9;
}

/* 消息列表 */
.message-list {
  padding: 0 8rpx;
}

.message-card {
  display: flex;
  align-items: flex-start;
  background: #ffffff;
  border-radius: var(--border-radius-large);
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: var(--shadow-card);
  position: relative;
}

.message-card.unread {
  background: linear-gradient(135deg, #fff9f0 0%, #ffffff 100%);
}

.message-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
}

.message-content {
  flex: 1;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.message-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.message-time {
  font-size: 22rpx;
  color: var(--text-muted);
}

.message-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}

.unread-dot {
  width: 16rpx;
  height: 16rpx;
  background: var(--secondary-pink);
  border-radius: 50%;
  position: absolute;
  top: 24rpx;
  right: 24rpx;
}

/* 标记已读 */
.mark-read-section {
  padding: 32rpx;
}

/* 空状态 */
.empty-state {
  padding: 120rpx 32rpx;
  text-align: center;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 32rpx;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: 提交变更**

```bash
git add wechat-miniapp/pages/messages/
git commit -m "refactor(messages): apply rainbow world design"
```

---

## Task 8: 创建可复用组件

**Files:**
- Create: `wechat-miniapp/components/gradient-button/index.wxml`
- Create: `wechat-miniapp/components/gradient-button/index.wxss`
- Create: `wechat-miniapp/components/gradient-button/index.js`
- Create: `wechat-miniapp/components/gradient-button/index.json`

- [ ] **Step 1: 创建渐变按钮组件**

```xml
<!-- components/gradient-button/index.wxml -->
<button class="btn-gradient {{size}} {{type}}" disabled="{{disabled}}" bindtap="onTap">
  <slot></slot>
</button>
```

```wxss
/* components/gradient-button/index.wxss */
.btn-gradient {
  height: 88rpx;
  line-height: 88rpx;
  padding: 0 48rpx;
  border-radius: var(--border-radius-pill);
  border: none;
  background: var(--gradient-primary);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: var(--shadow-soft);
  transition: all 0.3s;
}

.btn-gradient::after {
  border: none;
}

.btn-gradient[disabled] {
  opacity: 0.5;
}

.btn-gradient.small {
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  padding: 0 32rpx;
}

.btn-gradient.large {
  height: 100rpx;
  line-height: 100rpx;
  font-size: 36rpx;
}

.btn-gradient:active {
  transform: scale(0.98);
}
```

```javascript
// components/gradient-button/index.js
Component({
  properties: {
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    type: {
      type: String,
      value: 'primary' // primary, secondary
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    onTap(e) {
      if (!this.data.disabled) {
        this.triggerEvent('tap', e.detail);
      }
    }
  }
});
```

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 提交变更**

```bash
git add wechat-miniapp/components/gradient-button/
git commit -m "feat: add gradient button component"
```

---

## Task 9: 更新应用配置

**Files:**
- Modify: `wechat-miniapp/app.json`

- [ ] **Step 1: 更新应用配置**

确保所有页面都已注册，并配置主题：

```json
{
  "pages": [
    "pages/login/index",
    "pages/homeworks/index",
    "pages/homework-detail/index",
    "pages/submit/index",
    "pages/submission-result/index",
    "pages/submissions/index",
    "pages/messages/index",
    "pages/report/index",
    "pages/profile/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTitleText": "作业AI",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#667eea",
    "backgroundColor": "#ffffff",
    "borderStyle": "white",
    "list": [
      {
        "pagePath": "pages/homeworks/index",
        "text": "作业",
        "iconPath": "assets/tab-homework.png",
        "selectedIconPath": "assets/tab-homework-active.png"
      },
      {
        "pagePath": "pages/submit/index",
        "text": "提交",
        "iconPath": "assets/tab-submit.png",
        "selectedIconPath": "assets/tab-submit-active.png"
      },
      {
        "pagePath": "pages/messages/index",
        "text": "消息",
        "iconPath": "assets/tab-message.png",
        "selectedIconPath": "assets/tab-message-active.png"
      },
      {
        "pagePath": "pages/profile/index",
        "text": "我的",
        "iconPath": "assets/tab-profile.png",
        "selectedIconPath": "assets/tab-profile-active.png"
      }
    ]
  },
  "usingComponents": {
    "gradient-button": "/components/gradient-button/index"
  }
}
```

- [ ] **Step 2: 提交变更**

```bash
git add wechat-miniapp/app.json
git commit -m "config: update app config for rainbow world theme"
```

---

## 验收测试

**验证命令：**
```bash
# 在微信开发者工具中打开小程序项目
# 检查以下内容
```

**检查清单：**

### 视觉验收
- [ ] 作业列表页紫色渐变顶部欢迎区显示正确
- [ ] 提交作业页粉色主题应用正确
- [ ] 批改结果页蓝色分数展示区显示正确
- [ ] 个人中心页绿色主题应用正确
- [ ] 消息通知页橙粉主题应用正确
- [ ] 所有按钮使用渐变背景
- [ ] 所有卡片使用统一圆角 (32rpx)
- [ ] 状态标签使用正确配色

### 交互验收
- [ ] 图片上传前自动压缩
- [ ] 提交流程顺畅，每步有反馈
- [ ] 分数动画显示流畅
- [ ] 筛选标签切换有动画
- [ ] 加载状态显示骨架屏

### 性能验收
- [ ] 首屏加载时间 < 2秒
- [ ] 列表滚动流畅
- [ ] 图片上传后大小合理

---

## 参考资料

- **设计规范文档**: `docs/superpowers/specs/2026-04-01-miniprogram-redesign-design.md`
- **现有代码**: `wechat-miniapp/` 目录
- **微信小程序文档**: https://developers.weixin.qq.com/miniprogram/dev/framework/
