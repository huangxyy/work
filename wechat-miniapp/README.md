# 微信小程序学生端说明

本目录是 Homework AI 的独立微信小程序实现，专注学生侧主流程。

它与 `apps/frontend` 的 React Web 端、`apps/backend` 的 NestJS 后端保持解耦，单独放在仓库根目录，便于使用微信开发者工具直接导入和迭代。

## 当前能力

- 学生账号登录
- 作业列表与作业详情
- 单次多图提交（最多 3 张）
- 提交结果轮询与重提
- 提交记录查看、筛选、统计摘要
- 学习报告查看
- 学习报告 PDF 导出与小程序内打开
- 个人中心接口地址切换与登录状态同步
- 401 自动回登录，并支持登录后回跳原页面

## 目录结构

```text
wechat-miniapp/
├── app.js
├── app.json
├── app.wxss
├── lib/
│   ├── auth.js
│   ├── config.js
│   ├── page.js
│   ├── request.js
│   ├── ui.js
│   └── utils.js
├── pages/
│   ├── login/
│   ├── homeworks/
│   ├── homework-detail/
│   ├── submit/
│   ├── submission-result/
│   ├── submissions/
│   ├── report/
│   └── profile/
├── project.config.json
├── services/
│   ├── auth.js
│   ├── homeworks.js
│   ├── reports.js
│   └── submissions.js
└── sitemap.json
```

## 联调前准备

### 1. 启动后端与 Worker

小程序只负责学生侧界面，实际数据依赖现有后端 API 与批改 Worker。

至少需要保证以下服务可用：

- 后端 API：`http://localhost:3000/api`
- Worker：负责处理 `QUEUED / PROCESSING` 的批改任务

推荐直接在仓库根目录启动：

```bash
pnpm dev:backend
pnpm dev:worker
```

如果你还需要同时联调 Web 端：

```bash
pnpm dev:frontend
```

### 2. 准备测试账号

默认学生测试账号：

- 账号：`student01`
- 密码：`Test1234`

如果数据库尚未初始化，请先执行后端种子数据流程。

### 3. 确认接口地址

默认 API Base URL 在代码中定义为：

```text
http://127.0.0.1:3000/api
```

对应实现位置：

- `lib/config.js`
- 登录页
- 个人中心页

如果你是局域网联调或真机调试，需要改成电脑的局域网地址，例如：

```text
http://192.168.1.10:3000/api
```

## 如何导入微信开发者工具

### 方式一：游客模式快速预览

当前 `project.config.json` 使用的是：

```text
appid: touristappid
```

适合先在微信开发者工具里验证页面结构和联调逻辑。

导入步骤：

1. 打开微信开发者工具
2. 选择“导入项目”
3. 项目目录选择 `d:\work\wechat-miniapp`
4. AppID 可保持游客模式
5. 导入后直接编译

### 方式二：使用真实小程序 AppID

如果要进入更接近生产的调试方式：

1. 在微信公众平台创建或选择一个小程序
2. 打开 `wechat-miniapp/project.config.json`
3. 把 `appid` 从 `touristappid` 改成真实 AppID
4. 重新导入或重新编译

## 页面说明

### 登录页

路径：`pages/login/index`

能力：

- 输入 API Base URL
- 使用学生账号登录
- 非学生账号会被拦截
- 如果是从受保护页面跳转到登录，登录后会自动回跳

### 作业页

路径：`pages/homeworks/index`

能力：

- 查看作业列表
- 关键词和状态筛选
- 记住上次筛选条件
- 查看最近 7 天学习摘要
- 识别未提交草稿并直接继续提交
- 快速进入提交记录和学习报告

### 作业详情页

路径：`pages/homework-detail/index`

能力：

- 查看作业详情
- 查看该作业已有提交记录
- 顶部突出最近一次提交摘要
- 识别当前作业是否已有未提交草稿
- 进入提交页
- 跳到学习报告或全部提交记录

### 提交页

路径：`pages/submit/index`

能力：

- 最多选择 3 张图片
- 单张图片限制 10MB
- 选择批改模式
- 选择是否需要改写建议
- 通过单次 multipart/form-data 请求提交多张图片
- 本地自动保存图片与批改设置草稿
- 再次进入页面时自动恢复未提交草稿
- 支持手动清空草稿
- 支持下拉刷新与错误重试

### 结果页

路径：`pages/submission-result/index`

能力：

