# 微信小程序老师端设计方案

**日期**: 2026-04-02
**项目**: Homework AI - 小程序老师端

## 1. 概述

为微信小程序新增老师端功能，核心是拍照上传批改作业。老师可以通过手机拍照或选择相册图片，系统自动识别学生姓名并匹配到对应作业进行 AI 批改。

### 1.1 设计目标

- 支持老师账号登录
- 拍照上传批改（核心功能）
- 作业管理（发布、编辑、删除）
- 班级管理（查看学生）
- 学习报告统计
- 与现有学生端共享组件和样式

## 2. 页面结构

| 页面 | 路径 | 功能 |
|------|------|------|
| 登录页 | `pages/login/index` | 支持学生/老师登录，根据角色跳转 |
| 作业列表 | `pages/teacher/homeworks/index` | 查看、创建、编辑、删除作业 |
| 作业详情 | `pages/teacher/homework-detail/index` | 查看提交列表、批量上传入口 |
| 拍照上传 | `pages/teacher/capture/index` | 拍照/选图、识别、匹配作业 |
| 上传结果 | `pages/teacher/upload-result/index` | 显示上传/跳过状态，支持重试 |
| 提交详情 | `pages/teacher/submission-detail/index` | 查看学生批改结果 |
| 报告页 | `pages/teacher/report/index` | 班级统计、作业统计 |
| 班级管理 | `pages/teacher/classes/index` | 查看/编辑班级、学生管理 |
| 个人中心 | `pages/teacher/profile/index` | 个人信息、设置 |

## 3. 导航结构

### 3.1 老师端 tabBar

```json
{
  "list": [
    { "pagePath": "pages/teacher/homeworks/index", "text": "作业", "iconPath": "assets/icons/homework.png" },
    { "pagePath": "pages/teacher/capture/index", "text": "拍照", "iconPath": "assets/icons/camera.png" },
    { "pagePath": "pages/teacher/report/index", "text": "报告", "iconPath": "assets/icons/report.png" },
    { "pagePath": "pages/teacher/profile/index", "text": "我的", "iconPath": "assets/icons/profile.png" }
  ]
}
```

### 3.2 页面路由关系

```
登录页 (login)
├── 学生 → 学生首页 (homeworks)
└── 老师 → 老师首页 (teacher/homeworks)

老师首页 (teacher/homeworks)
├── 发布作业
├── 作业详情 → 查看提交列表
└── 班级管理

拍照页 (teacher/capture)
├── 选择评分模式
├── 拍照/选图
├── 匹配结果确认
└── 上传结果页

上传结果 (teacher/upload-result)
├── 查看成功/跳过列表
├── 重试跳过项
└── 查看提交详情

报告页 (teacher/report)
├── 班级选择
├── 统计概览
└── 详细报告

个人中心 (teacher/profile)
├── 个人信息
└── 退出登录
```

## 4. 拍照上传核心流程

### 4.1 流程图

```
┌─────────────────┐
│   进入拍照页     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 选择评分模式    │
│ - 快速(cheap)   │
│ - 详细(quality) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 调用相机/相册   │
│ 选择多张图片    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 上传预览        │
│ POST /teacher/  │
│ submissions/batch│
│ (dryRun=true)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 显示匹配结果    │
│ - 已匹配学生    │
│ - 未匹配(手动)  │
│ - 跳过项        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 选择目标作业    │
│ 确认/修正匹配   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 提交创建        │
│ POST /teacher/  │
│ submissions/batch│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  上传结果页     │
│ 显示处理状态    │
└─────────────────┘
```

### 4.2 API 调用

**预览匹配（Dry Run）**
```javascript
POST /teacher/submissions/batch
Content-Type: multipart/form-data

{
  homeworkId: string,
  images: File[],
  nameOverrides: Record<string, string>,  // 手动指定姓名
  dryRun: "true"
}

→ 返回 TeacherBatchPreviewResult
```

**创建提交**
```javascript
POST /teacher/submissions/batch
Content-Type: multipart/form-data

{
  homeworkId: string,
  images: File[],
  mode: "cheap" | "quality",
  needRewrite: boolean,
  nameOverrides: Record<string, string>,
  excludedFileKeys: string  // 排除的图片
}

→ 返回 TeacherBatchUploadResult (含 batchId)
```

