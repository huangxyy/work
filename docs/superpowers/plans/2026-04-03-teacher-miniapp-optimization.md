# 小程序老师端全面优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过渐进式优化，全面提升老师端的 UI/UX 体验、性能表现和易用性

**Architecture:** 在现有小程序架构基础上，新增错误处理、缓存管理、性能监控等工具库，优化核心页面的布局和交互，实现骨架屏、空状态等通用组件，采用 TDD 方式确保代码质量

**Tech Stack:** 微信小程序原生框架、WXS、Promise、async/await

---

## 文件结构

### 新增文件

**工具库：**
- `wechat-miniapp/lib/error-handler.js` - 统一错误处理
- `wechat-miniapp/lib/cache.js` - 数据缓存管理
- `wechat-miniapp/lib/performance.js` - 性能监控
- `wechat-miniapp/lib/help.js` - 帮助提示系统

**组件：**
- `wechat-miniapp/components/loading-skeleton/index.js` - 骨架屏组件逻辑
- `wechat-miniapp/components/loading-skeleton/index.json` - 骨架屏组件配置
- `wechat-miniapp/components/loading-skeleton/index.wxml` - 骨架屏组件模板
- `wechat-miniapp/components/loading-skeleton/index.wxss` - 骨架屏组件样式
- `wechat-miniapp/components/empty-state/index.js` - 空状态组件逻辑
- `wechat-miniapp/components/empty-state/index.json` - 空状态组件配置
- `wechat-miniapp/components/empty-state/index.wxml` - 空状态组件模板
- `wechat-miniapp/components/empty-state/index.wxss` - 空状态组件样式

### 修改文件

**核心页面：**
- `wechat-miniapp/pages/teacher/homeworks/index.js` - 作业列表页逻辑优化
- `wechat-miniapp/pages/teacher/homeworks/index.wxml` - 作业列表页模板优化
- `wechat-miniapp/pages/teacher/homeworks/index.wxss` - 作业列表页样式优化
- `wechat-miniapp/pages/teacher/capture/index.js` - 拍照上传页逻辑优化
- `wechat-miniapp/pages/teacher/capture/index.wxml` - 拍照上传页模板优化
- `wechat-miniapp/pages/teacher/capture/index.wxss` - 拍照上传页样式优化
- `wechat-miniapp/pages/teacher/report/index.js` - 班级报告页逻辑优化
- `wechat-miniapp/pages/teacher/report/index.wxml` - 班级报告页模板优化
- `wechat-miniapp/pages/teacher/report/index.wxss` - 班级报告页样式优化
- `wechat-miniapp/pages/teacher/profile/index.js` - 个人中心页逻辑优化
- `wechat-miniapp/pages/teacher/profile/index.wxml` - 个人中心页模板优化

**样式文件：**
- `wechat-miniapp/styles/teacher.wxss` - 老师端样式扩展

**工具库：**
- `wechat-miniapp/lib/utils.js` - 添加防抖和节流函数

---

## 第一阶段：核心优化（1-2周）

### Task 1: 创建错误处理工具库

**Files:**
- Create: `wechat-miniapp/lib/error-handler.js`

- [ ] **Step 1: 创建错误处理类**

创建文件 `wechat-miniapp/lib/error-handler.js`：

```javascript
class ErrorHandler {
  constructor() {
    this.errorMap = {
      'NETWORK_ERROR': {
        title: '网络连接失败',
        message: '请检查网络设置后重试',
        action: '重试'
      },
      'TIMEOUT': {
        title: '请求超时',
        message: '网络不稳定，请稍后重试',
        action: '重试'
      },
      'UNAUTHORIZED': {
        title: '登录已过期',
        message: '请重新登录',
        action: '重新登录'
      },
      'FORBIDDEN': {
        title: '无权限访问',
        message: '您没有权限执行此操作',
        action: '返回'
      },
      'HOMEWORK_NOT_FOUND': {
        title: '作业不存在',
        message: '该作业可能已被删除',
        action: '返回列表'
      },
      'CLASS_NOT_FOUND': {
        title: '班级不存在',
        message: '该班级可能已被删除',
        action: '返回列表'
      },
      'STUDENT_NOT_FOUND': {
        title: '学生不存在',
        message: '该学生可能已被移除',
        action: '返回列表'
      },
      'IMAGE_TOO_LARGE': {
        title: '图片过大',
        message: '请选择小于10MB的图片',
        action: '重新选择'
      },
      'UPLOAD_FAILED': {
        title: '上传失败',
        message: '图片上传失败，请重试',
        action: '重试'
      },
      'UNKNOWN': {
        title: '操作失败',
        message: '请稍后重试或联系客服',
        action: '确定'
      }
    };
  }

  handle(error, context = {}) {
    const errorInfo = this.parseError(error);
    this.showError(errorInfo, context);
  }

  parseError(error) {
    if (!error.statusCode) {
      return this.errorMap.NETWORK_ERROR;
    }

    switch (error.statusCode) {
      case 401:
        return this.errorMap.UNAUTHORIZED;
      case 403:
        return this.errorMap.FORBIDDEN;
      case 404:
        return this.errorMap.NOT_FOUND || this.errorMap.UNKNOWN;
      case 500:
        return {
          title: '服务器错误',
          message: '服务器开小差了，请稍后重试',
          action: '重试'
        };
    }

    if (error.data && error.data.code) {
      const businessError = this.errorMap[error.data.code];
      if (businessError) return businessError;
    }

    return this.errorMap.UNKNOWN;
  }

  showError(errorInfo, context) {
    wx.showModal({
      title: errorInfo.title,
      content: errorInfo.message,
      confirmText: errorInfo.action,
      showCancel: false,
      success: (res) => {
        if (res.confirm && context.onRetry) {
          context.onRetry();
        }
      }
    });
  }
}

module.exports = new ErrorHandler();
```

- [ ] **Step 2: 提交错误处理工具库**

```bash
git add wechat-miniapp/lib/error-handler.js
git commit -m "feat(teacher-miniapp): add error handler utility"
```

