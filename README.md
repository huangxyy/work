# Homework AI Monorepo（中文指南）

面向“作业图片 ➜ OCR ➜ LLM 评分”的全链路样板工程，覆盖前后端、异步队列、对象存储与 OCR mock。当前状态为 Phase A 脚手架，可跑通健康检查与队列 demo，后续可按需求逐步扩展。

## 目录结构
- `apps/backend`：NestJS API + BullMQ worker，Prisma 模型与迁移
- `apps/frontend`：Vite + React + Ant Design 前端
- `services/ocr-service`：FastAPI OCR 模拟服务
- `deploy/docker-compose.yml`：一键拉起 MySQL、Redis、MinIO、OCR 与 Nginx（前端静态）
- `docs/`：占位文档

## 技术栈
- Monorepo：pnpm workspaces
- 后端：NestJS、Prisma、MySQL、Redis、BullMQ、JWT（预留）、MinIO/S3 封装（预留）
- 前端：React 18、Vite、TypeScript、Ant Design、React Router、React Query、ECharts（待接入）
- OCR：FastAPI + PaddleOCR 预留，目前为 mock

## 本地开发
前置：Node.js 18+、pnpm、Python 3.11+（如需跑 OCR 服务）

```bash
# 安装依赖（根目录）
pnpm install

# 复制环境变量
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# 生成 Prisma 客户端
pnpm --filter backend prisma:generate

# 可选：初始化测试账号（仅本地）
# 在 apps/backend/.env 中设置 SEED_USERS=true 后执行
pnpm --filter backend exec prisma db seed

# 启动后台 API（需要 MySQL/Redis）
pnpm --filter backend start:dev

# 启动 Worker（监听 BullMQ grading 队列）
pnpm --filter backend start:worker:dev

# 启动前端（开发模式）
pnpm --filter frontend dev
```

## Docker Compose（依赖服务 + Nginx）
默认 compose 只负责依赖服务（MySQL/Redis/MinIO/OCR）和 Nginx 静态服务。后端 API/Worker 建议在宿主机启动，便于本地调试。

```bash
# 1) 启动依赖服务（在仓库根目录）
docker compose -f deploy/docker-compose.yml up -d mysql redis minio ocr-service

# 2) 启动后端（宿主机）
pnpm --filter backend start:dev
pnpm --filter backend start:worker:dev

# 3) 构建前端并用 Nginx 提供静态服务
# 建议设置 VITE_API_BASE_URL=/api 走 Nginx 反代
# Windows CMD: set VITE_API_BASE_URL=/api
# PowerShell:  $env:VITE_API_BASE_URL="/api"
# macOS/Linux: export VITE_API_BASE_URL=/api
pnpm --filter frontend build
docker compose -f deploy/docker-compose.yml up -d nginx
```

访问：
- 前端：`http://localhost/`
- API：`http://localhost/api`
- OCR：`http://localhost:8000`
- MinIO 控制台：`http://localhost:9001`

说明：Nginx 默认反代到宿主机 `http://host.docker.internal:3000`。如果你在 Linux 上运行 Docker，请改为宿主机 IP 或配置 `extra_hosts`。

## 关键功能与现状
- API 健康检查：`GET /api/health` 返回 `{ status: 'ok' }`
- 队列 demo：`POST /api/queue/demo` body `{ "message": "hi" }` ➜ 投递到 BullMQ `grading` 队列，由 worker 处理并打印耗时
- Prisma 模型：用户/班级/作业/提交等核心表已在 `apps/backend/prisma/schema.prisma` 定义
- 前端路由：`/login`，学生（作业列表/提交/结果/报告）、老师（班级/作业/提交详情/报告）、管理员（配置）页面骨架已就绪
- OCR：`POST /ocr` 接收 `image_url` 或 `image_base64`，返回 mock 文本与置信度

## 环境变量
- 后端示例：`apps/backend/.env.example`（包含 `DATABASE_URL`、`REDIS_URL`、`MINIO_*`、`OCR_BASE_URL`、`LLM_*`、`WORKER_CONCURRENCY` 等）
- 前端示例：`apps/frontend/.env.example`（`VITE_API_BASE_URL`）

## Documentation
- 项目概览：`docs/PROJECT_OVERVIEW.md`

## 后续扩展指引（按 Phase 路线）
1. 完善 Auth + RBAC，接入 Prisma 迁移与 JWT
2. 实现提交上传 ➜ MinIO/S3 存储封装 ➜ 队列状态机
3. 接入真实 OCR（PaddleOCR）与 LLM 结构化 JSON 校验
4. 报表/ECharts、PDF 导出、7 天清理任务等增量能力

若需功能细化，可参考 `worktotal.markdown` 中的分阶段需求列表。
