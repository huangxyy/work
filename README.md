# Homework AI - AI英语作文批改系统

面向"作业图片 -> OCR -> LLM 批改"的全链路系统，支持学生提交手写作业图片，自动完成文字识别和AI批改评分。

## 功能特性

- **多角色权限系统**：学生、教师、管理员三种角色
- **作业管理**：教师创建作业、班级管理、学生导入
- **图片提交**：学生支持1-3张作业图片上传
- **OCR识别**：百度OCR文字识别
- **AI批改**：DeepSeek LLM智能评分与建议
- **异步处理**：BullMQ队列处理批改任务
- **报表导出**：班级/学生报表、CSV导出

## 目录结构

```
apps/
├── backend/           # NestJS API + BullMQ Worker
│   ├── prisma/        # 数据库模型与迁移
│   ├── src/
│   │   ├── admin/     # 管理员功能
│   │   ├── auth/      # JWT认证
│   │   ├── classes/   # 班级管理
│   │   ├── grading/   # AI批改服务
│   │   ├── homeworks/ # 作业管理
│   │   ├── ocr/       # 百度OCR服务
│   │   ├── queue/     # BullMQ队列
│   │   ├── reports/   # 报表服务
│   │   ├── retention/ # 数据清理
│   │   ├── storage/   # MinIO对象存储
│   │   ├── submissions/ # 提交管理
│   │   ├── worker/    # 后台Worker进程
│   │   └── main.ts    # API入口
│   └── .env           # 环境配置
├── frontend/          # Vite + React + Ant Design
└── deploy/            # Docker Compose配置
docs/                  # 项目文档
```

## 技术栈

- **Monorepo**: pnpm workspaces
- **后端**: NestJS、Prisma、MySQL、Redis、BullMQ、JWT
- **前端**: React 18、Vite、TypeScript、Ant Design、React Router、React Query
- **OCR**: 百度OCR API
- **LLM**: DeepSeek API (OpenAI兼容)
- **存储**: MinIO (S3兼容)
- **代理**: Nginx

## 本地开发

### 前置要求

- Node.js 18+
- pnpm
- Docker & Docker Compose

### 1. 启动依赖服务

```bash
cd deploy
docker-compose up -d
```

这将启动：MySQL、Redis、MinIO、Nginx

### 2. 配置后端环境变量

```bash
cd apps/backend
cp .env.example .env
```

编辑 `.env` 文件，配置：
- `DATABASE_URL`: MySQL连接字符串
- `REDIS_URL`: Redis连接字符串
- `BAIDU_OCR_API_KEY`: 百度OCR API密钥
- `BAIDU_OCR_SECRET_KEY`: 百度OCR密钥
- `LLM_API_KEY`: DeepSeek API密钥
- `LLM_BASE_URL`: DeepSeek API地址
- `LLM_MAX_TOKENS`: 建议2000（太小会导致JSON截断）

### 3. 初始化数据库

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:db:push
pnpm --filter backend prisma:db:seed
```

### 4. 启动后端服务

**重要：需要启动两个独立进程**

启动API服务器（终端1）：
```bash
cd apps/backend
npm run start:dev
# 或执行 start-api.bat
```

启动Worker进程（终端2）：
```bash
cd apps/backend
npm run start:worker:dev
# 或执行 start-worker.bat
```

### 5. 启动前端

```bash
cd apps/frontend
npm run dev
```

### 6. 访问应用

- **前端**: http://localhost/
- **API**: http://localhost/api/*
- **MinIO控制台**: http://localhost:9001

### 快速启动（推荐）

双击运行根目录的 `start-all.bat` 即可一键启动所有服务。

### 默认测试账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | Test1234 |
| 教师 | teacher01 | Test1234 |
| 学生 | student01 | Test1234 |

## 批改流程

```
学生上传图片
    ↓
API保存提交 (状态: QUEUED)
    ↓
入队BullMQ
    ↓
Worker处理任务
    ↓
百度OCR识别
    ↓
DeepSeek LLM批改
    ↓
保存结果 (状态: DONE / FAILED)
```

## 环境变量说明

### 后端 (.env)

```bash
# 数据库
DATABASE_URL=mysql://root:root@localhost:3306/homework_ai

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# MinIO存储
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=submissions

# 百度OCR
BAIDU_OCR_API_KEY=your-api-key
BAIDU_OCR_SECRET_KEY=your-secret-key

# DeepSeek LLM
LLM_PROVIDER=deepseek
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.2
LLM_MAX_INPUT_CHARS=6000
LLM_DAILY_CALL_LIMIT=400

# Worker
WORKER_CONCURRENCY=5

# 数据保留
RETENTION_DAYS=7
RETENTION_DRY_RUN=false
```

### 前端 (.env)

```bash
VITE_API_BASE_URL=/api
```

## 常见问题

### 1. 提交后状态一直是QUEUED

**原因**: Worker进程没有运行

**解决**: 确保启动了Worker进程 (`npm run start:worker:dev`)

### 2. 批改失败，显示MAX_RETRIES_EXCEEDED

**原因**: `LLM_MAX_TOKENS` 设置太小，导致AI响应JSON被截断

**解决**: 将 `.env` 中的 `LLM_MAX_TOKENS` 改为 2000，然后重启Worker

### 3. 前端显示502错误

**原因**: 后端API或Worker没有运行

**解决**: 检查并启动API服务器和Worker进程

### 4. 页面一直刷新/无法加载

**原因**: Nginx 代理端口与 Vite 实际端口不匹配

**自动修复**: 双击运行 `scripts\check-ports.bat`

**手动修复**: 检查 `pnpm dev` 显示的端口号，修改 `deploy/nginx/nginx.conf` 中的 `proxy_pass` 端口，然后重启 Nginx。

## Docker部署

### 一键启动（仅依赖服务）

```bash
cd deploy
docker-compose up -d mysql redis minio nginx
```

### 完整部署（包含后端）

```bash
cd deploy
docker-compose up -d --build
```

## 文档

- [项目概览](docs/PROJECT_OVERVIEW.md)
- [架构说明](docs/ARCH.md)
- [运维手册](docs/RUNBOOK.md)
- [API文档](docs/OPENAPI.md)
- [开发路线图](docs/future-roadmap.md)

## 许可

MIT License