### Task 2: 创建缓存管理工具库

**Files:**
- Create: `wechat-miniapp/lib/cache.js`

- [ ] **Step 1: 创建缓存管理类**

创建文件 `wechat-miniapp/lib/cache.js`：

```javascript
class CacheManager {
  constructor() {
    this.cachePrefix = 'teacher_cache_';
    this.defaultExpire = 5 * 60 * 1000;
  }

  set(key, data, expire = this.defaultExpire) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expire
    };
    try {
      wx.setStorageSync(this.cachePrefix + key, cacheData);
      return true;
    } catch (error) {
      console.error('Cache set failed:', error);
      return false;
    }
  }

  get(key) {
    try {
      const cacheData = wx.getStorageSync(this.cachePrefix + key);
      if (!cacheData) return null;

      if (Date.now() - cacheData.timestamp > cacheData.expire) {
        this.remove(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  remove(key) {
    try {
      wx.removeStorageSync(this.cachePrefix + key);
      return true;
    } catch (error) {
      console.error('Cache remove failed:', error);
      return false;
    }
  }

  clear() {
    try {
      const res = wx.getStorageInfoSync();
      res.keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          wx.removeStorageSync(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Cache clear failed:', error);
      return false;
    }
  }

  getCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const cacheKeys = res.keys.filter(key => key.startsWith(this.cachePrefix));
      return cacheKeys.length;
    } catch (error) {
      console.error('Get cache size failed:', error);
      return 0;
    }
  }
}

module.exports = new CacheManager();
```

- [ ] **Step 2: 提交缓存管理工具库**

```bash
git add wechat-miniapp/lib/cache.js
git commit -m "feat(teacher-miniapp): add cache manager utility"
```

### Task 3: 创建性能监控工具库

**Files:**
- Create: `wechat-miniapp/lib/performance.js`

- [ ] **Step 1: 创建性能监控类**

创建文件 `wechat-miniapp/lib/performance.js`：

```javascript
const config = require('./config');

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.maxMetrics = 100;
  }

  startTimer(name) {
    if (!this.metrics[name]) {
      this.metrics[name] = {
        startTime: Date.now(),
        records: []
      };
    } else {
      this.metrics[name].startTime = Date.now();
    }
  }

  endTimer(name) {
    if (!this.metrics[name]) return null;

    const duration = Date.now() - this.metrics[name].startTime;
    this.metrics[name].records.push({
      duration,
      timestamp: Date.now()
    });

    if (this.metrics[name].records.length > this.maxMetrics) {
      this.metrics[name].records.shift();
    }

    return duration;
  }

  recordPageLoad(pageName, duration) {
    if (!this.metrics[pageName]) {
      this.metrics[pageName] = { records: [] };
    }
    this.metrics[pageName].records.push({
      type: 'pageLoad',
      duration,
      timestamp: Date.now()
    });

    if (this.metrics[pageName].records.length > this.maxMetrics) {
      this.metrics[pageName].records.shift();
    }
  }

  recordApiRequest(apiName, duration, success) {
    if (!this.metrics[apiName]) {
      this.metrics[apiName] = { records: [] };
    }
    this.metrics[apiName].records.push({
      type: 'apiRequest',
      duration,
      success,
      timestamp: Date.now()
    });

    if (this.metrics[apiName].records.length > this.maxMetrics) {
      this.metrics[apiName].records.shift();
    }
  }

  getMetrics(name) {
    return this.metrics[name] || null;
  }

  getAllMetrics() {
    return this.metrics;
  }

  clearMetrics() {
    this.metrics = {};
  }

  async report() {
    try {
      await wx.request({
        url: `${config.apiBaseUrl}/performance/report`,
        method: 'POST',
        data: this.metrics
      });
      this.clearMetrics();
    } catch (error) {
      console.error('Performance report failed:', error);
    }
  }
}

module.exports = new PerformanceMonitor();
```

- [ ] **Step 2: 提交性能监控工具库**

```bash
git add wechat-miniapp/lib/performance.js
git commit -m "feat(teacher-miniapp): add performance monitor utility"
```

### Task 4: 添加防抖和节流函数

**Files:**
- Modify: `wechat-miniapp/lib/utils.js`

- [ ] **Step 1: 在 utils.js 中添加防抖和节流函数**

在文件 `wechat-miniapp/lib/utils.js` 末尾添加：

```javascript
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function throttle(fn, delay = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

module.exports = {
  pickErrorMessage,
  debounce,
  throttle,
};
```

- [ ] **Step 2: 提交防抖和节流函数**

```bash
git add wechat-miniapp/lib/utils.js
git commit -m "feat(teacher-miniapp): add debounce and throttle functions"
```

### Task 5: 创建骨架屏组件

**Files:**
- Create: `wechat-miniapp/components/loading-skeleton/index.js`
- Create: `wechat-miniapp/components/loading-skeleton/index.json`
- Create: `wechat-miniapp/components/loading-skeleton/index.wxml`
- Create: `wechat-miniapp/components/loading-skeleton/index.wxss`

- [ ] **Step 1: 创建骨架屏组件逻辑文件**

创建文件 `wechat-miniapp/components/loading-skeleton/index.js`：

```javascript
Component({
  properties: {
    count: {
      type: Number,
      value: 3
    },
    type: {
      type: String,
      value: 'card'
    }
  },

  data: {
    items: []
  },

  observers: {
    'count': function(count) {
      this.setData({
        items: Array.from({ length: count }, (_, i) => i)
      });
    }
  },

  attached() {
    this.setData({
      items: Array.from({ length: this.data.count }, (_, i) => i)
    });
  }
});
```

- [ ] **Step 2: 创建骨架屏组件配置文件**

创建文件 `wechat-miniapp/components/loading-skeleton/index.json`：

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 3: 创建骨架屏组件模板文件**

创建文件 `wechat-miniapp/components/loading-skeleton/index.wxml`：