- 自动轮询 `QUEUED / PROCESSING` 状态
- 明确提示自动刷新中，并支持立即手动刷新
- 展示总分、维度得分、错误、建议、OCR 文本、教师反馈
- 快速跳转作业详情、提交记录与学习报告
- 支持下拉刷新

### 提交记录页

路径：`pages/submissions/index`

能力：

- 查看所有学生提交
- 按关键词、状态、分数区间筛选
- 记住上次筛选条件
- 一键重置筛选
- 查看平均分、完成率等摘要信息
- 就地重置空筛选结果
- 再次提交、查看结果或回到作业详情

### 学习报告页

路径：`pages/report/index`

能力：

- 查看近 7 / 14 / 30 天统计
- 记住上次选择的统计范围
- 查看平均分、最高分、最低分、提交次数
- 查看趋势、高频问题、下一步建议、班级对比
- 在当前范围无样本时给出行动引导
- 导出学生 PDF 报告
- 在小程序内直接打开 PDF

### 个人中心页

路径：`pages/profile/index`

能力：

- 查看当前登录用户
- 修改 API Base URL
- 同步当前用户信息
- 查看本地草稿数量
- 一键清理全部本地草稿
- 快速进入作业、提交记录、学习报告
- 退出登录
- 支持下拉刷新

## 小程序与后端接口对应关系

### 认证相关

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### 学生作业相关

- `GET /api/homeworks/student`

### 学生提交相关

- `POST /api/submissions`
- `GET /api/submissions`
- `GET /api/submissions/:id`

### 学生报告相关

- `GET /api/student/reports/overview`
- `GET /api/student/reports/class-comparison`
- `GET /api/student/reports/pdf`

## 关键实现约定

### 登录态存储

- Token 存储键：`auth_token`
- 用户信息存储键：`auth_user`

定义位置：`lib/auth.js`

### 全局设置存储

- 配置存储键：`miniapp_settings`

定义位置：`lib/config.js`

### 401 处理

请求层在遇到 401 时会：

1. 清空本地会话
2. 自动跳转登录页
3. 带上原始来源页
4. 登录成功后自动回跳

相关实现位置：

- `lib/request.js`
- `pages/login/index.js`
- `lib/page.js`

### 多图上传

学生提交页会把多张图片拼成**单个** `multipart/form-data` 请求，而不是一张图发一次请求。

这样可以匹配后端 `FilesInterceptor` 的处理方式，避免“一张图生成一条提交记录”的问题。

相关实现位置：

- `lib/request.js`
- `services/submissions.js`
- `pages/submit/index.js`

## 本地联调建议

### 模拟器联调

适合页面逻辑、接口连通性和基础提交流程验证。

建议顺序：

1. 登录
2. 进入作业列表
3. 打开作业详情
4. 进入提交页
5. 上传 1-3 张测试图
6. 观察结果页轮询
7. 查看提交记录和学习报告

### 真机联调

需要额外注意：

- API 地址不能用 `127.0.0.1`
- 要改成电脑在局域网中的 IP
- 后端端口和防火墙要允许手机访问
- 图片上传、PDF 打开、登录态回跳都建议真机过一遍

## 常见问题

### 1. 登录页提示网络错误

优先检查：

- 后端 API 是否已启动
- API Base URL 是否写成了当前可访问地址
- 局域网联调时手机与电脑是否在同一网络

### 2. 提交后一直是 `QUEUED`

通常说明 Worker 没有运行。

启动：

```bash
pnpm dev:worker
```

### 3. 提交失败或结果页出现失败状态

优先检查：

- OCR 配置是否可用
- LLM API Key 是否正确
- Worker 日志是否有报错
- 图片是否清晰可识别

### 4. 小程序里打不开 PDF

优先检查：

- 后端 `/api/student/reports/pdf` 是否可访问
- 是否已登录且 Token 有效
- 当前环境是否支持 `wx.openDocument`

### 5. 为什么登录后会跳回之前页面

这是当前实现的预期行为，用来保证从受保护页面跳到登录后，登录成功还能回到原来的操作上下文。

## 推荐后续迭代方向

- 消息通知或待办提醒
- 作业维度的学习分析
- 图片上传草稿保存
- 真机网络异常提示优化
- 学生端微信授权登录
- 更精细的批改结果可视化

## 相关文件

- 根项目说明：`../README.md`
- 开发文档：`../docs/DEVELOPMENT.md`
- API 文档：`../docs/API.md`
