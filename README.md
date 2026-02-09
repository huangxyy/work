# Homework AI - 英语作文智能批改系统

基于 AI 的英语作文批改系统，支持学生上传手写作文图片，自动进行 OCR 识别和 AI 批改。

## 功能特点

- **多角色系统**：支持学生、教师、管理员三种角色
- **手写作文识别**：集成百度 OCR，支持手写英文识别
- **AI 智能批改**：使用 DeepSeek LLM 进行作文批改
- **批量上传**：教师可批量上传学生作文图片
- **跳过文件重试**：支持对无法识别的文件进行手动指定学生并重新批改
- **实时批改**：基于 BullMQ 的异步批改队列
- **数据导出**：支持 PDF、CSV 格式的报告导出
- **中英双语**：完整的中英文界面支持

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 5
- Ant Design Pro 5
- React Router 6
- React Query (TanStack Query)
- ECharts 5

### 后端
- NestJS 10
- Prisma 5
- MySQL 8
- Redis 7 + BullMQ
- Passport JWT 认证
- MinIO 对象存储

### AI 服务
- 百度 OCR：手写文字识别
- DeepSeek LLM：作文批改

## 项目结构

```
work/
├── apps/
│   ├── frontend/          # React 前端应用
│   └── backend/           # NestJS 后端 API
├── deploy/                # Docker 部署配置
├── docs/                  # 项目文档
└── scripts/               # 工具脚本
```

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- MySQL 8
- Redis 7

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

1. **启动 Docker 服务**（MySQL、Redis、MinIO）

```bash
cd deploy
docker-compose up -d mysql redis minio
```

2. **数据库迁移**

```bash
cd apps/backend
npx prisma migrate dev
npx prisma db seed  # 创建测试数据
```

3. **启动后端 API 服务**

```bash
pnpm dev:backend
```

服务运行在 `http://localhost:3000`

4. **启动前端开发服务器**

```bash
pnpm dev:frontend
```

服务运行在 `http://localhost:3001`

5. **启动 Worker 进程**（用于批改任务）

```bash
pnpm dev:worker
```

### 默认测试账号

| 角色   | 账号      | 密码      |
| ------ | --------- | --------- |
| 管理员 | admin     | Test1234  |
| 教师   | teacher01 | Test1234  |
| 学生   | student01 | Test1234  |

## 开发命令

```bash
# 根目录
pnpm dev:frontend    # 前端开发服务器
pnpm dev:backend     # 后端 API 服务器
pnpm dev:worker      # 后台 Worker 进程
pnpm build           # 构建所有应用
pnpm lint            # 代码检查
pnpm typecheck       # 类型检查
pnpm test            # 运行测试
pnpm test:cov        # 测试覆盖率

# 后端
cd apps/backend
pnpm start:dev       # API 服务（热重载）
pnpm start:worker:dev # Worker 进程
pnpm prisma:generate # 生成 Prisma Client
pnpm prisma:migrate  # 运行数据库迁移

# 前端
cd apps/frontend
pnpm dev             # 开发服务器
pnpm build           # 构建生产版本
pnpm preview         # 预览构建结果
```

## 批改流程

```
学生上传图片
    ↓
API保存提交 (状态: QUEUED)
    ↓
入队BullMQ (grading 队列)
    ↓
Worker处理任务:
    1. 百度OCR识别文字 → submission.ocrText
    2. DeepSeek LLM批改 → submission.gradingJson
    3. 计算总分 → submission.totalScore
    ↓
保存结果 (状态: DONE / FAILED)
```

## 配置说明

主要环境变量（见 `apps/backend/.env`）：

| 变量名 | 说明 |
| ------ | ---- |
| `DATABASE_URL` | MySQL 连接字符串 |
| `REDIS_URL` | Redis 连接字符串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `BAIDU_OCR_API_KEY` | 百度 OCR API Key |
| `BAIDU_OCR_SECRET_KEY` | 百度 OCR Secret Key |
| `LLM_API_KEY` | DeepSeek API Key |
| `LLM_BASE_URL` | DeepSeek API 地址 |
| `LLM_MODEL` | 使用的模型名称 |
| `LLM_MAX_TOKENS` | 最大 Token 数（建议 2000+） |
| `MINIO_ENDPOINT` | MinIO 服务地址 |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 |
| `MINIO_SECRET_KEY` | MinIO 秘密密钥 |
| `WORKER_CONCURRENCY` | Worker 并发数 |
| `RETENTION_DAYS` | 数据保留天数 |

## 常见问题

### 提交一直处于 QUEUED 状态

确保 Worker 进程正在运行：

```bash
pnpm dev:worker
```

### 批改失败，提示 MAX_RETRIES_EXCEEDED

检查 `LLM_MAX_TOKENS` 配置是否足够大（建议 2000+）。

### Docker 服务无法启动

```bash
# 检查 Docker 状态
docker ps

# 查看日志
docker-compose logs mysql redis minio
```

### 端口被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <进程ID>

# 或使用 PowerShell
Stop-Process -Id <进程ID> -Force
```

## 文档

- [开发指南](./CLAUDE.md) - 详细的开发文档和架构说明
- [API 文档](./docs/API.md) - API 接口文档
- [部署文档](./docs/DEPLOY.md) - 部署指南

## 许可证

MIT
