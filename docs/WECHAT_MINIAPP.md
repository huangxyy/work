# 微信小程序说明

本文档面向仓库维护者和后续接手同学，说明 Homework AI 中独立微信小程序的定位、目录、导入方式与联调注意事项。

## 目录位置

微信小程序目录位于仓库根目录：

```text
work/wechat-miniapp
```

它与以下两个主应用并列存在：

- `apps/backend`：NestJS + Prisma 后端
- `apps/frontend`：React Web 前端

这个小程序目录是**独立实现**，不会混入 `apps/*`，便于使用微信开发者工具直接导入、调试和后续迭代。

## 角色支持

小程序支持两种用户角色：

| 角色 | 登录入口 | 功能范围 |
|------|----------|----------|
| 学生 | `pages/login/` | 作业查看、提交、查看批改结果、学习报告 |
| 教师 | 同一登录页，根据角色自动跳转 | 班级管理、作业管理、批改查看、学习报告 |

## 设计系统：Rainbow World 主题

小程序采用 **Rainbow World** 彩虹世界设计系统，提供活泼有趣的视觉体验：

### 主题配色

每个页面拥有独特的渐变色主题（统一使用橙色、绿色、青色、红色等暖色调，禁止使用紫色/粉色/蓝色）：

#### 学生端页面

| 页面 | 主题色 | CSS 类 |
|------|--------|--------|
| 登录页 | 橙色欢迎主题 | `.theme-login` |
| 作业列表 | 橙色系 `#f59e0b → #d97706` | `.theme-homeworks` |
| 提交作业 | 橙色系 `#f97316 → #ea580c` | `.theme-submit` |
| 批改结果 | 绿色系 `#10b981 → #059669` | `.theme-result` |
| 提交记录 | 绿色系 | `.theme-result` |
| 作业详情 | 橙色系 | `.theme-homeworks` |
| 个人中心 | 绿色系 `#10b981 → #34d399` | `.theme-profile` |
| 消息通知 | 橙色系 `#f59e0b → #fbbf24` | `.theme-messages` |
| 学习报告 | 青色系 `#14b8a6 → #2dd4bf` | `.theme-report` |

#### 教师端页面

| 页面 | 主题色 | CSS 类 |
|------|--------|--------|
| 作业管理 | 青色系 `#14b8a6 → #0d9488` | `.theme-teacher-homeworks` |
| 作业详情 | 青色系 | `.theme-teacher-homeworks` |
| 作业编辑 | 青色系 | `.theme-teacher-homeworks` |
| 班级管理 | 橙色系 `#f59e0b → #d97706` | `.theme-teacher-classes` |
| 提交详情 | 橙色系 | `.theme-teacher-submission` |
| 学习报告 | 橙色系 `#f59e0b → #fbbf24` | `.theme-report` |

### 样式文件

- `styles/theme.wxss` - CSS 变量定义和主题色
- `styles/components.wxss` - 可复用组件样式（按钮、卡片、标签等）
- `styles/teacher.wxss` - 教师端专用样式
- `styles/animations.wxss` - 动画效果（fadeIn, scaleIn, spin, pulse）

### 组件

- `components/gradient-button` - 渐变按钮组件
- `components/chart-card` - 图表组件（用于学习报告，基于 ECharts）
- `components/loading-skeleton` - 骨架屏加载组件
- `components/empty-state` - 空状态引导组件

### 工具库

- `lib/request.js` - HTTP 请求封装，含认证处理
- `lib/auth.js` - 认证状态管理
- `lib/config.js` - 配置管理
- `lib/cache.js` - 数据缓存（支持过期检测）
- `lib/error-handler.js` - 统一错误处理
- `lib/performance.js` - 性能监控
- `lib/utils.wxs` - WXS 辅助函数（格式化、状态文本等）
- `lib/help.js` - 页面帮助提示系统

## 学生端功能

- 学生账号登录
- 作业列表与作业详情
- 单次多图上传提交
- 提交页本地草稿自动保存与恢复
- 作业列表 / 作业详情跨页面识别未提交草稿
- 批改结果轮询
- 提交记录列表、筛选持久化、统计摘要
- 学习报告查看、范围记忆与空态引导
- 学习报告 PDF 导出与小程序内打开
- 个人中心 API 地址切换、登录状态同步与本地草稿清理

