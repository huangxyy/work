# 项目整体优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统性提升 Homework AI 项目的后端性能、前端性能和小程序体验

**Architecture:** 采用分阶段渐进式优化，从快速收益项开始，逐步深入后端查询优化、前端构建优化和小程序体验优化

**Tech Stack:** NestJS, Prisma, React, Vite, React Query, 微信小程序原生框架

---

## 文件结构

### 后端修改文件
- `apps/backend/prisma/schema.prisma` - 数据库索引优化
- `apps/backend/src/ocr/baidu-ocr.service.ts` - OCR Token 缓存
- `apps/backend/src/submissions/submissions.service.ts` - 查询优化
- `apps/backend/src/common/interceptors/performance.interceptor.ts` - 性能监控

### 前端修改文件
- `apps/frontend/src/lib/queryClient.ts` - React Query 配置
- `apps/frontend/vite.config.ts` - 构建优化
- `apps/frontend/src/routes/router.tsx` - 路由懒加载

### 小程序修改文件
- `wechat-miniapp/pages/teacher/homeworks/index.js` - 缓存应用
- `wechat-miniapp/pages/teacher/homeworks/index.wxml` - 图片懒加载

---

## 阶段一：快速收益优化

### Task 1: 补充数据库联合索引

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: 在 Submission 模型添加联合索引**

修改 `apps/backend/prisma/schema.prisma`，在 Submission 模型的现有索引后添加：

```prisma
model Submission {
  id         String           @id @default(cuid())
  homeworkId String
  studentId  String
  batchId    String?
  status     SubmissionStatus @default(QUEUED)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  images         SubmissionImage[]
  ocrText        String?          @db.Text
  gradingJson    Json?
  totalScore     Float?
  errorCode      String?
  errorMsg       String?
  teacherComment String?          @db.Text
  manualScore    Float?
  reviewedBy     String?
  reviewedAt     DateTime?

  homework Homework @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  student  User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  batch    BatchUpload? @relation(fields: [batchId], references: [id], onDelete: SetNull)

  @@index([homeworkId])
  @@index([studentId])
  @@index([status])
  @@index([batchId])
  @@index([createdAt])
  @@index([homeworkId, status])
  @@index([studentId, homeworkId])
  @@index([homeworkId, studentId, status])
  @@index([homeworkId, status, updatedAt])
  @@index([studentId, createdAt])
  @@index([status, updatedAt])
}
```

- [ ] **Step 2: 在 LlmCallLog 模型添加联合索引**

修改 `apps/backend/prisma/schema.prisma`，在 LlmCallLog 模型添加：

```prisma
model LlmCallLog {
  id               String   @id @default(cuid())
  source           String
  providerId       String?
  providerName     String?
  model            String?
  status           String
  latencyMs        Int?
  promptTokens     Int?
  completionTokens Int?
  totalTokens      Int?
  cost             Float?
  prompt           String?  @db.Text
  systemPrompt     String?  @db.Text
  response         String?  @db.Text
  error            String?  @db.Text
  userId           String?
  submissionId     String?
  createdAt        DateTime @default(now())
  meta             Json?

  @@index([createdAt])
  @@index([source])
  @@index([providerId])
  @@index([status])
  @@index([source, createdAt])
  @@index([status, createdAt])
}
```

- [ ] **Step 3: 生成 Prisma 迁移**

```bash
cd apps/backend
pnpm prisma migrate dev --name add_optimization_indexes
```

Expected: Migration created and applied successfully