## 5. 登录改造

### 5.1 当前状态

- 登录页只支持学生账号
- 非学生账号会被拒绝：`当前首版仅支持学生账号`

### 5.2 改造方案

```javascript
// pages/login/index.js
async handleLogin() {
  const response = await login(account, password);
  const { user } = response;

  // 根据角色跳转
  if (user.role === 'STUDENT') {
    wx.switchTab({ url: '/pages/homeworks/index' });
  } else if (user.role === 'TEACHER') {
    wx.switchTab({ url: '/pages/teacher/homeworks/index' });
  } else {
    showToast('不支持的账号类型');
  }
}
```

### 5.3 app.json 更新

```json
{
  "pages": [
    "pages/login/index",
    "pages/homeworks/index",
    "pages/submissions/index",
    // ... 学生端页面
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

## 6. 新增/修改文件

### 6.1 Service 模块

| 文件 | 功能 |
|------|------|
| `services/teacher.js` | 老师相关 API（作业、班级、批量上传、报告） |
| `services/homeworks.js` | 扩展支持创建/编辑/删除作业 |

### 6.2 工具库

| 文件 | 功能 |
|------|------|
| `lib/teacher.js` | 老师端通用工具（状态判断、格式化） |

### 6.3 样式文件

| 文件 | 功能 |
|------|------|
| `styles/teacher.wxss` | 老师端主题样式 |

## 7. API 映射

| 功能 | API 端点 | 方法 |
|------|----------|------|
| 获取班级列表 | `/teacher/classes` | GET |
| 获取作业列表 | `/teacher/homeworks` | GET |
| 创建作业 | `/teacher/homeworks` | POST |
| 删除作业 | `/teacher/homeworks/:id` | DELETE |
| 获取提交列表 | `/teacher/submissions?homeworkId=` | GET |
| 批量上传预览 | `/teacher/submissions/batch` (dryRun) | POST |
| 批量上传创建 | `/teacher/submissions/batch` | POST |
| 获取上传历史 | `/teacher/submissions/batches?homeworkId=` | GET |
| 获取上传详情 | `/teacher/submissions/batches/:id` | GET |
| 重试跳过项 | `/teacher/submissions/retry-skipped` | POST |
| 获取班级报告 | `/teacher/reports/class` | GET |
| 获取评分偏好 | `/teacher/settings/grading/preference` | GET |
| 更新评分偏好 | `/teacher/settings/grading/preference` | POST |

## 8. 主题设计

老师端采用与现有 Rainbow World 风格一致但配色不同的主题：

| 页面 | 主题色 | 渐变 |
|------|--------|------|
| 登录页（老师） | 绿色 | `linear-gradient(135deg, #10b981 0%, #059669 100%)` |
| 作业列表 | 蓝色 | `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)` |
| 拍照上传 | 橙色 | `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)` |
| 报告页 | 青色 | `linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)` |
| 个人中心 | 绿色 | `linear-gradient(135deg, #10b981 0%, #059669 100%)` |

## 9. 共享组件

与学生端共享现有组件：
- `gradient-button` - 渐变按钮
- `styles/theme.wxss` - 主题变量
- `styles/components.wxss` - 通用组件
- `styles/animations.wxss` - 动画效果

## 10. 实施顺序

1. 登录页改造 - 支持老师登录
2. 老师端 Service 模块 - API 封装
3. 作业列表页 - 查看作业
4. 拍照上传页 - 核心功能
5. 上传结果页 - 显示状态
6. 作业详情页 - 提交列表
7. 提交详情页 - 批改结果
8. 报告页 - 统计数据
9. 班级管理页 - 学生列表
10. 个人中心页 - 老师信息

## 11. 测试要点

- [ ] 老师账号登录正常跳转
- [ ] 拍照上传流程完整可用
- [ ] 学生匹配准确率
- [ ] 跳过项重试功能
- [ ] 作业创建/编辑/删除
- [ ] 报告数据正确显示
- [ ] 页面主题风格统一
