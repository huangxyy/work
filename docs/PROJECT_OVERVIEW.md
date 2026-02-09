# 项目概览（Homework AI）

Last updated: 2026-02-04

## 简介

Homework AI 是一个"作业图片 -> OCR -> LLM 批改"的全链路系统，支持学生提交手写作业图片，自动完成文字识别和AI批改评分。

### 核心特性

- **多角色权限**: 学生、教师、管理员三种角色
- **异步批改**: BullMQ队列处理，支持并发
- **百度OCR**: 高准确率文字识别
- **DeepSeek LLM**: 智能批改与建议
- **数据保留**: 自动清理7天前的数据
- **报表导出**: 班级/学生报表，CSV导出

## 角色与权限

| 角色 | 权限 |
|------|------|
| **STUDENT** | 提交作业、查看自己的提交、查看学生报告 |
| **TEACHER** | 管理班级、创建作业、查看班级提交、查看教师报告 |
| **ADMIN** | 拥有教师权限 + 系统配置、手动数据清理 |

## 技术架构

### 前端

- React 18 + TypeScript
- Vite 构建工具
- Ant Design UI组件库
- React Router 路由
- React Query 状态管理

### 后端

- NestJS 框架
- Prisma ORM
- MySQL 数据库
- Redis + BullMQ 队列
- JWT 认证

### 外部服务

- 百度OCR API
- DeepSeek LLM API
- MinIO 对象存储

## 目录结构

```
apps/
├── backend/               # 后端
│   ├── prisma/           # 数据库模型
│   ├── src/
│   │   ├── admin/        # 管理员功能
│   │   ├── auth/         # JWT认证
│   │   ├── classes/      # 班级管理
│   │   ├── grading/      # AI批改服务
│   │   ├── homeworks/    # 作业管理
│   │   ├── ocr/          # 百度OCR
│   │   ├── queue/        # BullMQ队列
│   │   ├── reports/      # 报表
│   │   ├── retention/    # 数据清理
│   │   ├── storage/      # MinIO存储
│   │   ├── submissions/  # 提交管理
│   │   └── worker/       # 后台Worker
│   └── .env              # 环境配置
├── frontend/             # 前端
└── deploy/               # Docker配置
```

## 批改流程

```
1. 学生上传图片
   ↓
2. API保存提交 (状态: QUEUED)
   ↓
3. 入队BullMQ
   ↓
4. Worker处理任务
   ↓
5. 百度OCR识别
   ↓
6. DeepSeek LLM批改
   ↓
7. 保存结果 (状态: DONE / FAILED)
```

## 提交状态

| 状态 | 说明 |
|------|------|
| QUEUED | 已入队，等待Worker处理 |
| PROCESSING | Worker正在处理 |
| DONE | 处理成功 |
| FAILED | 处理失败 |

## 环境变量

### 关键配置

```bash
# 后端端口
PORT=3000

# 数据库
DATABASE_URL=mysql://root:root@localhost:3306/homework_ai

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# 百度OCR
BAIDU_OCR_API_KEY=your-api-key
BAIDU_OCR_SECRET_KEY=your-secret-key

# DeepSeek LLM
LLM_PROVIDER=deepseek
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_MAX_TOKENS=2000          # 重要：太小会导致JSON截断
LLM_MAX_INPUT_CHARS=6000
LLM_DAILY_CALL_LIMIT=400

# Worker
WORKER_CONCURRENCY=5

# 数据保留
RETENTION_DAYS=7
RUN_RETENTION=true           # 仅API服务器启用
```

## 快速开始

### 1. 启动依赖服务

```bash
cd deploy
docker-compose up -d
```

### 2. 配置环境

```bash
cd apps/backend
cp .env.example .env
# 编辑.env配置API密钥
```

### 3. 初始化数据库

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:db:push
pnpm --filter backend prisma:db:seed
```

### 4. 启动服务

**重要：需要启动两个进程**

终端1 - API服务器：
```bash
cd apps/backend
npm run start:dev
```

终端2 - Worker进程：
```bash
cd apps/backend
npm run start:worker:dev
```

终端3 - 前端：
```bash
cd apps/frontend
npm run dev
```

### 5. 访问应用

- 前端: http://localhost/
- API: http://localhost/api/
- MinIO: http://localhost:9001

### 默认账号

- admin / Test1234
- teacher01 / Test1234
- student01 / Test1234

## 常见问题

### Q: 提交后状态一直是QUEUED？

A: Worker进程没有运行，请检查Worker是否启动。

### Q: 批改失败，显示MAX_RETRIES_EXCEEDED？

A: `LLM_MAX_TOKENS` 设置太小，改为2000后重启Worker。

### Q: 前端显示502？

A: 检查后端API(3000)和前端(3001)是否运行。

## 相关文档

- [README.md](../README.md) - 项目说明
- [QUICK_START.md](QUICK_START.md) - 快速启动指南
- [ARCH.md](ARCH.md) - 架构说明
- [RUNBOOK.md](RUNBOOK.md) - 运维手册
- [API.md](API.md) - API文档
- [future-roadmap.md](future-roadmap.md) - 开发路线图
