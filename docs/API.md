# API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3000/api` (开发环境)
- **全局前缀**: `/api`
- **认证方式**: JWT Bearer Token
- **API 版本**: v1.0

## API 版本控制策略

### 版本号格式

API 遵循语义化版本控制 (SemVer)：`v{major}.{minor}.{patch}`

- **Major (主版本)**: 不兼容的 API 变更
- **Minor (次版本)**: 向后兼容的功能新增
- **Patch (补丁版本)**: 向后兼容的问题修复

### 当前版本

- **v1.0** (当前稳定版本)

### 版本支持策略

| 版本 | 发布日期 | 支持状态 | 支持截止日期 |
|-----|---------|---------|-------------|
| v1.0 | 2024-01 | 稳定版 | 长期支持 |

### 升级指南

当 API 进行重大更新时：

1. **废弃通知**: 旧版本将在新版本发布后继续支持 6 个月
2. **迁移文档**: 每次重大更新将提供详细的迁移指南
3. **兼容性检查**: 使用响应头 `X-API-Version` 查看当前 API 版本

### 版本响应头

每个 API 响应包含以下版本信息头：

```
X-API-Version: 1.0.0
X-API-Deprecated: false (or true if deprecated)
X-API-Sunset: 2025-01-01 (if deprecated, shows sunset date)
```

## 认证方式

所有 API 请求需要在 Header 中携带 JWT Token：

```
Authorization: Bearer <token>
```

### 登录

```
POST /api/auth/login
```

**请求体**:
```json
{
  "account": "admin",
  "password": "Test1234"
}
```

**响应**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cml7qfvpu000056n5hhqxidt9",
    "role": "ADMIN",
    "name": "Admin",
    "account": "admin"
  }
}
```

### 注册

```
POST /api/auth/register
```

**请求体**:
```json
{
  "account": "newuser",
  "password": "Password123",
  "name": "New User"
}
```

**说明**: 注册接口不接受 `role` 字段，新注册用户默认为 STUDENT 角色。密码要求至少 8 位，且包含字母和数字。

### 获取当前用户

```
GET /api/auth/me
Authorization: Bearer <token>
```

### 登出

```
POST /api/auth/logout
Authorization: Bearer <token>
```

**说明**: 登出后 Token 会被加入黑名单，无法再次使用。

### 修改密码

```
POST /api/auth/change-password
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "oldPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

### 忘记密码（发送重置验证码）

```
POST /api/auth/forgot-password
```

**请求体**:
```json
{
  "email": "user@example.com"
}
```

**限流**: 10 分钟内最多 3 次

### 重置密码（使用验证码）

```
POST /api/auth/reset-password
```

**请求体**:
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewPass789"
}
```

**限流**: 10 分钟内最多 5 次

### 导出个人数据

```
GET /api/auth/export-my-data
Authorization: Bearer <token>
```

**Response**: JSON 文件（包含用户个人信息与相关数据）

---

## 作业管理 (Homeworks)

### 创建作业

- **POST** `/api/homeworks`
- **角色**: TEACHER
- **Body**: `{ title, description, dueDate, classId }`

**请求体**:
```json
{
  "title": "英语作文",
  "content": "写一篇关于我的假期的作文",
  "classId": "class-id",
  "dueDate": "2026-02-10T23:59:59Z"
}
```

### 获取学生作业列表

```
GET /api/homeworks/student
Authorization: Bearer <token>
```

### 获取班级作业列表 (教师/管理员)

```
GET /api/homeworks?classId=<classId>
Authorization: Bearer <token>
```

**角色**: TEACHER/STUDENT
**Query**: `{ classId, status }`

### 获取作业详情

```
GET /api/homeworks/:id
```

---

## 提交管理 (Submissions)

### 创建提交 (学生)

```
POST /api/submissions
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**角色**: STUDENT

**请求体**:
```
homeworkId: <homework-id>
images: <file1> (最多3张)
images: <file2>
images: <file3>
```

**响应**:
```json
{
  "id": "submission-id",
  "status": "QUEUED",
  "homeworkId": "homework-id",
  "studentId": "student-id"
}
```

### 获取提交列表

```
GET /api/submissions
Authorization: Bearer <token>
```

**角色**: STUDENT
**Query**: `{ status, page, limit }`

### 获取提交详情