## 教师端功能

- 教师账号登录（与学生共用登录页，自动识别角色）
- 班级管理：查看班级列表、学生列表
- 作业管理：创建、编辑、查看作业
- 作业详情：查看提交统计、学生提交列表
- 提交详情：查看 OCR 识别文字、评分详情、错误类型统计、**分数动画效果**、**教师反馈功能**
- 学习报告：班级整体数据、分数分布、提交趋势图表
- 批量上传：拍照上传学生作业、**草稿保存功能**
- 消息通知：**接入真实 API**，查看班级公告和系统通知
- 学生报告：查看单个学生的学习报告

### 最新优化（2026-04）

- **图表可视化优化**：动态计算图表宽度，解决超出屏幕问题
- **API 弃用修复**：使用 `wx.getDeviceInfo()` 和 `wx.getWindowInfo()` 替代弃用的 `wx.getSystemInfoSync()`
- **颜色方案更新**：统一使用暖色调（橙色、绿色、青色），禁止紫色/粉色/蓝色
- **教师端消息页面**：接入真实 API，支持班级筛选
- **提交详情页**：添加分数动画效果、教师反馈功能
- **批量上传**：添加草稿保存功能

## 页面结构

### 学生端页面

- `pages/login/index` - 登录页
- `pages/homeworks/index` - 作业列表
- `pages/homework-detail/index` - 作业详情
- `pages/submit/index` - 提交作业
- `pages/submission-result/index` - 批改结果
- `pages/submissions/index` - 提交记录
- `pages/report/index` - 学习报告
- `pages/profile/index` - 个人中心
- `pages/change-password/index` - 修改密码

### 教师端页面

- `pages/teacher/homeworks/index` - 作业管理
- `pages/teacher/homework-detail/index` - 作业详情
- `pages/teacher/homework-edit/index` - 作业编辑
- `pages/teacher/classes/index` - 班级管理
- `pages/teacher/submission-detail/index` - 提交详情（含分数动画、教师反馈）
- `pages/teacher/report/index` - 班级学习报告
- `pages/teacher/student-report/index` - 学生个人报告
- `pages/teacher/student-submissions/index` - 学生提交概览
- `pages/teacher/upload-result/index` - 批量上传结果
- `pages/teacher/capture/index` - 批量上传（含草稿保存）
- `pages/teacher/messages/index` - 公告管理（真实 API）
- `pages/teacher/grading-settings/index` - 批改设置

### TabBar 配置

学生端 TabBar：
- 作业
- 提交
- 我的

教师端 TabBar：
- 作业
- 班级
- 我的

## 导入微信开发者工具

### 游客模式

当前 `wechat-miniapp/project.config.json` 默认配置：

```json
{
  "appid": "touristappid"
}
```

适合快速进行本地联调。

导入步骤：

1. 打开微信开发者工具
2. 选择"导入项目"
3. 项目目录选择 `d:\work\wechat-miniapp`
4. AppID 保持游客模式或替换成真实小程序 AppID
5. 完成导入并编译

### 真实 AppID 模式

如果需要更接近生产的联调方式：

1. 在微信公众平台准备真实小程序 AppID
2. 修改 `wechat-miniapp/project.config.json`
3. 将 `appid` 从 `touristappid` 改为真实值
4. 重新导入或重新编译

## 联调依赖

小程序本身不直接做批改，它依赖现有后端与 Worker。

联调前建议至少启动：

```bash
pnpm dev:backend
pnpm dev:worker
```

如果还要同时联调 Web 端，可额外启动：

```bash
pnpm dev:frontend
```

## API Base URL 说明

当前默认开发地址：

```text
http://127.0.0.1:3000/api
```

配置位置：

- `wechat-miniapp/lib/config.js`
- 登录页
- 个人中心页

### 模拟器调试

通常可直接使用：

```text
http://127.0.0.1:3000/api
```

### 真机或局域网调试

不要继续使用 `127.0.0.1`，应改为电脑局域网地址，例如：

```text
http://192.168.1.10:3000/api
```

同时确认：

- 手机与电脑在同一网络
- 3000 端口可访问
- Windows 防火墙未拦截

## 默认测试账号

⚠️ **开发环境专用密码** - 生产环境必须更改

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | 123456 |
| 教师 | teacher01 | 123456 |
| 学生 | student01 | 123456 |