```xml
<view class="skeleton">
  <view class="skeleton-item" wx:for="{{items}}" wx:key="index">
    <view class="skeleton-avatar"></view>
    <view class="skeleton-content">
      <view class="skeleton-title"></view>
      <view class="skeleton-text"></view>
      <view class="skeleton-text short"></view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建骨架屏组件样式文件**

创建文件 `wechat-miniapp/components/loading-skeleton/index.wxss`：

```css
.skeleton {
  padding: 16rpx;
}

.skeleton-item {
  display: flex;
  padding: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.skeleton-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.skeleton-title {
  height: 32rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 16rpx;
  border-radius: 8rpx;
}

.skeleton-text {
  height: 24rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 12rpx;
  border-radius: 8rpx;
}

.skeleton-text.short {
  width: 60%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

- [ ] **Step 5: 提交骨架屏组件**

```bash
git add wechat-miniapp/components/loading-skeleton/
git commit -m "feat(teacher-miniapp): add loading skeleton component"
```

### Task 6: 创建空状态组件

**Files:**
- Create: `wechat-miniapp/components/empty-state/index.js`
- Create: `wechat-miniapp/components/empty-state/index.json`
- Create: `wechat-miniapp/components/empty-state/index.wxml`
- Create: `wechat-miniapp/components/empty-state/index.wxss`

- [ ] **Step 1: 创建空状态组件逻辑文件**

创建文件 `wechat-miniapp/components/empty-state/index.js`：

```javascript
Component({
  properties: {
    icon: {
      type: String,
      value: '📝'
    },
    title: {
      type: String,
      value: '暂无数据'
    },
    description: {
      type: String,
      value: ''
    },
    buttonText: {
      type: String,
      value: ''
    }
  },

  methods: {
    onButtonTap() {
      this.triggerEvent('action');
    }
  }
});
```

- [ ] **Step 2: 创建空状态组件配置文件**

创建文件 `wechat-miniapp/components/empty-state/index.json`：

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 3: 创建空状态组件模板文件**

创建文件 `wechat-miniapp/components/empty-state/index.wxml`：

```xml
<view class="empty-state">
  <view class="empty-icon">{{icon}}</view>
  <view class="empty-title">{{title}}</view>
  <view class="empty-description" wx:if="{{description}}">{{description}}</view>
  <view class="empty-button" wx:if="{{buttonText}}" bindtap="onButtonTap">
    {{buttonText}}
  </view>
</view>
```

- [ ] **Step 4: 创建空状态组件样式文件**

创建文件 `wechat-miniapp/components/empty-state/index.wxss`：

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 32rpx;
  min-height: 400rpx;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
  opacity: 0.8;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12rpx;
  text-align: center;
}

.empty-description {
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 32rpx;
  text-align: center;
  line-height: 1.6;
  max-width: 500rpx;
}

.empty-button {
  padding: 20rpx 48rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: #ffffff;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.3);
  transition: all 0.2s;
}

.empty-button:active {
  transform: scale(0.98);
  opacity: 0.9;
}
```

- [ ] **Step 5: 提交空状态组件**

```bash
git add wechat-miniapp/components/empty-state/
git commit -m "feat(teacher-miniapp): add empty state component"
```

### Task 7: 创建帮助提示工具库

**Files:**
- Create: `wechat-miniapp/lib/help.js`

- [ ] **Step 1: 创建帮助提示工具库**

创建文件 `wechat-miniapp/lib/help.js`：

```javascript
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
```

- [ ] **Step 2: 提交帮助提示工具库**

```bash
git add wechat-miniapp/lib/help.js
git commit -m "feat(teacher-miniapp): add help tips utility"
```

---

## 第二阶段：UI/UX 优化（2-3周）

### Task 8: 优化作业列表页

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.js`
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxss`
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.json`

- [ ] **Step 1: 更新作业列表页配置**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.json`：

```json
{
  "navigationBarTitleText": "作业管理",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "loading-skeleton": "/components/loading-skeleton/index",
    "empty-state": "/components/empty-state/index"
  }
}
```

- [ ] **Step 2: 优化作业列表页逻辑**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.js`，在文件开头添加引入：

```javascript
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const performance = require('../../../lib/performance');
const { debounce } = require('../../../lib/utils');
const { showHelp } = require('../../../lib/help');
```

在 `loadHomeworks` 方法中使用错误处理和性能监控：

```javascript
async loadHomeworks() {
  const { selectedClassId } = this.data;
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

  this.setData({ loading: true, error: '' });
  
  const startTime = Date.now();
  
  try {
    const homeworks = await fetchHomeworks({ classId: selectedClassId });
    const validHomeworks = Array.isArray(homeworks) ? homeworks : [];

    this.setData({ homeworks: validHomeworks }, () => {
      this.calculateStats();
      this.applyFilter();
    });

    const duration = Date.now() - startTime;
    performance.recordPageLoad('homeworks', duration);
    
    cache.set(`homeworks_${selectedClassId}`, validHomeworks, 5 * 60 * 1000);
  } catch (error) {
    errorHandler.handle(error, {
      onRetry: () => this.loadHomeworks()
    });
  } finally {
    this.setData({ loading: false });
  }
}
```

添加帮助提示方法：

```javascript
onShowHelp() {
  showHelp('homeworks');
}
```

