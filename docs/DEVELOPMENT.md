# 开发指南 (Development Guide)

本文档面向新加入项目的开发者，介绍如何设置开发环境、理解项目架构以及进行日常开发工作。

---

## 目录

- [环境准备](#环境准备)
- [项目启动](#项目启动)
- [项目架构](#项目架构)
- [开发规范](#开发规范)
- [常见任务](#常见任务)
- [调试技巧](#调试技巧)
- [测试](#测试)

---

## 环境准备

### 系统要求

- **Node.js**: 18+
- **pnpm**: 8+
- **Docker & Docker Compose**: 用于运行依赖服务
- **Git**: 版本控制

### 依赖服务

项目依赖以下服务，通过 Docker Compose 启动：

| 服务 | 端口 | 用途 |
|------|------|------|
| MySQL | 3306 | 数据库 |
| Redis | 6379 | 队列、缓存 |
| MinIO | 9000/9001 | 对象存储 |
| Nginx | 80 | 反向代理 |

### 获取 API 密钥

开发环境需要配置以下外部服务：

1. **百度 OCR** - 用于手写文字识别
   - 访问 [百度智能云](https://cloud.baidu.com/product/ocr)
   - 创建应用获取 API Key 和 Secret Key

2. **DeepSeek LLM** - 用于作文批改
   - 访问 [DeepSeek](https://platform.deepseek.com)
   - 获取 API Key

---

## 项目启动

### 1. 安装依赖

```bash
# 根目录执行
pnpm install
```

### 2. 启动依赖服务

```bash
cd deploy
docker-compose up -d
```

验证服务状态：
```bash
docker-compose ps
```

### 3. 配置环境变量

```bash
cd apps/backend
cp .env.example .env
# 编辑 .env 填入 API 密钥
```

### 4. 初始化数据库

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:db:seed  # 创建测试数据
```

### 5. 启动应用服务

**方式一：使用启动脚本（推荐）**

```bash
# Windows
start-services.bat

# PowerShell（可选）
restart-services.ps1
```

**方式二：手动启动**

需要开启三个终端窗口：

```bash
# 终端1 - 后端 API
cd apps/backend
pnpm start:dev

# 终端2 - Worker 进程（批改任务）
cd apps/backend
pnpm start:worker:dev

# 终端3 - 前端
cd apps/frontend
pnpm dev
```

### 6. 访问应用

- **前端**: http://localhost:3001
- **后端 API**: http://localhost:3000/api
- **MinIO 控制台**: http://localhost:9001

### 默认测试账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | Test1234 |
| 教师 | teacher01 | Test1234 |
| 学生 | student01 | Test1234 |

---

## 项目架构

### Monorepo 结构

```
work/
├── apps/
│   ├── backend/              # NestJS 后端
│   │   ├── prisma/          # 数据库模型和迁移
│   │   ├── src/
│   │   │   ├── auth/        # JWT 认证
│   │   │   ├── classes/     # 班级管理
│   │   │   ├── homeworks/   # 作业管理
│   │   │   ├── submissions/ # 提交管理
│   │   │   ├── grading/     # LLM 批改服务
│   │   │   ├── ocr/         # 百度 OCR 集成
│   │   │   ├── queue/       # BullMQ 队列
│   │   │   ├── worker/      # 后台 Worker
│   │   │   ├── reports/     # 报表导出
│   │   │   ├── retention/   # 数据清理
│   │   │   └── admin/       # 管理员功能
│   │   └── .env             # 环境配置
│   └── frontend/            # React 前端
│       ├── src/
│       │   ├── pages/       # 页面组件
│       │   │   ├── student/
│       │   │   ├── teacher/
│       │   │   └── admin/
│       │   ├── api/         # API 客户端
│       │   ├── components/  # 通用组件
│       │   ├── layouts/     # 布局组件
│       │   └── i18n.ts      # 国际化
│       └── vite.config.ts
├── deploy/                  # Docker 配置
│   ├── docker-compose.yml
│   └── nginx/
├── docs/                    # 项目文档
├── scripts/                 # 工具脚本
└── package.json             # 根 package.json
```

### 核心流程：批改工作流

```
1. 学生上传图片
   ↓
2. API 保存提交 (状态: QUEUED)
   ↓
3. 入队 BullMQ (grading 队列)
   ↓
4. Worker 处理任务:
   - 下载图片 (MinIO)
   - 百度 OCR 识别文字 → submission.ocrText
   - DeepSeek LLM 批改 → submission.gradingJson
   - 计算总分 → submission.totalScore
   ↓
5. 保存结果 (状态: DONE / FAILED)
```

**重要**: Worker 进程必须运行，否则提交会一直停留在 QUEUED 状态。

### 提交状态机

```
                    ┌─────────────┐
                    │   QUEUED    │  初始状态
                    └──────┬──────┘
                           │
                    Worker 开始处理
                           ▼
                    ┌─────────────┐
                    │ PROCESSING  │  OCR + LLM 处理中
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
       ┌─────────┐                   ┌─────────┐
       │  DONE   │                   │ FAILED  │
       └─────────┘                   └─────────┘
    处理成功                       处理失败
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **后端框架** | NestJS 10 | 企业级 Node.js 框架 |
| **ORM** | Prisma 5 | 类型安全的数据库 ORM |
| **数据库** | MySQL 8 | 关系型数据库 |
| **队列** | BullMQ + Redis | 可靠的任务队列 |
| **认证** | Passport JWT | JWT 认证 |
| **存储** | MinIO | S3 兼容的对象存储 |
| **前端框架** | React 18 | UI 框架 |
| **构建工具** | Vite 5 | 快速的开发服务器 |
| **UI 组件** | Ant Design Pro 5 | 企业级 UI 库 |
| **状态管理** | React Query | 服务端状态管理 |
| **路由** | React Router 6 | 客户端路由 |

---

## 开发规范

### 代码风格

项目使用 ESLint 和 Prettier 进行代码格式化：

```bash
# 检查代码
pnpm lint

# 自动修复
pnpm lint --fix
```

### 类型检查

```bash
# 运行 TypeScript 类型检查
pnpm typecheck
```

### 提交规范

建议使用 Conventional Commits 格式：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建/工具变更
```

### 后端开发规范

#### Controller 层

- 处理 HTTP 请求/响应
- 参数验证（使用 class-validator）
- 调用 Service 层处理业务逻辑

```typescript
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(dto);
  }
}
```

#### Service 层

- 业务逻辑处理
- 调用 Prisma 操作数据库
- 返回 DTO 而非实体

#### Module 结构

每个功能模块包含：
- `*.module.ts` - 模块定义
- `*.controller.ts` - 控制器
- `*.service.ts` - 服务
- `*.dto.ts` - 数据传输对象
- `*.entity.ts` - Prisma 模型引用

### 前端开发规范

#### API 调用

所有 API 调用封装在 `src/api/` 模块中：

```typescript
// src/api/submissions.ts
export async function createSubmission(data: CreateSubmissionData) {
  const response = await api.post('/submissions', data);
  return response.data;
}
```

#### React Query 使用

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['submissions', homeworkId],
  queryFn: () => getSubmissions(homeworkId),
  staleTime: 5 * 60 * 1000, // 5分钟
});
```

#### 国际化

使用 `useI18n` hook：

```typescript
const { t } = useI18n();
return <div>{t('homework.submit')}</div>;
```

翻译键定义在 `src/i18n.ts` 中。

---

## 常见任务

### 添加新的 API 端点

1. 在 `apps/backend/src` 创建模块目录
2. 创建 module、controller、service、dto 文件
3. 在 `app.module.ts` 中注册新模块

### 添加新的前端页面

1. 在 `apps/frontend/src/pages/` 对应角色目录下创建组件
2. 在 `src/routes/router.tsx` 添加路由
3. 如需权限，在路由配置中添加角色检查

### 数据库迁移

```bash
# 创建迁移
cd apps/backend
npx prisma migrate dev --name add_new_field

# 重置数据库（开发环境）
npx prisma migrate reset

# 生成 Prisma Client
pnpm prisma:generate
```

### 修改环境变量

1. 编辑 `apps/backend/.env`
2. 重启相关服务

---

## 调试技巧

### 后端调试

使用 VS Code 调试配置：

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/apps/backend/src/main.ts",
  "cwd": "${workspaceFolder}/apps/backend",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["start:dev", "--inspect-brk"]
}
```

### 前端调试

- 使用浏览器开发者工具
- React DevTools 扩展
- Network 面板查看 API 请求

### 查看 Worker 日志

Worker 进程在独立终端运行，可直接查看输出。

常见问题排查：

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| 提交一直 QUEUED | Worker 未运行 | 启动 `pnpm start:worker:dev` |
| MAX_RETRIES_EXCEEDED | LLM_MAX_TOKENS 太小 | 设置为 2000+ |
| 502 错误 | 后端服务未运行 | 检查 API 和 Worker 状态 |
| OCR 失败 | 百度密钥无效 | 检查 BAIDU_OCR_* 配置 |

---

## 测试

### 后端测试

```bash
cd apps/backend

# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:cov
```

### 测试账号

开发环境使用 seed 脚本创建的测试账号，密码统一为 `Test1234`。

---

## 相关文档

- [API.md](API.md) - API 接口文档
- [ARCH.md](ARCH.md) - 架构详细说明
- [DEPLOY.md](DEPLOY.md) - 生产环境部署指南
- [RUNBOOK.md](RUNBOOK.md) - 运维手册
- [CLAUDE.md](../CLAUDE.md) - AI 助手项目指南