```
GET /api/submissions/:id
Authorization: Bearer <token>
```

**角色**: STUDENT/TEACHER/ADMIN

**响应**:
```json
{
  "id": "submission-id",
  "status": "DONE",
  "images": [
    {
      "id": "image-id",
      "url": "https://example.com/presigned-url"
    }
  ],
  "student": {
    "id": "student-id",
    "name": "张三",
    "account": "student01"
  },
  "homework": {
    "id": "homework-id",
    "title": "英语作文"
  },
  "ocrText": "recognized text...",
  "totalScore": 85,
  "gradingJson": {
    "totalScore": 85,
    "dimensionScores": {
      "grammar": 18,
      "vocabulary": 17,
      "structure": 16,
      "content": 17,
      "coherence": 17
    },
    "errors": [
      {
        "type": "grammar",
        "message": "动词时态错误",
        "original": "I go to park yesterday",
        "suggestion": "I went to the park yesterday"
      }
    ],
    "suggestions": {
      "low": ["修正过去时使用"],
      "mid": ["增加连接词提升连贯性"],
      "high": ["扩展细节描写增强内容表达"],
      "rewrite": "Yesterday I went to the park and enjoyed...",
      "sampleEssay": "Last weekend, I went to..."
    },
    "summary": "这是一篇结构清晰的作文...",
    "nextSteps": ["复习一般过去时", "继续练习段落衔接"]
  },
  "errorCode": null,
  "errorMsg": null,
  "teacherComment": "继续保持",
  "manualScore": 88,
  "reviewedBy": "teacher-id",
  "reviewedAt": "2026-02-04T14:20:00Z",
  "createdAt": "2026-02-04T14:00:00Z",
  "updatedAt": "2026-02-04T14:20:00Z"
}
```

### 重新批改

```
POST /api/submissions/:id/regrade
Authorization: Bearer <token>
```

**角色**: STUDENT/TEACHER/ADMIN

---

## 教师评分设置 (Teacher Settings)

### 获取评分设置

```
GET /api/teacher/settings/grading
Authorization: Bearer <token>
```

### 获取评分策略摘要

```
GET /api/teacher/settings/grading/policies?classId=<classId>&homeworkId=<homeworkId>
Authorization: Bearer <token>
```

### 获取评分策略预览

```
GET /api/teacher/settings/grading/policies/preview?classId=<classId>
Authorization: Bearer <token>
```

### 设置班级评分策略

```
PUT /api/teacher/settings/grading/policies/class/:classId
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "mode": "quality",
  "needRewrite": true
}
```

### 设置作业评分策略

```
PUT /api/teacher/settings/grading/policies/homework/:homeworkId
Authorization: Bearer <token>
```

### 清除班级/作业评分策略

```
DELETE /api/teacher/settings/grading/policies/class/:classId
DELETE /api/teacher/settings/grading/policies/homework/:homeworkId
Authorization: Bearer <token>
```

---

## 批量上传 (Teacher)

### 批量上传提交