- [ ] **Step 3: 优化作业列表页模板**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.wxml`，使用骨架屏和空状态组件：

```xml
<wxs module="utils" src="../../../lib/utils.wxs"></wxs>
<view class="page theme-teacher-homeworks">
  <view class="hero fade-in">
    <view class="hero-header">
      <view class="hero-title">Hi，{{userName}} 👋</view>
      <view class="hero-help" bindtap="onShowHelp">?</view>
    </view>
    <view class="hero-subtitle">当前班级有 {{homeworkCount}} 个作业</view>
    <view class="hero-stats">
      <view class="hero-stat">
        <text class="hero-stat-value">{{classCount}}</text>
        <text class="hero-stat-label">班级数</text>
      </view>
      <view class="hero-stat">
        <text class="hero-stat-value">{{openCount}}</text>
        <text class="hero-stat-label">进行中</text>
      </view>
      <view class="hero-stat">
        <text class="hero-stat-value">{{closedCount}}</text>
        <text class="hero-stat-label">已截止</text>
      </view>
    </view>
  </view>

  <view class="selector-row clickable-item" bindtap="onShowClassSelector">
    <text class="selector-label">当前班级</text>
    <view class="selector-value">
      <text>{{selectedClassName}}</text>
      <text class="selector-arrow">›</text>
    </view>
  </view>

  <view class="teacher-filter-section">
    <scroll-view class="teacher-filter-chips" scroll-x enable-flex>
      <view
        class="teacher-filter-chip {{activeFilter === 'all' ? 'active' : ''}}"
        bindtap="onFilterChange"
        data-filter="all"
      >
        全部
      </view>
      <view
        class="teacher-filter-chip {{activeFilter === 'open' ? 'active' : ''}}"
        bindtap="onFilterChange"
        data-filter="open"
      >
        进行中
      </view>
      <view
        class="teacher-filter-chip {{activeFilter === 'closed' ? 'active' : ''}}"
        bindtap="onFilterChange"
        data-filter="closed"
      >
        已截止
      </view>
    </scroll-view>
  </view>

  <view class="homework-list">
    <view wx:if="{{loading}}" class="loading">
      <loading-skeleton count="5" />
    </view>

    <view wx:elif="{{error}}" class="error">
      <text class="error-icon">😕</text>
      <text class="error-title">加载失败</text>
      <text class="error-text">{{error}}</text>
      <view class="btn btn-primary" bindtap="onRetry">重新加载</view>
    </view>

    <view wx:elif="{{filteredHomeworks.length === 0}}" class="empty">
      <empty-state
        icon="📝"
        title="暂无作业"
        description="{{activeFilter === 'all' ? '还没有布置作业，点击右下角按钮创建' : '当前筛选条件下没有作业'}}"
        buttonText="{{activeFilter === 'all' ? '创建作业' : ''}}"
        bind:action="onAddHomework"
      />
    </view>

    <view wx:else>
      <view
        wx:for="{{filteredHomeworks}}"
        wx:key="id"
        class="homework-card fade-in clickable-item"
        style="animation-delay: {{index * 0.05}}s"
        data-id="{{item.id}}"
        bindtap="onHomeworkTap"
      >
        <view class="homework-header">
          <text class="homework-title">{{item.title}}</text>
          <view class="status-tag {{item.status}}">{{utils.getHomeworkStatusText(item.status)}}</view>
        </view>

        <view class="homework-meta">
          <view class="homework-meta-item">
            <text class="homework-meta-icon">📅</text>
            <text>截止：{{utils.formatDate(item.dueAt)}}</text>
          </view>
          <view class="homework-meta-item">
            <text class="homework-meta-icon">👥</text>
            <text>提交：{{item.submissionCount || 0}}/{{item.studentCount || 0}}</text>
          </view>
        </view>

        <view class="homework-progress" wx:if="{{item.studentCount > 0}}">
          <view class="homework-progress-bar">
            <view
              class="homework-progress-fill"
              style="width: {{item.studentCount > 0 ? (item.submissionCount / item.studentCount * 100) : 0}}%"
            ></view>
          </view>
          <text class="homework-progress-text">
            {{item.studentCount > 0 ? Math.round(item.submissionCount / item.studentCount * 100) : 0}}%
          </text>
        </view>
      </view>
    </view>
  </view>

  <view class="fab" bindtap="onAddHomework">+</view>

  <view class="selector-modal" wx:if="{{showClassSelector}}" bindtap="onHideClassSelector">
    <view class="selector-content" catchtap="">
      <view class="selector-title">选择班级</view>
      <scroll-view scroll-y class="selector-list">
        <view
          wx:for="{{classes}}"
          wx:key="id"
          class="selector-option {{item.id === selectedClassId ? 'active' : ''}}"
          bindtap="onSelectClass"
          data-id="{{item.id}}"
        >
          <view class="selector-option-main">
            <text class="selector-option-name">{{item.name}}</text>
            <text class="selector-option-desc">{{item.studentCount || 0}} 名学生</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 优化作业列表页样式**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.wxss`，添加帮助按钮样式：

```css
.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.hero-help {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #ffffff;
  transition: all 0.2s;
}

