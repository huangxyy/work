# API 接口文档

## 认证方式

所有 API 请求需要在 Header 中携带 JWT Token：

```
Authorization: Bearer <token>
```

## 基础 URL

```
开发环境: http://localhost:3008/api
生产环境: https://your-domain.com/api
```

## 接口列表

### 认证模块 (Auth)

#### 注册
- **POST** `/api/auth/register`
- **Body**: `{ account, password, name, role }`
- **Response**: 用户信息

#### 登录
- **POST** `/api/auth/login`
- **Body**: `{ account, password }`
- **Response**: `{ token, user }`

#### 获取当前用户
- **GET** `/api/auth/me`
- **Response**: 用户信息

### 作业模块 (Homeworks)

#### 创建作业
- **POST** `/api/homeworks`
- **角色**: TEACHER
- **Body**: `{ title, description, dueDate, classId }`

#### 获取作业列表
- **GET** `/api/homeworks`
- **角色**: TEACHER/STUDENT
- **Query**: `{ classId, status }`

#### 获取作业详情
- **GET** `/api/homeworks/:id`

### 提交模块 (Submissions)

#### 创建提交
- **POST** `/api/submissions`
- **角色**: STUDENT
- **Content-Type**: `multipart/form-data`
- **Body**: `{ homeworkId }`
- **Files**: `images[]` (1-3 张图片，每张最大 10MB)

#### 获取提交列表
- **GET** `/api/submissions`
- **角色**: STUDENT
- **Query**: `{ status, page, limit }`

#### 获取提交详情
- **GET** `/api/submissions/:id`
- **角色**: STUDENT/TEACHER/ADMIN

#### 重新批改
- **POST** `/api/submissions/:id/regrade`
- **角色**: TEACHER/STUDENT

### 批量上传 (Teacher)

#### 批量上传提交
- **POST** `/api/teacher/submissions/upload`
- **角色**: TEACHER
- **Content-Type**: `multipart/form-data`
- **Files**: `zip` (包含学生图片的压缩包)

#### 预览批量上传
- **POST** `/api/teacher/submissions/preview`
- **角色**: TEACHER

### 导出功能

#### 导出 PDF 批改单
- **GET** `/api/teacher/homeworks/:id/submissions/pdf`
- **角色**: TEACHER
- **Query**: `{ ids }` (逗号分隔的提交ID)
- **Response**: PDF 文件

#### 导出 CSV
- **GET** `/api/teacher/homeworks/:id/submissions/csv`
- **角色**: TEACHER
- **Response**: CSV 文件

#### 导出图片包
- **GET** `/api/teacher/homeworks/:id/submissions/images`
- **角色**: TEACHER
- **Response**: ZIP 文件

### 报告模块 (Reports)

#### 班级报告概览
- **GET** `/api/teacher/reports`
- **角色**: TEACHER
- **Query**: `{ classId, rangeDays }`

#### 学生报告
- **GET** `/api/teacher/reports/student/:studentId`
- **角色**: TEACHER
- **Query**: `{ rangeDays }`

### 公共接口 (Public)

#### 系统概览
- **GET** `/api/overview`
- **权限**: 公开

#### 着陆页数据
- **GET** `/api/landing`
- **权限**: 公开

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
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

## 数据模型

### 提交状态 (SubmissionStatus)

- `QUEUED` - 排队中
- `PROCESSING` - 批改中
- `DONE` - 完成
- `FAILED` - 失败

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

## 示例

### 登录

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"Test1234"}'
```

### 创建提交

```bash
curl -X POST http://localhost/api/submissions \
  -H "Authorization: Bearer <token>" \
  -F "homeworkId=<homework-id>" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

### 获取提交详情

```bash
curl -X GET http://localhost/api/submissions/<id> \
  -H "Authorization: Bearer <token>"
```
