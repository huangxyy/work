# 微信小程序说明

本文档面向仓库维护者和后续接手同学，说明 Homework AI 中独立微信小程序学生端的定位、目录、导入方式与联调注意事项。

## 目录位置

微信小程序目录位于仓库根目录：

```text
d:\work\wechat-miniapp
```

它与以下两个主应用并列存在：

- `apps/backend`：NestJS + Prisma 后端
- `apps/frontend`：React Web 前端

这个小程序目录是**独立实现**，不会混入 `apps/*`，便于使用微信开发者工具直接导入、调试和后续迭代。

## 当前覆盖的学生端能力

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

## 页面结构

当前已注册页面如下：

- `pages/login/index`
- `pages/homeworks/index`
- `pages/submissions/index`
- `pages/report/index`
- `pages/homework-detail/index`
- `pages/submit/index`
- `pages/submission-result/index`
- `pages/profile/index`

TabBar 页面：

- 作业
- 提交
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
2. 选择“导入项目”
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

| 角色 | 账号 | 密码 |
|------|------|------|
| 学生 | student01 | Test1234 |

当前小程序首版只允许学生账号登录。

## 关键实现约定

### 登录态存储

- Token：`auth_token`
- 用户：`auth_user`

定义文件：`wechat-miniapp/lib/auth.js`

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

这样可以与后端 `FilesInterceptor` 保持一致，避免出现“一张图变成一条提交记录”的问题。

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

当筛选条件导致列表为空时，页面空态里也会直接提供“重置筛选”入口。

### 学习报告空态策略

学习报告页除了支持记住上次选择的统计时间范围，还会在当前范围样本不足时给出更明确的行动建议：

- 直接回到作业页继续提交
- 一键扩大统计时间范围

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

## 推荐阅读顺序

如果你是第一次接手这个小程序，建议按下面顺序阅读：

1. `wechat-miniapp/README.md`
2. `docs/API.md`
3. `docs/DEVELOPMENT.md`
4. `wechat-miniapp/lib/request.js`
5. `wechat-miniapp/pages/submit/index.js`

## 相关文档

- [../wechat-miniapp/README.md](../wechat-miniapp/README.md) - 小程序目录内的详细说明
- [./API.md](./API.md) - API 文档
- [./DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