.hero-help:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 5: 提交作业列表页优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/
git commit -m "feat(teacher-miniapp): optimize homeworks page with error handling and loading states"
```

### Task 9: 优化拍照上传页

**Files:**
- Modify: `wechat-miniapp/pages/teacher/capture/index.js`
- Modify: `wechat-miniapp/pages/teacher/capture/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/capture/index.wxss`
- Modify: `wechat-miniapp/pages/teacher/capture/index.json`

- [ ] **Step 1: 更新拍照上传页配置**

修改文件 `wechat-miniapp/pages/teacher/capture/index.json`：

```json
{
  "navigationBarTitleText": "批量上传",
  "usingComponents": {
    "empty-state": "/components/empty-state/index"
  }
}
```

- [ ] **Step 2: 优化拍照上传页逻辑**

修改文件 `wechat-miniapp/pages/teacher/capture/index.js`，添加错误处理和图片压缩：

```javascript
const errorHandler = require('../../../lib/error-handler');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    classes: [],
    homeworks: [],
    selectedClassId: '',
    selectedClassName: '选择班级',
    selectedHomeworkId: '',
    selectedHomeworkTitle: '选择作业',
    mode: 'cheap',
    images: [],
    uploading: false,
    showClassSelector: false,
    showHomeworkSelector: false,
    showModeSelector: false
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes });
    } catch (error) {
      errorHandler.handle(error);
    }
  },

  async onChooseImage() {
    const maxImages = 9 - this.data.images.length;
    if (maxImages <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      });
      return;
    }

    try {
      const res = await wx.chooseMedia({
        count: maxImages,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      });

      const newImages = res.tempFiles.map(file => ({
        path: file.tempFilePath,
        size: file.size
      }));

      this.setData({
        images: [...this.data.images, ...newImages]
      });
    } catch (error) {
      if (error.errMsg && !error.errMsg.includes('cancel')) {
        errorHandler.handle(error);
      }
    }
  },

  onRemoveImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = this.data.images.filter((_, i) => i !== index);
    this.setData({ images });
  },

  async onPreview() {
    const { images, selectedClassId, selectedHomeworkId, mode } = this.data;

    if (!selectedClassId) {
      wx.showToast({
        title: '请选择班级',
        icon: 'none'
      });
      return;
    }

    if (!selectedHomeworkId) {
      wx.showToast({
        title: '请选择作业',
        icon: 'none'
      });
      return;
    }

    if (images.length === 0) {
      wx.showToast({
        title: '请选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({ uploading: true });

    try {
      const compressedImages = await this.compressImages(images);
      
      const result = await this.uploadImages(compressedImages);
      
      wx.navigateTo({
        url: `/pages/teacher/upload-result/index?batchId=${result.batchId}`
      });
    } catch (error) {
      errorHandler.handle(error, {
        onRetry: () => this.onPreview()
      });
    } finally {
      this.setData({ uploading: false });
    }
  },

  async compressImages(images) {
    const compressedImages = [];
    for (const image of images) {
      try {
        const { tempFilePath } = await wx.compressImage({
          src: image.path,
          quality: 80
        });
        compressedImages.push({
          ...image,
          path: tempFilePath
        });
      } catch (error) {
        console.error('Image compression failed:', error);
        compressedImages.push(image);
      }
    }
    return compressedImages;
  },

  async uploadImages(images) {
    const { selectedClassId, selectedHomeworkId, mode } = this.data;
    
    const formData = {
      classId: selectedClassId,
      homeworkId: selectedHomeworkId,
      mode: mode
    };

    return await uploadBatchImages(images, formData);
  },

  onShowHelp() {
    showHelp('capture');
  },

  onClassChange() {
    this.setData({ showClassSelector: true });
  },

  onCloseClassSelector() {
    this.setData({ showClassSelector: false });
  },

  onSelectClass(e) {
    const { id, index } = e.currentTarget.dataset;
    const selectedClass = this.data.classes[index];
    
    this.setData({
      selectedClassId: id,
      selectedClassName: selectedClass.name,
      showClassSelector: false
    });

    this.loadHomeworks(id);
  },

  async loadHomeworks(classId) {
    try {
      const homeworks = await fetchHomeworks({ classId });
      this.setData({ homeworks });
    } catch (error) {
      errorHandler.handle(error);
    }
  },

  onHomeworkChange() {
    if (!this.data.selectedClassId) {
      wx.showToast({
        title: '请先选择班级',
        icon: 'none'
      });
      return;
    }
    this.setData({ showHomeworkSelector: true });
  },

  onCloseHomeworkSelector() {
    this.setData({ showHomeworkSelector: false });
  },

  onSelectHomework(e) {
    const { id } = e.currentTarget.dataset;
    const homework = this.data.homeworks.find(h => h.id === id);
    
    this.setData({
      selectedHomeworkId: id,
      selectedHomeworkTitle: homework.title,
      showHomeworkSelector: false
    });
  },

  onModeChange() {
    this.setData({ showModeSelector: true });
  },

  onCloseModeSelector() {
    this.setData({ showModeSelector: false });
  },

  onSelectMode(e) {
    const { mode } = e.currentTarget.dataset;
    this.setData({
      mode,
      showModeSelector: false
    });
  }
});
```

- [ ] **Step 3: 提交拍照上传页优化**

```bash
git add wechat-miniapp/pages/teacher/capture/
git commit -m "feat(teacher-miniapp): optimize capture page with error handling and image compression"
```

### Task 10: 优化班级报告页

**Files:**
- Modify: `wechat-miniapp/pages/teacher/report/index.js`
- Modify: `wechat-miniapp/pages/teacher/report/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/report/index.json`

- [ ] **Step 1: 更新班级报告页配置**

修改文件 `wechat-miniapp/pages/teacher/report/index.json`：

```json
{
  "navigationBarTitleText": "班级报告",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "loading-skeleton": "/components/loading-skeleton/index",
    "empty-state": "/components/empty-state/index"
  }
}
```

- [ ] **Step 2: 优化班级报告页逻辑**

修改文件 `wechat-miniapp/pages/teacher/report/index.js`，添加错误处理和缓存：

```javascript
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    classes: [],
    selectedClassId: '',
    rangeDays: 7,
    report: null,
    loading: false,
    submissionCount: 0,
    submissionRateText: '0%',
    trendChartData: [],
    scoreDistribution: [],
    scoreLegend: ['优秀', '良好', '中等', '及格', '不及格'],
    chartColors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
  },

  onLoad() {
    this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await fetchClasses();
      this.setData({ classes });
      
      if (classes.length > 0) {
        this.setData({ selectedClassId: classes[0].id });
        this.loadReport();
      }
    } catch (error) {
      errorHandler.handle(error);
    }
  },

  async loadReport() {
    const { selectedClassId, rangeDays } = this.data;
    if (!selectedClassId) return;

    this.setData({ loading: true });

    const cacheKey = `report_${selectedClassId}_${rangeDays}`;
    const cachedReport = cache.get(cacheKey);

    if (cachedReport) {
      this.setData({
        report: cachedReport,
        loading: false
      });
      this.processReportData(cachedReport);
      return;
    }

    try {
      const report = await fetchTeacherReport({
        classId: selectedClassId,
        rangeDays
      });

      this.setData({ report });
      cache.set(cacheKey, report, 3 * 60 * 1000);
      this.processReportData(report);
    } catch (error) {
      errorHandler.handle(error, {
        onRetry: () => this.loadReport()
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  processReportData(report) {
    if (!report) return;

    const submissionCount = report.submissions?.length || 0;
    const totalStudents = report.totalStudents || 0;
    const submissionRate = totalStudents > 0 
      ? Math.round((submissionCount / totalStudents) * 100)
      : 0;

    this.setData({
      submissionCount,
      submissionRateText: `${submissionRate}%`
    });

    if (report.trend && report.trend.length > 0) {
      const trendChartData = report.trend.map(item => ({
        value: item.avg,
        date: item.date
      }));
      this.setData({ trendChartData });
    }

    if (report.scoreDistribution) {
      this.setData({
        scoreDistribution: report.scoreDistribution
      });
    }
  },

  onSelectClass(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ selectedClassId: id });
    this.loadReport();
  },

  onRangeChange(e) {
    const { days } = e.currentTarget.dataset;
    this.setData({ rangeDays: days });
    this.loadReport();
  },

  onPullDownRefresh() {
    this.loadReport().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShowHelp() {
    showHelp('report');
  }
});
```

- [ ] **Step 3: 提交班级报告页优化**

```bash
git add wechat-miniapp/pages/teacher/report/
git commit -m "feat(teacher-miniapp): optimize report page with error handling and caching"
```

### Task 11: 优化个人中心页

**Files:**
- Modify: `wechat-miniapp/pages/teacher/profile/index.js`
- Modify: `wechat-miniapp/pages/teacher/profile/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/profile/index.json`

- [ ] **Step 1: 更新个人中心页配置**

修改文件 `wechat-miniapp/pages/teacher/profile/index.json`：

```json
{
  "navigationBarTitleText": "个人中心",
  "usingComponents": {
    "empty-state": "/components/empty-state/index"
  }
}
```

- [ ] **Step 2: 优化个人中心页逻辑**

修改文件 `wechat-miniapp/pages/teacher/profile/index.js`，添加缓存管理：

```javascript
const errorHandler = require('../../../lib/error-handler');
const cache = require('../../../lib/cache');
const { showHelp } = require('../../../lib/help');

Page({
  data: {
    userName: '',
    userAccount: '',
    avatarText: '',
    cacheSize: 0
  },

  onLoad() {
    this.loadUserInfo();
    this.updateCacheSize();
  },

  onShow() {
    this.updateCacheSize();
  },

  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({
          userName: userInfo.name || '老师',
          userAccount: userInfo.username || '',
          avatarText: (userInfo.name || '老')[0]
        });
      }
    } catch (error) {
      console.error('Load user info failed:', error);
    }
  },

  updateCacheSize() {
    const cacheSize = cache.getCacheSize();
    this.setData({ cacheSize });
  },

  onGradingSettings() {
    wx.navigateTo({
      url: '/pages/teacher/grading-settings/index'
    });
  },

  onClassManage() {
    wx.navigateTo({
      url: '/pages/teacher/classes/index'
    });
  },

  onChangePassword() {
    wx.navigateTo({
      url: '/pages/change-password/index'
    });
  },

  onClearCache() {
    wx.showModal({
      title: '确认清理',
      content: `确定要清理 ${this.data.cacheSize} 个缓存项吗？`,
      success: (res) => {
        if (res.confirm) {
          cache.clear();
          this.updateCacheSize();
          wx.showToast({
            title: '清理完成',
            icon: 'success'
          });
        }
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.doLogout();
        }
      }
    });
  },

  async doLogout() {
    try {
      await logout();
      wx.reLaunch({
        url: '/pages/login/index'
      });
    } catch (error) {
      errorHandler.handle(error);
    }
  },

  onShowHelp() {
    showHelp('profile');
  }
});
```

- [ ] **Step 3: 优化个人中心页模板**

修改文件 `wechat-miniapp/pages/teacher/profile/index.wxml`，添加缓存管理：

```xml
<view class="page theme-profile">
  <view class="user-card fade-in">
    <view class="user-avatar">
      <text class="user-avatar-text">{{avatarText}}</text>
    </view>
    <view class="user-info">
      <text class="user-name">{{userName}}</text>
      <text class="user-account">{{userAccount}}</text>
    </view>
  </view>

  <view class="menu-list fade-in">
    <view class="menu-item" bindtap="onGradingSettings">
      <text class="menu-icon">⚙️</text>
      <text class="menu-label">评分设置</text>
      <text class="menu-arrow">›</text>
    </view>
    <view class="menu-item" bindtap="onClassManage">
      <text class="menu-icon">🏫</text>
      <text class="menu-label">班级管理</text>
      <text class="menu-arrow">›</text>
    </view>
    <view class="menu-item" bindtap="onChangePassword">
      <text class="menu-icon">🔒</text>
      <text class="menu-label">修改密码</text>
      <text class="menu-arrow">›</text>
    </view>
    <view class="menu-item" bindtap="onClearCache">
      <text class="menu-icon">🗑️</text>
      <text class="menu-label">清理缓存</text>
      <text class="menu-badge" wx:if="{{cacheSize > 0}}">{{cacheSize}}</text>
      <text class="menu-arrow">›</text>
    </view>
  </view>

  <view class="logout-section">
    <button class="btn btn-danger" bindtap="onLogout">退出登录</button>
  </view>
