# API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3000/api` (开发环境)
- **全局前缀**: `/api`
- **认证方式**: JWT Bearer Token

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
  "name": "New User",
  "role": "STUDENT"
}
```

### 获取当前用户

```
GET /api/auth/me
Authorization: Bearer <token>
```

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
  "ocrText": "recognized text...",
  "totalScore": 85,
  "gradingJson": {
    "dimensionScores": {
      "grammar": 18,
      "vocabulary": 17,
      "structure": 16,
      "content": 17,
      "coherence": 17
    },
    "totalScore": 85,
    "summary": "这是一篇结构清晰的作文...",
    "suggestions": [
      "建议加强时态的使用",
      "可以增加更多连接词"
    ],
    "grammarErrors": [
      {
        "original": "I go to park yesterday",
        "correction": "I went to the park yesterday",
        "explanation": "过去时间应该用过去时"
      }
    ]
  },
  "createdAt": "2026-02-04T14:00:00Z"
}
```

### 重新批改

```
POST /api/submissions/:id/regrade
Authorization: Bearer <token>
```

**角色**: TEACHER/STUDENT

---

## 批量上传 (Teacher)

### 批量上传提交

```
POST /api/teacher/submissions/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**角色**: TEACHER
**Files**: `zip` (包含学生图片的压缩包)

### 预览批量上传

```
POST /api/teacher/submissions/preview
Authorization: Bearer <token>
```

**角色**: TEACHER

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
GET /api/teacher/homeworks/:id/submissions/pdf
Authorization: Bearer <token>
```

**角色**: TEACHER
**Query**: `{ ids }` (逗号分隔的提交ID)
**Response**: PDF 文件

### 导出 CSV

```
GET /api/teacher/homeworks/:id/submissions/csv
Authorization: Bearer <token>
```

**角色**: TEACHER
**Response**: CSV 文件

### 导出图片包

```
GET /api/teacher/homeworks/:id/submissions/images
Authorization: Bearer <token>
```

**角色**: TEACHER
**Response**: ZIP 文件

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

### 学生概览报表

```
GET /api/teacher/reports/student/:studentId/overview?days=7
Authorization: Bearer <token>
```

### 班级报告概览

```
GET /api/teacher/reports
Authorization: Bearer <token>
```

**角色**: TEACHER
**Query**: `{ classId, rangeDays }`

### 学生报告

```
GET /api/teacher/reports/student/:studentId
Authorization: Bearer <token>
```

**角色**: TEACHER
**Query**: `{ rangeDays }`

---

## 管理员功能

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
PATCH /api/admin/config
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "key": "llm.dailyCallLimit",
  "value": "500"
}
```

---

## 公共接口 (Public)

### 系统概览

```
GET /api/overview
权限: 公开
```

### 着陆页数据

```
GET /api/landing
权限: 公开
```

---

## 队列管理

### 获取队列状态

```
GET /api/queue/status
Authorization: Bearer <token>
```

**响应**:
```json
{
  "waiting": 0,
  "active": 1,
  "completed": 150,
  "failed": 2
}
```

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
