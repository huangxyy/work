# AI 批改能力矩阵（文档 vs 实现）

最后更新：2026-03-09

## 目的

本文档用于对照当前项目文档与实际实现，识别：

- 已实现且文档准确的能力
- 已实现但文档过期或描述不完整的能力
- 已实现但曾存在关键行为偏差、现已修复的能力
- 后续仍建议补强的测试与文档项

## 状态说明

- `已实现`：代码与前端/接口均已具备，主路径可用
- `已实现（文档漂移）`：代码已具备，但现有文档路由、返回结构或语义不准确
- `已修复`：此前存在真实行为问题，当前已修复并补了回归验证
- `待补强`：不属于主功能缺失，但仍建议继续完善

## 能力矩阵

| 能力项 | 文档现状 | 实现状态 | 实现证据 | 结论 |
|------|------|------|------|------|
| 学生上传作文图片并触发 AI 批改 | README / PROJECT_OVERVIEW / API 已覆盖主链路 | 已实现 | `POST /api/submissions`，Worker 执行 OCR + LLM | 主链路完整 |
| 学生查看 OCR、总分、评分 JSON、教师反馈 | API 文档已更新 | 已实现 | `GET /api/submissions/:id`，前端 `student/SubmissionResult.tsx` | 文档响应结构已对齐 |
| AI 评分结果结构校验 | 文档只描述高层能力 | 已实现 | `grading/utils/schema-validate.ts` | 文档缺少严格 schema 说明 |
| 总分必须等于分项和 | 现有文档未强调 | 已修复 | `validateTotalScoreConsistency` + `grading.service.spec.ts` | 已补跨字段校验 |
| 教师批量上传图片/ZIP | API 文档已修正 | 已实现 | 实际接口 `POST /api/teacher/submissions/batch` | API 文档已使用真实路由 |
| 同一学生多页作文聚合为一个 submission | 旧文档未明确语义 | 已修复 | `createBatchSubmissions` 已按学生聚合，`submissions.service.spec.ts` 覆盖 | 这是关键业务语义 |
| 批量上传 dry-run 预览 | API 文档已修正 | 已实现 | 实际为同一路由 `POST /api/teacher/submissions/batch` + `dryRun=true` | 文档已更正 |
| `retrySkipped` 手动补录 | API 文档已补充请求体与语义 | 已实现 | `POST /api/teacher/submissions/retry-skipped` | 文档已明确请求体与行为 |
| `retrySkipped` 优先并入原批次 submission | 旧文档未说明 | 已修复 | `retrySkippedSubmission` + service 单测 | 避免再次拆单 |
| `retrySkipped` 命中 `PROCESSING` 时拒绝并入 | 旧文档未说明 | 已修复 | `retrySkippedSubmission` + service 单测 | 避免与 Worker 竞争写入 |
| 批次详情、批次列表、整批重试 | API 文档已覆盖 | 已实现 | `/teacher/submissions/batches`、`/batches/:batchId`、`/batches/:batchId/retry` | 文档已覆盖 |
| 教师评分策略（class/homework 级） | API 文档已覆盖 | 已实现 | `/teacher/settings/grading`、`/grading/policies*` | 文档已覆盖 |
| 教师导出作业 CSV / PDF / 图片 / reminders | API 文档已修正 | 已实现 | `/teacher/submissions/export|pdf|images|reminders` | API 文档已使用真实路由 |
| 教师/管理员报表（class/student overview & pdf） | API 文档已覆盖 | 已实现 | `reports.controller.ts`、`student-reports.controller.ts` | 包含学生自助报表接口 |
| 管理员系统配置 | API 文档已修正 | 已实现 | 真实接口 `GET/PUT /api/admin/config` | 文档已使用 `PUT` |
| 管理员队列管理 | API 文档已修正 | 已实现 | 真实接口 `/api/admin/queue/*` | 文档已使用真实路由 |
| 管理员提交诊断、LLM 日志、OCR/LLM 测试 | API 文档已全面覆盖 | 已实现 | `admin.controller.ts` 中 `diagnosis` / `llm/logs` / `ocr/test` / `llm/test` | 包含成本摘要、审计日志等 |
| 批量上传进度展示 | 文档无前端口径说明 | 已修复 | 前端现按 `createdSubmissions` 计算进度 | 避免老师误判完成率 |
| 维度雷达图量纲 | 文档无说明 | 已修复 | 前端现按 20 分制展示 | 避免图表失真 |