</view>
```

- [ ] **Step 4: 添加缓存徽章样式**

修改文件 `wechat-miniapp/pages/teacher/profile/index.wxss`，添加：

```css
.menu-badge {
  padding: 4rpx 12rpx;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
  border-radius: 20rpx;
  font-size: 22rpx;
  margin-right: 12rpx;
}
```

- [ ] **Step 5: 提交个人中心页优化**

```bash
git add wechat-miniapp/pages/teacher/profile/
git commit -m "feat(teacher-miniapp): optimize profile page with cache management"
```

---

## 第三阶段：性能优化（1-2周）

### Task 12: 实现图片懒加载

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/student-submissions/index.wxml`

- [ ] **Step 1: 在作业列表页添加图片懒加载**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.wxml`，在图片标签中添加 `lazy-load` 属性：

```xml
<image lazy-load src="{{item.imageUrl}}" mode="aspectFill" />
```

- [ ] **Step 2: 在学生提交列表页添加图片懒加载**

修改文件 `wechat-miniapp/pages/teacher/student-submissions/index.wxml`，在图片标签中添加 `lazy-load` 属性：

```xml
<image lazy-load src="{{item.imageUrl}}" mode="aspectFill" />
```

- [ ] **Step 3: 提交图片懒加载优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/index.wxml wechat-miniapp/pages/teacher/student-submissions/index.wxml
git commit -m "perf(teacher-miniapp): add lazy loading for images"
```