```
POST /api/teacher/submissions/batch
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**角色**: TEACHER/ADMIN

**文件字段**:
- `images`：最多 100 张图片
- `archive`：可选 ZIP 压缩包（最多 1 个）

**表单字段**:
- `homeworkId`
- `mode?`: `cheap | quality`
- `needRewrite?`: `true | false`
- `mappingOverrides?`: JSON 字符串（`fileKey -> account`）
- `nameOverrides?`: JSON 字符串（`fileKey -> studentName`）
- `excludedFileKeys?`: 逗号分隔或 JSON 字符串

**语义说明**:
- 同一学生在同一批次命中的多张图片，会聚合到 **同一个 submission**。
- `createdSubmissions` 表示实际创建的提交数，不等于图片数。

### 预览批量上传

```
POST /api/teacher/submissions/batch
Authorization: Bearer <token>
```

**角色**: TEACHER/ADMIN

**表单字段补充**:
- `dryRun=true`

### 获取批次列表 / 批次详情

```
GET /api/teacher/submissions/batches?homeworkId=<homeworkId>
GET /api/teacher/submissions/batches/:batchId
Authorization: Bearer <token>
```

### 重试批次内失败提交

```
POST /api/teacher/submissions/batches/:batchId/retry
Authorization: Bearer <token>
```

### 补录跳过图片

```
POST /api/teacher/submissions/retry-skipped
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "homeworkId": "homework-id",
  "fileKey": "image:0:page-2.jpg",
  "filename": "page-2.jpg",
  "studentName": "张三",
  "batchId": "batch-id"
}
```

**语义说明**:
- 如果该学生在当前批次中已经存在 submission，系统会优先把补录图片并入该 submission。
- 如果已有 submission 处于 `DONE` 或 `FAILED`，系统会在并图后重新入队。
- 如果已有 submission 仍处于 `PROCESSING`，接口会拒绝补录，避免与正在运行的 Worker 冲突。

---

## 班级管理 (Classes)

### 创建班级 (教师/管理员)

```
POST /api/classes
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "name": "三年级1班",
  "grade": "三年级"
}
```

### 获取班级列表

```
GET /api/classes
Authorization: Bearer <token>
```

### 导入学生 (教师/管理员)

```
POST /api/classes/:id/students/import
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "students": [
    {
      "account": "student01",
      "name": "张三",
      "password": "Test1234"
    }
  ]
}
```

---

## 导出功能

### 导出 PDF 批改单

```
GET /api/teacher/submissions/pdf?homeworkId=<homeworkId>&submissionIds=<id1,id2>&lang=zh-CN
Authorization: Bearer <token>
```

**角色**: TEACHER/ADMIN
**Response**: PDF 文件

### 导出 CSV

```
GET /api/teacher/submissions/export?homeworkId=<homeworkId>&lang=zh-CN
Authorization: Bearer <token>
```

**角色**: TEACHER/ADMIN
**Response**: CSV 文件

### 导出图片包

```
GET /api/teacher/submissions/images?homeworkId=<homeworkId>
Authorization: Bearer <token>
```

**角色**: TEACHER/ADMIN
**Response**: ZIP 文件

### 导出催交提醒 CSV

```
GET /api/teacher/submissions/reminders?homeworkId=<homeworkId>&lang=zh-CN
Authorization: Bearer <token>
```

**角色**: TEACHER/ADMIN
**Response**: CSV 文件

---

## 报告模块 (Reports)

### 班级概览报表

```
GET /api/teacher/reports/class/:classId/overview?days=7&topN=5
Authorization: Bearer <token>
```

### 导出班级报表 (CSV)

```
GET /api/teacher/reports/class/:classId/export?days=7
Authorization: Bearer <token>
```

### 导出班级报表 (PDF)

```
GET /api/teacher/reports/class/:classId/pdf?days=7
Authorization: Bearer <token>
```

### 学生概览报表

```
GET /api/teacher/reports/student/:studentId/overview?days=7
Authorization: Bearer <token>
```

### 导出学生报表 (PDF)

```
GET /api/teacher/reports/student/:studentId/pdf?days=7
Authorization: Bearer <token>
```

### 学生自助报表概览

```
GET /api/student/reports/overview?days=7
Authorization: Bearer <token>
```

### 学生班级对比

```
GET /api/student/reports/class-comparison?days=7
Authorization: Bearer <token>
```

### 学生自助报表 PDF

```
GET /api/student/reports/pdf?days=7
Authorization: Bearer <token>
```

---

## 管理员功能

所有管理员接口均需要 `ADMIN` 角色。

### 系统指标概览

```
GET /api/admin/metrics
Authorization: Bearer <token>
```

### 用量统计

```
GET /api/admin/usage?days=7
Authorization: Bearer <token>
```

### 健康检查（各外部服务）

```
GET /api/admin/health/llm
GET /api/admin/health/ocr
GET /api/admin/health/storage
GET /api/admin/health/email
GET /api/admin/health/redis
Authorization: Bearer <token>
```

### 系统信息

```
GET /api/admin/system-info
Authorization: Bearer <token>
```

### 错误趋势

```
GET /api/admin/error-trends?days=7
Authorization: Bearer <token>
```

---

### 用户管理

```
GET  /api/admin/users?page=1&limit=20&role=STUDENT&search=keyword
POST /api/admin/users
PATCH /api/admin/users/:id
DELETE /api/admin/users/:id
POST /api/admin/users/:id/reset-password
GET  /api/admin/users/export
Authorization: Bearer <token>
```

### 批量用户操作

```
POST /api/admin/users/bulk-import
POST /api/admin/users/bulk-disable
POST /api/admin/users/bulk-reset-password
Authorization: Bearer <token>
```

### 班级概况

```
GET /api/admin/classes/summary
Authorization: Bearer <token>
```

---

### 手动触发数据清理

```
POST /api/admin/retention/run
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "dryRun": false,
  "days": 7,
  "batchSize": 200
}
```

### 获取系统配置

```
GET /api/admin/config
Authorization: Bearer <token>
```

### 更新系统配置

```
PUT /api/admin/config
Authorization: Bearer <token>
```

**请求体**: 结构化配置对象（`UpdateSystemConfigDto`），可同时更新 `llm`、`providers`、`ocr`、`budget` 等配置。

### 功能开关管理

```
GET /api/admin/feature-flags
PATCH /api/admin/feature-flags
Authorization: Bearer <token>
```

### 测试 LLM

```
POST /api/admin/llm/test
Authorization: Bearer <token>
```

### 测试 OCR

```
POST /api/admin/ocr/test
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**文件字段**: `image`（最大 10MB）

