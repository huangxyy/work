# Homework AI

AI 驱动的英语作文批改系统

## 功能特性

- 学生上传手写作文图片（1-3张）
- OCR 文本识别（百度 OCR）
- AI 智能批改（DeepSeek LLM）
- 三种角色：管理员、教师、学生
- 批量上传支持
- 数据统计报告
- PDF/CSV 导出

## 技术栈

### 后端
- NestJS 10
- Prisma ORM
- MySQL 8
- Redis 7
- BullMQ
- Jest

### 前端
- React 18
- Vite
- TypeScript
- Ant Design Pro
- React Query

### 基础设施
- Docker
- Nginx
- MinIO
- GitHub Actions

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
```

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

## 文档

- [开发文档](./CLAUDE.md) - 详细的开发指南
- [API 文档](./docs/API.md) - API 接口文档
- [部署文档](./docs/DEPLOY.md) - 部署指南

## 许可证

MIT