### Task 13: 实现列表分页加载

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.js`
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxml`

- [ ] **Step 1: 修改作业列表页逻辑支持分页**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.js`，添加分页相关数据和方法：

```javascript
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
    loadingMore: false
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
  }
});
```

- [ ] **Step 2: 在模板中添加加载更多提示**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.wxml`，在列表底部添加加载更多提示：

```xml
<view wx:else>
  <view
    wx:for="{{filteredHomeworks}}"
    wx:key="id"
    class="homework-card fade-in clickable-item"
    style="animation-delay: {{index * 0.05}}s"
    data-id="{{item.id}}"
    bindtap="onHomeworkTap"
  >
    <!-- 卡片内容 -->
  </view>

  <view wx:if="{{loadingMore}}" class="loading-more">
    <view class="loading-spinner"></view>
    <text class="loading-text">加载中...</text>
  </view>

  <view wx:elif="{{!hasMore && filteredHomeworks.length > 0}}" class="no-more">
    <text>没有更多了</text>
  </view>
</view>
```

- [ ] **Step 3: 添加加载更多样式**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.wxss`，添加：

```css
.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx;
}

.loading-more .loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-more .loading-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: 提交分页加载优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/
git commit -m "perf(teacher-miniapp): implement pagination for homeworks list"
```

### Task 14: 实现搜索防抖

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.js`

- [ ] **Step 1: 添加搜索功能**

修改文件 `wechat-miniapp/pages/teacher/homeworks/index.js`，添加搜索相关数据和方法：

```javascript
const { debounce } = require('../../../lib/utils');

Page({
  data: {
    // ... 其他数据
    searchText: '',
    searchResults: []
  },

  onLoad() {
    this.debouncedSearch = debounce(this.performSearch, 300);
    this.loadUserInfo();
    this.loadClasses();
  },

  onSearchInput(e) {
    const searchText = e.detail.value;
    this.setData({ searchText });
    
    if (searchText.trim()) {
      this.debouncedSearch();
    } else {
      this.applyFilter();
    }
  },

  performSearch() {
    const { searchText, homeworks } = this.data;
    
    if (!searchText.trim()) {
      this.applyFilter();
      return;
    }

    const keyword = searchText.toLowerCase();
    const results = homeworks.filter(h => 
      h.title.toLowerCase().includes(keyword) ||
      (h.description && h.description.toLowerCase().includes(keyword))
    );

    this.setData({ searchResults: results });
  },

  applyFilter() {
    const { homeworks, activeFilter, searchText } = this.data;
    const now = new Date();

    let filteredHomeworks = [];

    if (searchText.trim()) {
      filteredHomeworks = this.data.searchResults;
    } else if (activeFilter === 'all') {
      filteredHomeworks = [...homeworks];
    } else if (activeFilter === 'open') {
      filteredHomeworks = homeworks.filter(h => h.dueAt && new Date(h.dueAt) > now);
    } else if (activeFilter === 'closed') {
      filteredHomeworks = homeworks.filter(h => h.dueAt && new Date(h.dueAt) <= now);
    }

    this.setData({ filteredHomeworks });
  }
});
```

- [ ] **Step 2: 提交搜索防抖优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/index.js
git commit -m "perf(teacher-miniapp): add debounced search for homeworks"
```

---

## 第四阶段：易用性提升（1周）

### Task 15: 优化表单验证

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homework-edit/index.js`

- [ ] **Step 1: 添加实时表单验证**

修改文件 `wechat-miniapp/pages/teacher/homework-edit/index.js`，添加表单验证：

```javascript
Page({
  data: {
    title: '',
    description: '',
    dueAt: '',
    classId: '',
    errors: {
      title: '',
      dueAt: ''
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

  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    });
  },

  onDueAtChange(e) {
    const dueAt = e.detail.value;
    const error = this.validateDueAt(dueAt);
    
    this.setData({
      dueAt,
      'errors.dueAt': error
    });
  },

  validateTitle(title) {
    if (!title || !title.trim()) {
      return '请输入作业标题';
    }
    if (title.length > 100) {
      return '标题不能超过100个字符';
    }
    return '';
  },

  validateDueAt(dueAt) {
    if (!dueAt) {
      return '请选择截止时间';
    }
    const dueDate = new Date(dueAt);
    const now = new Date();
    if (dueDate <= now) {
      return '截止时间必须晚于当前时间';
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

  async onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    const { title, description, dueAt, classId } = this.data;

    try {
      await createHomework({
        title,
        description,
        dueAt,
        classId
      });

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      errorHandler.handle(error);
    }
  }
});
```

- [ ] **Step 2: 提交表单验证优化**

```bash
git add wechat-miniapp/pages/teacher/homework-edit/index.js
git commit -m "feat(teacher-miniapp): add real-time form validation"
```

### Task 16: 添加批量操作功能

**Files:**
- Modify: `wechat-miniapp/pages/teacher/student-submissions/index.js`
- Modify: `wechat-miniapp/pages/teacher/student-submissions/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/student-submissions/index.wxss`

- [ ] **Step 1: 添加批量操作逻辑**

修改文件 `wechat-miniapp/pages/teacher/student-submissions/index.js`，添加批量操作方法：