**注意**：小程序支持学生和教师账号登录。管理员请使用 Web 端。

## 关键实现约定

### 登录态存储

- Token：`auth_token`
- 用户：`auth_user`

定义文件：`wechat-miniapp/lib/auth.js`

### 角色识别

登录成功后，根据 `user.role` 自动跳转：

- `STUDENT` → 学生端 TabBar 首页
- `TEACHER` → 教师端 TabBar 首页

### 通用设置存储

- 设置键：`miniapp_settings`

定义文件：`wechat-miniapp/lib/config.js`

### 401 处理策略

请求层遇到 401 时会：

1. 清空本地会话
2. 自动跳回登录页
3. 保存来源页
4. 登录成功后自动回跳

相关文件：

- `wechat-miniapp/lib/request.js`
- `wechat-miniapp/lib/page.js`
- `wechat-miniapp/pages/login/index.js`

### 多图上传策略

提交页会把 1-3 张图片拼成**单个 multipart/form-data 请求**发给后端，而不是逐张上传。

这样可以与后端 `FilesInterceptor` 保持一致，避免出现"一张图变成一条提交记录"的问题。

相关文件：

- `wechat-miniapp/lib/request.js`
- `wechat-miniapp/services/submissions.js`
- `wechat-miniapp/pages/submit/index.js`

### 本地草稿策略

提交页会把以下内容自动保存在本机：

- 已选择的图片
- 批改模式
- 是否需要改写建议

再次进入同一个作业的提交页时，会优先恢复这份未提交草稿；提交成功或手动清空草稿后，会同步清理本地保存的图片文件。

补充说明：

- 作业列表和作业详情会提示当前作业是否已有未提交草稿
- 个人中心页可以查看本地草稿数量，并一键清理全部草稿

### 筛选持久化策略

以下页面会记住上次使用的筛选条件：

- `pages/homeworks/index`
- `pages/submissions/index`

当筛选条件导致列表为空时，页面空态里也会直接提供"重置筛选"入口。

### 学习报告空态策略

学习报告页除了支持记住上次选择的统计时间范围，还会在当前范围样本不足时给出更明确的行动建议：

- 直接回到作业页继续提交
- 一键扩大统计时间范围

## 数据一致性

小程序端与 Web 端共享同一套后端 API，数据结构保持一致。关键字段映射：

| 后端返回 | 小程序使用 | 说明 |
|----------|-----------|------|
| `submission.student.name` | `submission.student.name` | 学生姓名 |
| `submission.student.account` | `submission.student.account` | 学生账号 |
| `submission.createdAt` | `submission.createdAt` | 提交时间 |
| `submission.totalScore` | `submission.totalScore` | 总分 |

## 常见联调问题

### 提交长期停留在 `QUEUED`

通常说明 Worker 没有启动。

```bash
pnpm dev:worker
```

### 登录成功后又被打回登录页

优先检查：

- API Base URL 是否正确
- JWT 是否过期
- 后端 `/api/auth/me` 是否返回 401

### 真机无法请求本地接口

优先检查：

- 是否还在用 `127.0.0.1`
- 是否已改为局域网 IP
- 手机能否访问电脑的 3000 端口

### PDF 导出无法打开

优先检查：

- `/api/student/reports/pdf` 是否可访问
- 当前登录 Token 是否有效
- 当前调试环境是否支持 `wx.openDocument`

### 页面内容显示不全

检查页面布局是否正确使用了 `view` 而非 `scroll-view` 作为根容器。小程序页面应使用自然滚动，而非固定高度的 scroll-view。

### 图表不显示

检查 `components/chart-card` 组件是否正确引入 ECharts，以及数据格式是否符合要求。

## 推荐阅读顺序

如果你是第一次接手这个小程序，建议按下面顺序阅读：

1. `wechat-miniapp/README.md`
2. `docs/API.md`
3. `docs/DEVELOPMENT.md`
4. `wechat-miniapp/lib/request.js`
5. `wechat-miniapp/lib/auth.js`
6. `wechat-miniapp/pages/submit/index.js`

## 相关文档

- [../wechat-miniapp/README.md](../wechat-miniapp/README.md) - 小程序目录内的详细说明
- [./API.md](./API.md) - API 文档
- [./DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