- [ ] **Step 4: 提交索引优化**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "perf(db): add composite indexes for high-frequency queries"
```

---

### Task 2: OCR Token Redis 缓存

**Files:**
- Modify: `apps/backend/src/ocr/baidu-ocr.service.ts`

- [ ] **Step 1: 添加 Redis 缓存逻辑**

首先检查 `apps/backend/src/ocr/baidu-ocr.service.ts` 的当前实现：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class BaiduOcrService {
  private readonly logger = new Logger(BaiduOcrService.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly tokenCacheKey = 'baidu_ocr_access_token';

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiKey = this.configService.get<string>('BAIDU_OCR_API_KEY') || '';
    this.secretKey = this.configService.get<string>('BAIDU_OCR_SECRET_KEY') || '';
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.cacheManager.get<string>(this.tokenCacheKey);
    if (cached) {
      return cached;
    }

    const token = await this.fetchNewAccessToken();
    await this.cacheManager.set(this.tokenCacheKey, token, 29 * 24 * 60 * 60 * 1000);
    return token;
  }

  private async fetchNewAccessToken(): Promise<string> {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`;
    
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json() as { access_token?: string; error?: string };
    
    if (!data.access_token) {
      throw new Error(`Failed to get Baidu OCR token: ${data.error || 'Unknown error'}`);
    }
    
    return data.access_token;
  }

  async recognize(imageBuffer: Buffer, config?: { apiKey?: string; secretKey?: string }): Promise<{ text: string }> {
    const apiKey = config?.apiKey || this.apiKey;
    const secretKey = config?.secretKey || this.secretKey;
    
    if (!apiKey || !secretKey) {
      throw new Error('Baidu OCR credentials not configured');
    }

    const token = await this.getAccessToken();
    const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate?access_token=${token}`;
    
    const base64Image = imageBuffer.toString('base64');
    const body = new URLSearchParams();
    body.append('image', base64Image);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    
    const result = await response.json() as { words_result?: Array<{ words: string }>; error_msg?: string };
    
    if (result.error_msg) {
      throw new Error(`Baidu OCR error: ${result.error_msg}`);
    }
    
    const text = (result.words_result || []).map(item => item.words).join('\n');
    return { text };
  }
}
```

- [ ] **Step 2: 提交 OCR 缓存优化**

```bash
git add apps/backend/src/ocr/baidu-ocr.service.ts
git commit -m "perf(ocr): add Redis cache for Baidu OCR access token"
```

---

### Task 3: React Query 参数统一配置

**Files:**
- Modify: `apps/frontend/src/lib/queryClient.ts` (或创建新文件)

- [ ] **Step 1: 创建或修改 QueryClient 配置**

检查并修改 `apps/frontend/src/lib/queryClient.ts` 或 `apps/frontend/src/main.tsx` 中的 QueryClient 配置：

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

- [ ] **Step 2: 确保在应用入口使用配置**

在 `apps/frontend/src/main.tsx` 中确保使用该配置：

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: 提交 React Query 配置优化**

```bash
git add apps/frontend/src/lib/queryClient.ts apps/frontend/src/main.tsx
git commit -m "perf(frontend): unify React Query configuration for better caching"
```

---

### Task 4: 前端路由懒加载

**Files:**
- Modify: `apps/frontend/src/routes/router.tsx`

- [ ] **Step 1: 将路由组件改为懒加载**

修改 `apps/frontend/src/routes/router.tsx`：

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '@/layouts/Layout';
import Login from '@/pages/Login';
import Landing from '@/pages/Landing';

const StudentDashboard = lazy(() => import('@/pages/student/Dashboard'));
const StudentHomeworks = lazy(() => import('@/pages/student/Homeworks'));
const StudentHomeworkDetail = lazy(() => import('@/pages/student/HomeworkDetail'));
const StudentSubmitHomework = lazy(() => import('@/pages/student/SubmitHomework'));
const StudentSubmissionResult = lazy(() => import('@/pages/student/SubmissionResult'));
const StudentSubmissions = lazy(() => import('@/pages/student/Submissions'));
const StudentReport = lazy(() => import('@/pages/student/Report'));
const StudentAnnouncements = lazy(() => import('@/pages/student/Announcements'));

const TeacherDashboard = lazy(() => import('@/pages/teacher/Dashboard'));
const TeacherHomeworks = lazy(() => import('@/pages/teacher/Homeworks'));
const TeacherHomeworkDetail = lazy(() => import('@/pages/teacher/HomeworkDetail'));
const TeacherReport = lazy(() => import('@/pages/teacher/Report'));
const TeacherClasses = lazy(() => import('@/pages/teacher/Classes'));
const TeacherClassDetail = lazy(() => import('@/pages/teacher/ClassDetail'));
const TeacherAnnouncements = lazy(() => import('@/pages/teacher/Announcements'));

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminClasses = lazy(() => import('@/pages/admin/Classes'));
const AdminQueue = lazy(() => import('@/pages/admin/Queue'));
const AdminConfig = lazy(() => import('@/pages/admin/Config'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const AdminUsage = lazy(() => import('@/pages/admin/Usage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/student',
    element: <Layout role="student" />,
    children: [
      { index: true, element: withSuspense(StudentDashboard) },
      { path: 'homeworks', element: withSuspense(StudentHomeworks) },
      { path: 'homeworks/:id', element: withSuspense(StudentHomeworkDetail) },
      { path: 'submit/:id', element: withSuspense(StudentSubmitHomework) },
      { path: 'submission/:id', element: withSuspense(StudentSubmissionResult) },
      { path: 'submissions', element: withSuspense(StudentSubmissions) },
      { path: 'report', element: withSuspense(StudentReport) },
      { path: 'announcements', element: withSuspense(StudentAnnouncements) },
    ],
  },
  {
    path: '/teacher',
    element: <Layout role="teacher" />,
    children: [
      { index: true, element: withSuspense(TeacherDashboard) },
      { path: 'homeworks', element: withSuspense(TeacherHomeworks) },
      { path: 'homeworks/:id', element: withSuspense(TeacherHomeworkDetail) },
      { path: 'report', element: withSuspense(TeacherReport) },
      { path: 'classes', element: withSuspense(TeacherClasses) },
      { path: 'classes/:id', element: withSuspense(TeacherClassDetail) },
      { path: 'announcements', element: withSuspense(TeacherAnnouncements) },
    ],
  },
  {
    path: '/admin',
    element: <Layout role="admin" />,
    children: [
      { index: true, element: withSuspense(AdminDashboard) },
      { path: 'users', element: withSuspense(AdminUsers) },
      { path: 'classes', element: withSuspense(AdminClasses) },
      { path: 'queue', element: withSuspense(AdminQueue) },
      { path: 'config', element: withSuspense(AdminConfig) },
      { path: 'audit-logs', element: withSuspense(AdminAuditLogs) },
      { path: 'usage', element: withSuspense(AdminUsage) },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 2: 验证构建产物**

```bash
cd apps/frontend
pnpm build
```

Expected: 构建成功，检查 dist 目录确认代码分割

- [ ] **Step 3: 提交路由懒加载优化**

```bash
git add apps/frontend/src/routes/router.tsx
git commit -m "perf(frontend): add lazy loading for all route components"
```

---

### Task 5: 小程序图片懒加载

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxml`
- Modify: `wechat-miniapp/pages/teacher/student-submissions/index.wxml`

- [ ] **Step 1: 在作业列表页添加图片懒加载**

修改 `wechat-miniapp/pages/teacher/homeworks/index.wxml`，找到所有 `<image>` 标签添加 `lazy-load` 属性：

```xml
<image lazy-load src="{{item.imageUrl}}" mode="aspectFill" class="homework-image" />
```

- [ ] **Step 2: 在学生提交列表页添加图片懒加载**

修改 `wechat-miniapp/pages/teacher/student-submissions/index.wxml`：

```xml
<image lazy-load src="{{item.thumbnailUrl}}" mode="aspectFill" class="submission-thumbnail" />
```

- [ ] **Step 3: 提交小程序图片懒加载优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/index.wxml wechat-miniapp/pages/teacher/student-submissions/index.wxml
git commit -m "perf(miniapp): add lazy loading for images in list pages"
```

---

### Task 6: 小程序数据缓存应用

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.js`

- [ ] **Step 1: 在作业列表页应用缓存**

修改 `wechat-miniapp/pages/teacher/homeworks/index.js`，在文件开头添加缓存引入：

```javascript
const cache = require('../../../lib/cache');
const errorHandler = require('../../../lib/error-handler');
const performance = require('../../../lib/performance');
```

修改 `loadHomeworks` 方法：

```javascript
async loadHomeworks(refresh = false) {
  const { selectedClassId } = this.data;
  
  if (!selectedClassId) {
    this.setData({
      homeworks: [],
      filteredHomeworks: [],
      homeworkCount: 0,
      openCount: 0,
      closedCount: 0,
    });
    return;
  }

  const cacheKey = `homeworks_${selectedClassId}`;
  
  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      this.setData({ 
        homeworks: cached, 
        loading: false 
      }, () => {
        this.calculateStats();
        this.applyFilter();
      });
      return;
    }
  }

  this.setData({ loading: true, error: '' });
  
  const startTime = Date.now();
  
  try {
    const homeworks = await fetchHomeworks({ classId: selectedClassId });
    const validHomeworks = Array.isArray(homeworks) ? homeworks : [];

    cache.set(cacheKey, validHomeworks, 5 * 60 * 1000);

    this.setData({ homeworks: validHomeworks }, () => {
      this.calculateStats();
      this.applyFilter();
    });

    const duration = Date.now() - startTime;
    performance.recordPageLoad('homeworks', duration);
  } catch (error) {
    errorHandler.handle(error, {
      onRetry: () => this.loadHomeworks(refresh)
    });
  } finally {
    this.setData({ loading: false });
  }
}
```

- [ ] **Step 2: 提交小程序缓存优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/index.js
git commit -m "perf(miniapp): apply data caching for homeworks list"
```

---

## 阶段二：后端深度优化

### Task 7: 列表接口排除大字段

**Files:**
- Modify: `apps/backend/src/submissions/submissions.service.ts`

- [ ] **Step 1: 修改 listHomeworkSubmissions 方法**

在 `apps/backend/src/submissions/submissions.service.ts` 中找到 `listHomeworkSubmissions` 方法，确保不返回 `ocrText` 和 `gradingJson`：

```typescript
async listHomeworkSubmissions(
  homeworkId: string,
  user: AuthUser,
  options?: { cursor?: string; limit?: number },
) {
  if (user.role === Role.STUDENT) {
    throw new ForbiddenException('仅教师或管理员可以访问作业提交列表');
  }

  const homework = await this.prisma.homework.findFirst({
    where:
      user.role === Role.ADMIN
        ? { id: homeworkId }
        : { id: homeworkId, class: { teachers: { some: { id: user.id } } } },
    select: { id: true },
  });

  if (!homework) {
    throw new NotFoundException('作业不存在或无权访问');
  }

  const startedAt = Date.now();
  const take = Math.min(Math.max(options?.limit || 1000, 1), 1000);
  const submissions = await this.prisma.submission.findMany({
    where: { homeworkId },
    select: {
      id: true,
      status: true,
      totalScore: true,
      errorCode: true,
      errorMsg: true,
      updatedAt: true,
      student: { select: { id: true, name: true, account: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take,
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  this.logger.debug(
    `Homework submissions listed homeworkId=${homeworkId} returned=${submissions.length} limit=${take} cursor=${options?.cursor || 'none'} durationMs=${Date.now() - startedAt}`,
  );

  return submissions.map((submission) => ({
    id: submission.id,
    studentId: submission.student.id,
    studentName: submission.student.name,
    studentAccount: submission.student.account,
    status: submission.status,
    totalScore: submission.totalScore,
    errorCode: submission.errorCode,
    errorMsg: submission.errorMsg,
    updatedAt: submission.updatedAt.toISOString(),
  }));
}
```

- [ ] **Step 2: 修改 listStudentSubmissions 方法**

确保 `listStudentSubmissionsWithQuery` 方法也不返回大字段：

```typescript
async listStudentSubmissionsWithQuery(user: AuthUser, query: StudentSubmissionsQueryDto) {
  if (user.role !== Role.STUDENT) {
    throw new ForbiddenException('仅学生可以查看提交记录');
  }

  const startedAt = Date.now();
  const submissions = await this.prisma.submission.findMany({
    where: this.buildStudentSubmissionWhere(user.id, query),
    select: {
      id: true,
      status: true,
      totalScore: true,
      errorCode: true,
      errorMsg: true,
      updatedAt: true,
      homework: { select: { id: true, title: true } },
      _count: { select: { images: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  this.logger.debug(
    `Student submissions listed studentId=${user.id} returned=${submissions.length} status=${query.status || 'all'} durationMs=${Date.now() - startedAt}`,
  );

  return submissions.map((submission) => ({
    id: submission.id,
    homeworkId: submission.homework.id,
    homeworkTitle: submission.homework.title,
    status: submission.status,
    totalScore: submission.totalScore,
    errorCode: submission.errorCode,
    errorMsg: submission.errorMsg,
    imageCount: submission._count.images,
    updatedAt: submission.updatedAt.toISOString(),
  }));
}
```

- [ ] **Step 3: 提交列表接口优化**

```bash
git add apps/backend/src/submissions/submissions.service.ts
git commit -m "perf(api): exclude large fields from list endpoints"
```

---

### Task 8: Worker 动态并发配置

**Files:**
- Modify: `apps/backend/src/worker/worker.module.ts` (或 worker 入口文件)

- [ ] **Step 1: 添加动态并发配置**

找到 worker 配置文件，添加 CPU 核心数动态计算：

```typescript
import os from 'os';
import { Worker } from 'bullmq';
import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

const DEFAULT_CONCURRENCY = Math.min(os.cpus().length * 2, 10);

export const getWorkerConcurrency = (): number => {
  const envConcurrency = Number(process.env.WORKER_CONCURRENCY);
  if (Number.isFinite(envConcurrency) && envConcurrency > 0) {
    return Math.min(envConcurrency, 20);
  }
  return DEFAULT_CONCURRENCY;
};

@Processor('grading', {
  concurrency: getWorkerConcurrency(),
})
export class GradingProcessor {
  private readonly logger = new Logger(GradingProcessor.name);

  constructor() {
    this.logger.log(`Worker initialized with concurrency: ${getWorkerConcurrency()}`);
  }
}
```

- [ ] **Step 2: 提交 Worker 并发优化**

```bash
git add apps/backend/src/worker/
git commit -m "perf(worker): add dynamic concurrency based on CPU cores"
```

---

### Task 9: 性能监控日志增强

**Files:**
- Modify: `apps/backend/src/common/interceptors/performance.interceptor.ts`

- [ ] **Step 1: 增强性能监控拦截器**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface PerformanceLog {
  timestamp: string;
  method: string;
  path: string;
  durationMs: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThreshold = 1000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const log: PerformanceLog = {
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.route?.path || request.url,
            durationMs: duration,
            statusCode: response.statusCode,
            userAgent: request.headers?.['user-agent'],
            ip: request.ip,
            userId: request.user?.id,
          };

          if (duration > this.slowThreshold) {
            this.logger.warn({
              msg: 'Slow request detected',
              ...log,
            });
          } else {
            this.logger.debug({
              msg: 'Request completed',
              ...log,
            });
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            msg: 'Request failed',
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.route?.path || request.url,
            durationMs: duration,
            error: error.message,
            userId: request.user?.id,
          });
        },
      }),
    );
  }
}
```

- [ ] **Step 2: 提交性能监控增强**

```bash
git add apps/backend/src/common/interceptors/performance.interceptor.ts
git commit -m "feat(monitoring): enhance performance logging with structured format"
```

---

## 阶段三：前端深度优化

### Task 10: 添加打包体积分析

**Files:**
- Modify: `apps/frontend/vite.config.ts`

- [ ] **Step 1: 添加 rollup-plugin-visualizer**

```bash
cd apps/frontend
pnpm add -D rollup-plugin-visualizer
```

- [ ] **Step 2: 配置打包分析**

修改 `apps/frontend/vite.config.ts`：

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
    },
  },
  plugins: [
    react(),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3001,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    allowedHosts: true,
    cors: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-antd-pro': ['@ant-design/pro-components'],
          'vendor-charts': ['echarts'],
          'vendor-pdf': ['html2canvas', 'jspdf'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

- [ ] **Step 3: 运行构建分析**

```bash
cd apps/frontend
pnpm build
```

Expected: 生成 `dist/stats.html` 分析报告

- [ ] **Step 4: 提交打包分析配置**

```bash
git add apps/frontend/vite.config.ts apps/frontend/package.json
git commit -m "feat(frontend): add bundle size analysis with visualizer"
```

---

### Task 11: 虚拟列表优化

**Files:**
- Create: `apps/frontend/src/components/VirtualList.tsx`

- [ ] **Step 1: 安装虚拟列表依赖**

```bash
cd apps/frontend
pnpm add @tanstack/react-virtual
```

- [ ] **Step 2: 创建虚拟列表组件**

创建 `apps/frontend/src/components/VirtualList.tsx`：

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  containerHeight: number | string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 80,
  overscan = 5,
  className = '',
  containerHeight,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交虚拟列表组件**

```bash
git add apps/frontend/src/components/VirtualList.tsx apps/frontend/package.json
git commit -m "feat(frontend): add virtual list component for large datasets"
```

---

## 阶段四：小程序体验优化

### Task 12: 小程序分页加载

**Files:**
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.js`
- Modify: `wechat-miniapp/pages/teacher/homeworks/index.wxml`