```javascript
Page({
  data: {
    submissions: [],
    selectMode: false,
    selectedIds: [],
    selectedCount: 0
  },

  onSelectMode() {
    this.setData({ 
      selectMode: true,
      submissions: this.data.submissions.map(s => ({ ...s, selected: false })),
      selectedIds: [],
      selectedCount: 0
    });
  },

  exitSelectMode() {
    this.setData({ 
      selectMode: false,
      submissions: this.data.submissions.map(s => ({ ...s, selected: false })),
      selectedIds: [],
      selectedCount: 0
    });
  },

  onSelectModeTap(e) {
    if (!this.data.selectMode) return;

    const { id } = e.currentTarget.dataset;
    const { submissions, selectedIds } = this.data;
    
    const index = submissions.findIndex(s => s.id === id);
    if (index < 0) return;

    const selected = !submissions[index].selected;
    submissions[index].selected = selected;

    const newSelectedIds = selected 
      ? [...selectedIds, id]
      : selectedIds.filter(i => i !== id);

    this.setData({
      submissions,
      selectedIds: newSelectedIds,
      selectedCount: newSelectedIds.length
    });
  },

  async onBatchDelete() {
    const { selectedIds } = this.data;
    if (selectedIds.length === 0) return;

    const confirmed = await wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedIds.length} 条记录吗？`,
      confirmColor: '#ef4444'
    });

    if (!confirmed) return;

    wx.showLoading({ title: '删除中...' });
    
    try {
      await batchDeleteSubmissions(selectedIds);
      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      this.exitSelectMode();
      this.loadSubmissions();
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error);
    }
  },

  async onBatchExport() {
    const { selectedIds } = this.data;
    if (selectedIds.length === 0) return;

    wx.showLoading({ title: '导出中...' });
    
    try {
      const pdfUrl = await exportSubmissionsPdf(selectedIds);
      wx.hideLoading();
      
      wx.downloadFile({
        url: pdfUrl,
        success: (res) => {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf'
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error);
    }
  }
});
```

- [ ] **Step 2: 提交批量操作功能**

```bash
git add wechat-miniapp/pages/teacher/student-submissions/
git commit -m "feat(teacher-miniapp): add batch operations for submissions"
```

---

## 测试和部署

### Task 17: 编写测试用例

**Files:**
- Create: `wechat-miniapp/tests/lib/error-handler.test.js`
- Create: `wechat-miniapp/tests/lib/cache.test.js`

- [ ] **Step 1: 编写错误处理测试**

创建文件 `wechat-miniapp/tests/lib/error-handler.test.js`：

```javascript
const errorHandler = require('../../lib/error-handler');

describe('ErrorHandler', () => {
  test('should parse network error', () => {
    const error = { errMsg: 'request:fail' };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('网络连接失败');
  });

  test('should parse 401 error', () => {
    const error = { statusCode: 401 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('登录已过期');
  });

  test('should parse 403 error', () => {
    const error = { statusCode: 403 };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('无权限访问');
  });

  test('should parse business error', () => {
    const error = {
      statusCode: 400,
      data: { code: 'HOMEWORK_NOT_FOUND' }
    };
    const result = errorHandler.parseError(error);
    expect(result.title).toBe('作业不存在');
  });
});
```

- [ ] **Step 2: 编写缓存管理测试**

创建文件 `wechat-miniapp/tests/lib/cache.test.js`：

```javascript
const cache = require('../../lib/cache');

describe('CacheManager', () => {
  beforeEach(() => {
    cache.clear();
  });

  test('should set and get cache', () => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data);
    const result = cache.get('test_key');
    expect(result).toEqual(data);
  });

  test('should return null for expired cache', (done) => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data, 100);
    
    setTimeout(() => {
      const result = cache.get('test_key');
      expect(result).toBeNull();
      done();
    }, 150);
  });

  test('should remove cache', () => {
    const data = { id: 1, name: 'test' };
    cache.set('test_key', data);
    cache.remove('test_key');
    const result = cache.get('test_key');
    expect(result).toBeNull();
  });

  test('should clear all cache', () => {
    cache.set('key1', { id: 1 });
    cache.set('key2', { id: 2 });
    cache.clear();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
```

- [ ] **Step 3: 提交测试用例**

```bash
git add wechat-miniapp/tests/
git commit -m "test(teacher-miniapp): add unit tests for error handler and cache"
```

### Task 18: 更新文档

**Files:**
- Modify: `wechat-miniapp/README.md`
- Modify: `docs/WECHAT_MINIAPP.md`

- [ ] **Step 1: 更新小程序 README**

在文件 `wechat-miniapp/README.md` 中添加优化说明：

```markdown
## 最新优化（2026-04-03）

### UI/UX 优化
- 新增骨架屏组件，优化加载体验
- 新增空状态组件，提供友好的空数据引导
- 优化作业列表、拍照上传、班级报告等核心页面布局
- 添加帮助提示系统，降低学习成本

### 性能优化
- 实现图片懒加载，提升列表滚动流畅度
- 实现数据缓存，减少重复请求
- 实现分页加载，提升首屏速度
- 添加防抖节流，优化高频操作

### 易用性提升
- 统一错误处理，提供友好的错误提示
- 优化操作流程，减少操作步骤
- 添加批量操作功能
- 实现实时表单验证
```

- [ ] **Step 2: 提交文档更新**

```bash
git add wechat-miniapp/README.md docs/WECHAT_MINIAPP.md
git commit -m "docs(teacher-miniapp): update documentation for optimization"
```

### Task 19: 最终测试和部署

- [ ] **Step 1: 运行所有测试**

```bash
npm test
```

预期输出：所有测试通过

- [ ] **Step 2: 在微信开发者工具中测试**

1. 打开微信开发者工具
2. 导入项目
3. 测试所有优化功能
4. 检查性能指标
5. 验证用户体验

- [ ] **Step 3: 创建发布标签**

```bash
git tag -a v1.1.0 -m "feat: teacher miniapp optimization - UI/UX, performance, usability"
git push origin v1.1.0
```

- [ ] **Step 4: 提交最终版本**

```bash
git add .
git commit -m "release: teacher miniapp optimization v1.1.0"
```

---

## 总结

本实施计划涵盖了小程序老师端全面优化的所有任务，分为四个阶段：

1. **第一阶段：核心优化** - 创建工具库和通用组件
2. **第二阶段：UI/UX 优化** - 优化核心页面布局和交互
3. **第三阶段：性能优化** - 实现懒加载、分页、防抖等
4. **第四阶段：易用性提升** - 优化表单验证和批量操作

每个任务都包含详细的步骤和代码示例，确保工程师可以独立完成实施。所有优化都遵循渐进式原则，在保持现有架构的基础上逐步提升用户体验。
