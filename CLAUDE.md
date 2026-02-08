# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Homework AI** - An AI-powered English essay grading system. Students upload handwritten homework images (1-3 photos), which are processed through OCR (Baidu OCR) and graded by AI (DeepSeek LLM). The system supports three user roles: ADMIN, TEACHER, and STUDENT.

**最新更新 (2025-02)**:
- 新增着陆页 (`Landing.tsx`) - 公开访问的产品介绍页面
- 添加 Jest 单元测试框架及覆盖率报告
- 新增 GitHub Actions CI/CD 工作流
- 新增主机部署脚本 `deploy/install-host.sh`
- API 接口更新与优化
- **修复 PDF 导出功能** - 增强字体加载验证，支持中文字体回退机制
- **合并导出按钮** - 教师端作业详情页和报告页使用 Dropdown.Button 组件
- **优化 PDF 批改单格式** - 显示所有错误、简化学生信息、OCR 文本清理

## Development Commands

### Root Level Commands
```bash
pnpm dev:frontend    # Start frontend dev server
pnpm dev:backend     # Start API server
pnpm dev:worker      # Start background worker process
pnpm build           # Build all apps
pnpm lint            # Lint all apps
pnpm typecheck       # TypeScript type check for all apps
pnpm test            # Run tests (backend only)
pnpm test:cov        # Run tests with coverage
```

### Backend (apps/backend/)
```bash
pnpm start:dev         # Start API server (port 3008, proxied via Nginx to :80/api)
pnpm start:worker:dev  # Start worker process (handles async grading tasks)
pnpm build             # Build for production
pnpm format            # Format code with Prettier
pnpm lint              # Lint with ESLint
pnpm test              # Run Jest unit tests
pnpm test:cov          # Run tests with coverage report
pnpm prisma:generate   # Generate Prisma client
pnpm prisma:migrate    # Run database migrations
```

**Important**: The backend requires TWO separate processes:
1. API server - handles HTTP requests
2. Worker process - handles async OCR/grading jobs via BullMQ

If submissions stay in QUEUED status, the worker is not running.

### Frontend (apps/frontend/)
```bash
pnpm dev      # Start dev server (port 5173, proxied via Nginx to :80)
pnpm build    # Build for production
pnpm preview  # Preview production build
pnpm lint     # Lint with ESLint
```

### Infrastructure
```bash
cd deploy && docker-compose up -d     # Start MySQL, Redis, MinIO, Nginx
bash deploy/install-host.sh           # Automated host deployment script
```

## Architecture

### Monorepo Structure
- **pnpm workspaces** - Root package manager
- **apps/backend** - NestJS API + BullMQ Worker
- **apps/frontend** - React 18 + Vite + Ant Design Pro
- **services/** - Microservices (currently has ocr-service)

### Grading Workflow
```
Student uploads images → API saves submission (QUEUED)
    → BullMQ queue → Worker picks up job
    → Baidu OCR for text recognition
    → DeepSeek LLM for grading
    → Save results (DONE/FAILED)
```

### Key Backend Modules
- `src/auth/` - JWT authentication with Passport
- `src/queue/` - BullMQ queue management for async jobs
- `src/worker/` - Background worker process entry point
- `src/ocr/` - Baidu OCR integration
- `src/grading/` - DeepSeek LLM grading service
- `src/storage/` - MinIO S3-compatible file storage
- `src/retention/` - Scheduled data cleanup (default 7 days)
- `src/public/` - Public API endpoints (overview, landing page data)
- `prisma/` - Database schema and migrations
- `*.spec.ts` - Jest unit test files

### Key Frontend Pages
- `src/pages/Landing.tsx` - 公开着陆页（无需登录）
- `src/pages/Login.tsx` - 登录页面
- `src/pages/student/` - 学生端页面
- `src/pages/teacher/` - 教师端页面
- `src/pages/admin/` - 管理员页面

### Technology Stack
- **Backend**: NestJS, Prisma ORM, MySQL, Redis, BullMQ, Jest, JWT
- **Frontend**: React 18, Vite, TypeScript, Ant Design Pro, React Query, React Router
- **Testing**: Jest (backend), coverage reports generated on test run
- **CI/CD**: GitHub Actions workflows
- **External APIs**: Baidu OCR, DeepSeek LLM
- **Storage**: MinIO (S3-compatible)
- **Reverse Proxy**: Nginx

## Environment Configuration

### Backend (.env)
Key variables:
- `DATABASE_URL` - MySQL connection
- `REDIS_URL` - Redis for cache/queue
- `JWT_SECRET` - JWT signing key
- `MINIO_*` - Object storage config
- `BAIDU_OCR_*` - Baidu OCR API keys
- `LLM_*` - DeepSeek LLM config (important: `LLM_MAX_TOKENS=2000` minimum to avoid JSON truncation)
- `WORKER_CONCURRENCY` - Worker parallel job count
- `RETENTION_DAYS` - Data retention policy
- `PDF_FONT_PATH` - Path to Chinese TTF/OTF font for PDF exports (e.g., `C:\Windows\Fonts\msyh.ttf`)

### Frontend (.env)
- `VITE_API_BASE_URL` - API base path (default: `/api`)

## Default Test Accounts
Password: `Test1234`
- Admin: `admin`
- Teacher: `teacher01`
- Student: `student01`

## Common Issues

- **Submissions stuck in QUEUED** - Worker process is not running. Start with `pnpm start:worker:dev`
- **Grading fails with MAX_RETRIES_EXCEEDED** - `LLM_MAX_TOKENS` is too low. Set to 2000+
- **502 errors** - Backend API or Worker not running
- **Page keeps refreshing / won't load** - Nginx proxy port mismatch.
  - **自动修复**: 运行 `scripts\check-ports.bat`
  - **手动修复**: 检查 Vite 端口（`pnpm dev` 启动时显示）是否与 `deploy/nginx/nginx.conf` 中的 `proxy_pass` 端口一致，修改后 `docker-compose restart nginx`
- **PDF 导出文件无法打开** - 中文字体加载失败导致 PDF 损坏。
  - 查看 `apps/backend/src/submissions/submissions.service.ts:resolvePdfFont` 中的字体候选列表
  - 设置环境变量 `PDF_FONT_PATH` 指定有效的中文字体路径（如 `C:\Windows\Fonts\msyh.ttf`）
  - 确保字体文件存在且可读（.ttf 或 .otf 格式，不支持 .ttc）

## Testing

### Backend Tests
```bash
cd apps/backend
pnpm test                      # Run all tests
pnpm test:watch                # Watch mode
pnpm test:cov                  # Run with coverage (generates coverage/lcov-report)
pnpm test -- src/auth/auth.service.spec.ts  # Run single test file
pnpm test -- -t "should login"  # Run tests matching name pattern
```

Test configuration in `jest.config.js`:
- Tests match `*.spec.ts` pattern
- Coverage excludes `*.module.ts` and `main.ts`
- Coverage reports in `apps/backend/coverage/`

Existing test files:
- `src/auth/auth.service.spec.ts`
- `src/grading/grading.service.spec.ts`
- `src/submissions/submissions.service.spec.ts`
- `src/ocr/ocr.service.spec.ts`
- `src/public/public.controller.spec.ts`

### Frontend Tests
No test framework configured currently.

## CI/CD

GitHub Actions workflow in `.github/workflows/ci.yml`:
- Triggers: push/PR to main branch
- Jobs: lint, typecheck, test, build (with dependencies)
- Uploads coverage reports as artifacts (7-day retention)
- Uses Node.js 20, pnpm 8