- [ ] **Step 1: 添加分页数据和方法**

修改 `wechat-miniapp/pages/teacher/homeworks/index.js`：

```javascript
Page({
  data: {
    homeworks: [],
    classes: [],
    selectedClassId: '',
    selectedIndex: 0,
    selectedClassName: '选择班级',
    loading: false,
    loadingMore: false,
    error: '',
    userName: '老师',
    activeFilter: 'all',
    showClassSelector: false,
    homeworkCount: 0,
    classCount: 0,
    openCount: 0,
    closedCount: 0,
    filteredHomeworks: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
  },

  onLoad() {
    this.loadUserInfo();
    this.loadClasses();
  },

  async loadHomeworks(refresh = false) {
    const { selectedClassId, page, pageSize, loadingMore, hasMore } = this.data;
    
    if (!selectedClassId) {
      this.setData({
        homeworks: [],
        filteredHomeworks: [],
        homeworkCount: 0,
        openCount: 0,
        closedCount: 0,
      });
      return;
    }

    if (loadingMore || (!refresh && !hasMore)) return;

    if (refresh) {
      this.setData({ 
        page: 1, 
        hasMore: true, 
        homeworks: [],
        loading: true 
      });
    } else {
      this.setData({ loadingMore: true });
    }

    this.setData({ error: '' });
    
    const cacheKey = `homeworks_${selectedClassId}_${page}`;
    const cache = require('../../../lib/cache');
    
    if (!refresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        this.setData({ 
          homeworks: refresh ? cached : [...this.data.homeworks, ...cached],
          page: page + 1,
          hasMore: cached.length === pageSize,
          loadingMore: false,
        }, () => {
          this.calculateStats();
          this.applyFilter();
        });
        return;
      }
    }

    try {
      const { fetchHomeworks } = require('../../../lib/request');
      const homeworks = await fetchHomeworks({ 
        classId: selectedClassId,
        page: refresh ? 1 : page,
        pageSize 
      });

      const validHomeworks = Array.isArray(homeworks) ? homeworks : [];

      cache.set(cacheKey, validHomeworks, 5 * 60 * 1000);

      this.setData({ 
        homeworks: refresh ? validHomeworks : [...this.data.homeworks, ...validHomeworks],
        page: (refresh ? 1 : page) + 1,
        hasMore: validHomeworks.length === pageSize,
      }, () => {
        this.calculateStats();
        this.applyFilter();
      });
    } catch (error) {
      const errorHandler = require('../../../lib/error-handler');
      errorHandler.handle(error, {
        onRetry: () => this.loadHomeworks(refresh)
      });
    } finally {
      this.setData({ 
        loading: false,
        loadingMore: false
      });
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadHomeworks();
    }
  },

  onPullDownRefresh() {
    this.loadHomeworks(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  calculateStats() {
    const homeworks = this.data.homeworks;
    const now = new Date();
    
    const openCount = homeworks.filter(h => h.dueAt && new Date(h.dueAt) > now).length;
    const closedCount = homeworks.filter(h => h.dueAt && new Date(h.dueAt) <= now).length;
    
    this.setData({
      homeworkCount: homeworks.length,
      openCount,
      closedCount,
    });
  },

  applyFilter() {
    const { homeworks, activeFilter } = this.data;
    const now = new Date();

    let filteredHomeworks = [];

    if (activeFilter === 'all') {
      filteredHomeworks = [...homeworks];
    } else if (activeFilter === 'open') {
      filteredHomeworks = homeworks.filter(h => h.dueAt && new Date(h.dueAt) > now);
    } else if (activeFilter === 'closed') {
      filteredHomeworks = homeworks.filter(h => h.dueAt && new Date(h.dueAt) <= now);
    }

    this.setData({ filteredHomeworks });
  },

  onFilterChange(e) {
    const { filter } = e.currentTarget.dataset;
    this.setData({ activeFilter: filter });
    this.applyFilter();
  },

  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ userName: userInfo.name || '老师' });
      }
    } catch (error) {
      console.error('Load user info failed:', error);
    }
  },

  async loadClasses() {
    try {
      const { fetchClasses } = require('../../../lib/request');
      const classes = await fetchClasses();
      this.setData({ 
        classes,
        classCount: classes.length,
      });
      
      if (classes.length > 0) {
        this.setData({ 
          selectedClassId: classes[0].id,
          selectedClassName: classes[0].name,
        });
        this.loadHomeworks(true);
      }
    } catch (error) {
      const errorHandler = require('../../../lib/error-handler');
      errorHandler.handle(error);
    }
  },

  onShowClassSelector() {
    this.setData({ showClassSelector: true });
  },

  onHideClassSelector() {
    this.setData({ showClassSelector: false });
  },

  onSelectClass(e) {
    const { id, name } = e.currentTarget.dataset;
    this.setData({
      selectedClassId: id,
      selectedClassName: name,
      showClassSelector: false,
    });
    this.loadHomeworks(true);
  },

  onHomeworkTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/homework-detail/index?id=${id}`,
    });
  },

  onAddHomework() {
    wx.navigateTo({
      url: '/pages/teacher/homework-edit/index',
    });
  },
});
```

- [ ] **Step 2: 更新模板添加加载更多状态**

修改 `wechat-miniapp/pages/teacher/homeworks/index.wxml`，在列表底部添加：

```xml
<view class="homework-list">
  <view wx:if="{{loading}}" class="loading">
    <loading-skeleton count="5" />
  </view>

  <view wx:elif="{{error}}" class="error">
    <text class="error-icon">😕</text>
    <text class="error-title">加载失败</text>
    <text class="error-text">{{error}}</text>
    <view class="btn btn-primary" bindtap="onRetry">重新加载</view>
  </view>

  <view wx:elif="{{filteredHomeworks.length === 0}}" class="empty">
    <empty-state
      icon="📝"
      title="暂无作业"
      description="{{activeFilter === 'all' ? '还没有布置作业，点击右下角按钮创建' : '当前筛选条件下没有作业'}}"
      buttonText="{{activeFilter === 'all' ? '创建作业' : ''}}"
      bind:action="onAddHomework"
    />
  </view>

  <view wx:else>
    <view
      wx:for="{{filteredHomeworks}}"
      wx:key="id"
      class="homework-card fade-in clickable-item"
      style="animation-delay: {{index * 0.05}}s"
      data-id="{{item.id}}"
      bindtap="onHomeworkTap"
    >
      <view class="homework-header">
        <text class="homework-title">{{item.title}}</text>
        <view class="status-tag {{item.status}}">{{item.statusText}}</view>
      </view>
      <view class="homework-meta">
        <view class="homework-meta-item">
          <text class="homework-meta-icon">📅</text>
          <text>截止：{{item.dueAtText}}</text>
        </view>
        <view class="homework-meta-item">
          <text class="homework-meta-icon">👥</text>
          <text>提交：{{item.submissionCount || 0}}/{{item.studentCount || 0}}</text>
        </view>
      </view>
    </view>

    <view wx:if="{{loadingMore}}" class="loading-more">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view wx:elif="{{!hasMore && filteredHomeworks.length > 0}}" class="no-more">
      <text>没有更多了</text>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 添加加载更多样式**