## 真实路由对照（高频漂移项）

### 1. 教师批量上传

- 旧文档写法
  - `POST /api/teacher/submissions/upload`
  - `POST /api/teacher/submissions/preview`

- 真实实现
  - `POST /api/teacher/submissions/batch`
  - 预览通过同一路由传 `dryRun=true`

### 2. 教师导出接口

- 旧文档写法
  - `/api/teacher/homeworks/:id/submissions/pdf`
  - `/api/teacher/homeworks/:id/submissions/csv`
  - `/api/teacher/homeworks/:id/submissions/images`

- 真实实现
  - `GET /api/teacher/submissions/pdf?homeworkId=...&submissionIds=...`
  - `GET /api/teacher/submissions/export?homeworkId=...`
  - `GET /api/teacher/submissions/images?homeworkId=...`
  - `GET /api/teacher/submissions/reminders?homeworkId=...`

### 3. 管理员配置与队列

- 旧文档写法
  - `PATCH /api/admin/config`
  - `GET /api/queue/status`

- 真实实现
  - `PUT /api/admin/config`
  - `GET /api/admin/queue/metrics`
  - `POST /api/admin/queue/retry-failed`
  - `POST /api/admin/queue/clean`
  - `POST /api/admin/queue/pause`
  - `POST /api/admin/queue/resume`

### 4. 管理员诊断能力

- 真实实现
  - `GET /api/admin/submissions/:id/diagnosis`
  - `GET /api/admin/llm/logs`
  - `DELETE /api/admin/llm/logs`
  - `POST /api/admin/ocr/test`
  - `POST /api/admin/llm/test`

## 关键业务语义（应被文档明确写出）

### 多页作文聚合

- 同一学生在同一次批量上传中命中的多张图片，应被视为同一篇作文的多页。
- 系统应创建一个 `Submission`，并把多张图片都挂到该 `Submission` 下。
- `createdSubmissions` 反映的是实际提交数，而不是图片数。

### `retrySkipped` 并入策略

- 如果该学生在当前批次已有 submission，优先并入该 submission。
- 如果已有 submission 状态为 `DONE` 或 `FAILED`，并图后重新入队。
- 如果已有 submission 状态为 `PROCESSING`，拒绝补录，提示稍后重试。

### 评分结果一致性

- `gradingJson.totalScore` 必须等于主维度分数和：
  - `grammar`
  - `vocabulary`
  - `structure`
  - `content`
  - `coherence`

## 本轮已完成的高价值修复

- 批量上传按学生聚合，避免多页作文拆单
- `retrySkipped` 优先并入原批次 submission，避免重复 submission
- `retrySkipped` 对 `PROCESSING` 提交加保护
- 前端批次进度改按 `createdSubmissions` 计算
- 前端评分维度图改回 20 分制
- 增加评分结果总分一致性校验
- 补充相关 service 与 controller 级回归测试

## 本轮文档加固（2026-03-09）

- API.md 全面修正：公共接口路由前缀 `/public/`、注册 DTO 去除不存在的 `role` 字段
- API.md 补充 30+ 条未记录的管理员端点（用户管理、健康检查、功能开关、审计日志等）
- API.md 补充缺失的认证端点（登出、改密、忘记密码、重置密码、导出个人数据）
- README.md 更新项目结构（新增 wechat-miniapp）、Node.js 版本、文档索引
- PROJECT_OVERVIEW.md 更新目录结构、管理员权限描述、启动命令、文档索引
- CI 流水线新增依赖漏洞扫描和前端测试步骤
- 后端 Jest 配置新增覆盖率门槛（statements/lines 50%, branches/functions 40%）
- 前端测试基础设施搭建（Vitest + Testing Library + 3 组核心 utility 测试）
- 健康检查增强：新增队列深度指标
- 监控告警规则：新增 CPU/内存/磁盘/MySQL/Redis/API 告警

## 后续建议

### 优先级高

- 补充批量上传接口的完整请求/响应示例
- 补充管理员诊断接口返回字段示例
- 前端测试覆盖率持续提升（组件级测试）

### 优先级中

- 补控制器级更多导出接口测试
- 补报表接口的契约测试
- Sentry 错误追踪集成（需要 DSN）
- Playwright E2E 测试（独立迭代）