### LLM 调用日志

```
GET /api/admin/llm/logs?page=1&limit=20
DELETE /api/admin/llm/logs
Authorization: Bearer <token>
```

### LLM 成本摘要

```
GET /api/admin/llm/cost-summary?days=7
Authorization: Bearer <token>
```

### 审计日志

```
GET /api/admin/audit-logs?page=1&limit=20
Authorization: Bearer <token>
```

### 获取提交诊断

```
GET /api/admin/submissions/:id/diagnosis
Authorization: Bearer <token>
```

**说明**: 返回提交基本信息、OCR 输出、评分 JSON、LLM 调用日志与流水线状态。

---

## 公共接口 (Public)

### 系统概览

```
GET /api/public/overview?days=7
权限: 公开
```

**限流**: 60 秒内最多 20 次

### 着陆页数据

```
GET /api/public/landing?days=7
权限: 公开
```

**限流**: 60 秒内最多 10 次

### 功能开关（公共）

```
GET /api/public/feature-flags
权限: 公开
```

**限流**: 60 秒内最多 30 次

---

## 队列管理

### 获取队列指标

```
GET /api/admin/queue/metrics?status=<status>
Authorization: Bearer <token>
```

### 重试失败任务 / 清理队列 / 暂停与恢复

```
POST /api/admin/queue/retry-failed
POST /api/admin/queue/clean
POST /api/admin/queue/pause
POST /api/admin/queue/resume
Authorization: Bearer <token>
```

**说明**: 队列管理能力位于管理员命名空间下，不存在公共的 `/api/queue/status` 接口。

---

## 错误码

### HTTP状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 业务错误码

| 错误码 | 说明 |
|--------|------|
| OCR_EMPTY | OCR识别结果为空 |
| OCR_TIMEOUT | OCR识别超时 |
| OCR_ERROR | OCR识别错误 |
| LLM_TIMEOUT | LLM请求超时 |
| LLM_SCHEMA_INVALID | LLM响应JSON格式错误 |
| LLM_API_ERROR | LLM API错误 |
| LLM_QUOTA_EXCEEDED | LLM调用配额超限 |
| MAX_RETRIES_EXCEEDED | 最大重试次数超限 |

---

## 数据模型

### 提交状态 (SubmissionStatus)

- `QUEUED` - 排队中 / 已入队，等待Worker处理
- `PROCESSING` - 批改中 / Worker正在处理
- `DONE` - 完成 / 处理成功
- `FAILED` - 失败 / 处理失败

### 用户角色 (Role)

- `ADMIN` - 管理员
- `TEACHER` - 教师
- `STUDENT` - 学生

### 错误类型 (ErrorType)

- `GRAMMAR` - 语法
- `VOCABULARY` - 词汇
- `SPELLING` - 拼写
- `PUNCTUATION` - 标点
- `STRUCTURE` - 结构
- `CONTENT` - 内容

---

## 示例

### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"Test1234"}'
```

### 创建提交

```bash
curl -X POST http://localhost:3000/api/submissions \
  -H "Authorization: Bearer <token>" \
  -F "homeworkId=<homework-id>" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

### 获取提交详情

```bash
curl -X GET http://localhost:3000/api/submissions/<id> \
  -H "Authorization: Bearer <token>"
```