在 `wechat-miniapp/pages/teacher/homeworks/index.wxss` 中添加：

```css
.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx;
}

.loading-more .loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-more .loading-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.no-more {
  text-align: center;
  padding: 32rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: 提交小程序分页加载优化**

```bash
git add wechat-miniapp/pages/teacher/homeworks/
git commit -m "feat(miniapp): implement pagination for homeworks list"
```

---

## 验证与测试

### Task 13: 运行后端测试

- [ ] **Step 1: 运行后端单元测试**

```bash
cd apps/backend
pnpm test
```

Expected: 所有测试通过

- [ ] **Step 2: 运行后端 E2E 测试**

```bash
cd apps/backend
pnpm test:e2e
```

Expected: 所有 E2E 测试通过

---

### Task 14: 运行前端构建和测试

- [ ] **Step 1: 运行前端类型检查**

```bash
cd apps/frontend
pnpm typecheck
```

Expected: 无类型错误

- [ ] **Step 2: 运行前端构建**

```bash
cd apps/frontend
pnpm build
```

Expected: 构建成功，无警告

- [ ] **Step 3: 运行前端测试**

```bash
cd apps/frontend
pnpm test
```

Expected: 所有测试通过

---

### Task 15: 最终提交

- [ ] **Step 1: 检查所有更改**

```bash
git status
```

- [ ] **Step 2: 创建优化完成标签**

```bash
git tag -a v1.2.0-optimization -m "feat: project-wide performance optimization phase 1-4"
```

- [ ] **Step 3: 推送所有更改**

```bash
git push origin main --tags
```

---

## 总结

本实施计划涵盖四个阶段的优化工作：

| 阶段 | 任务数 | 预计时间 |
|------|--------|----------|
| 阶段一：快速收益 | 6 个任务 | 1 周 |
| 阶段二：后端深度 | 3 个任务 | 1-2 周 |
| 阶段三：前端深度 | 2 个任务 | 1-2 周 |
| 阶段四：小程序体验 | 1 个任务 | 1 周 |
| 验证与测试 | 3 个任务 | 1-2 天 |

**总任务数**: 15 个
**总预计时间**: 4-6 周
