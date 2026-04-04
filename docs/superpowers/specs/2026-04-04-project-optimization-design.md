# 项目整体优化设计文档

**日期**: 2026-04-04
**状态**: 待审核
**作者**: Claude Code

## 概述

本文档定义了 Homework AI 项目的整体优化策略，涵盖后端性能、前端性能和小程序体验三个方向，采用分阶段渐进式优化方法。

## 目标指标

| 指标 | 当前基线 | 目标 | 优化幅度 |
|------|----------|------|----------|
| 后端 API P95 响应时间 | 待测量 | 下降 20%+ | - |
| Worker 吞吐量 | 待测量 | 提升 30%+ | - |
| 前端首屏加载时间 | 待测量 | 下降 20%+ | - |
| 前端打包体积 | 待测量 | 下降 15%+ | - |
| 小程序首屏时间 | 待测量 | 下降 20%+ | - |

---

## 阶段一：快速收益优化（1周内）

### 1.1 后端快速优化

#### 1.1.1 补充数据库联合索引

**现状分析**：
当前 schema.prisma 已有 28 个索引，但缺少部分高频查询的联合索引。

**优化项**：

```prisma
// Submission 模型新增联合索引
model Submission {
  // ... 现有字段
  
  @@index([homeworkId, status, updatedAt])  // 作业提交列表排序查询
  @@index([studentId, createdAt])            // 学生提交历史查询
  @@index([status, updatedAt])               // 状态+时间筛选
}

// LlmCallLog 模型新增联合索引
model LlmCallLog {
  // ... 现有字段
  
  @@index([source, createdAt])               // 按来源查询日志
  @@index([status, createdAt])               // 按状态查询日志
}
```

**预期收益**：高频查询响应时间下降 30-50%。

#### 1.1.2 批量入队并行化

**现状分析**：
`regradeHomeworkSubmissions` 和 `regradeBatchSubmissions` 已使用并发入队（ENQUEUE_CONCURRENCY = 20），但可进一步优化。

**优化项**：
```typescript
// 将 ENQUEUE_CONCURRENCY 从 20 提升到 50
const ENQUEUE_CONCURRENCY = 50;

// 使用 Promise.allSettled 替代 Promise.all 避免单点失败
const results = await Promise.allSettled(
  chunk.map((id) => this.queueService.enqueueRegrade(id, resolvedPolicy))
);
// 记录失败项
const failures = results.filter(r => r.status === 'rejected');
if (failures.length > 0) {
  this.logger.warn(`Failed to enqueue ${failures.length} jobs`);
}
```

**预期收益**：批量操作耗时下降 40%。

#### 1.1.3 OCR Token 缓存

**现状分析**：
百度 OCR Token 有效期为 30 天，但每次调用都可能重新获取。

**优化项**：
```typescript
// 在 BaiduOcrService 中添加 Redis 缓存
async getAccessToken(): Promise<string> {
  const cacheKey = 'baidu_ocr_token';
  const cached = await this.redis.get(cacheKey);
  if (cached) return cached;
  
  const token = await this.fetchNewToken();
  // 缓存 29 天（留 1 天缓冲）
  await this.redis.setex(cacheKey, 29 * 24 * 60 * 60, token);
  return token;
}
```

**预期收益**：OCR 调用延迟下降 100-200ms。

### 1.2 前端快速优化

#### 1.2.1 React Query 参数统一

**现状分析**：
前端有 131 个 useQuery 调用，需要检查 staleTime/gcTime 配置是否一致。

**优化项**：
```typescript
// 创建统一的 QueryClient 配置
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 分钟内不重新请求
      gcTime: 30 * 60 * 1000,       // 30 分钟后清理缓存
      retry: 1,                      // 失败只重试 1 次
      refetchOnWindowFocus: false,   // 窗口聚焦不重新请求
    },
  },
});
```

**预期收益**：减少 30-50% 的重复请求。

#### 1.2.2 前端图表懒加载

**现状分析**：
ECharts 已单独分包（vendor-charts），但图表组件可能未懒加载。

**优化项**：
```typescript
// 使用 React.lazy 懒加载图表组件
const ReportChart = React.lazy(() => import('./ReportChart'));

// 在页面中使用
<Suspense fallback={<ChartSkeleton />}>
  <ReportChart data={data} />
</Suspense>
```

**预期收益**：首屏 JS 体积减少约 200KB。

#### 1.2.3 路由级懒加载

**现状分析**：
Vite 已配置手动分包，但需要确认路由组件是否懒加载。

**优化项**：
```typescript
// router.tsx 中使用懒加载
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const TeacherReport = lazy(() => import('@/pages/teacher/Report'));
// ... 其他页面
```

**预期收益**：首屏加载时间下降 20%。

### 1.3 小程序快速优化

#### 1.3.1 图片懒加载

**优化项**：
```xml
<!-- 所有图片组件添加 lazy-load -->
<image lazy-load src="{{item.imageUrl}}" mode="aspectFill" />
```

**预期收益**：列表滚动流畅度提升 30%。

#### 1.3.2 数据缓存

**优化项**：
```javascript
// lib/cache.js 已存在，需要在页面中应用
const cache = require('../../lib/cache');

async loadData() {
  const cacheKey = `homeworks_${this.data.classId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    this.setData({ homeworks: cached });
    return;
  }
  
  const data = await fetchHomeworks(this.data.classId);
  cache.set(cacheKey, data, 5 * 60 * 1000); // 5 分钟缓存
  this.setData({ homeworks: data });
}
```

**预期收益**：减少 50% 的重复请求。

---

## 阶段二：后端深度优化（1-2周）

### 2.1 数据库查询优化

#### 2.1.1 避免 N+1 查询

**现状分析**：
`submissions.service.ts` 中部分查询可能存在 N+1 问题。

**优化项**：
```typescript
// 使用 include 一次性获取关联数据
const submissions = await this.prisma.submission.findMany({
  where: { homeworkId },
  include: {
    student: { select: { id: true, name: true, account: true } },
    images: { select: { id: true, objectKey: true } },
    homework: { select: { id: true, title: true, classId: true } },
  },
});
```

#### 2.1.2 列表接口不返回大字段

**优化项**：
```typescript
// 列表接口排除 ocrText 和 gradingJson
const submissions = await this.prisma.submission.findMany({
  where: { homeworkId },
  select: {
    id: true,
    status: true,
    totalScore: true,
    updatedAt: true,
    student: { select: { id: true, name: true, account: true } },
    // 不包含 ocrText, gradingJson
  },
});
```

**预期收益**：列表接口响应体积下降 80%。

#### 2.1.3 游标分页替代偏移分页

**现状分析**：
部分列表接口使用 `take` + `skip` 分页，深分页性能差。

**优化项**：
```typescript
// 使用游标分页
async listHomeworkSubmissions(homeworkId: string, cursor?: string, limit = 20) {
  return this.prisma.submission.findMany({
    where: { homeworkId },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { updatedAt: 'desc' },
  });
}
```

### 2.2 Worker 优化

#### 2.2.1 动态并发调整

**现状分析**：
WORKER_CONCURRENCY 默认为 5，可能未充分利用服务器资源。

**优化项**：
```typescript
// 根据 CPU 核心数动态设置并发
const DEFAULT_CONCURRENCY = Math.min(os.cpus().length * 2, 10);

// 在 worker 配置中使用
const concurrency = Number(process.env.WORKER_CONCURRENCY) || DEFAULT_CONCURRENCY;
```

#### 2.2.2 任务优先级队列

**优化项**：
```typescript
// 创建高优先级队列用于单个提交
await this.queueService.add('grading', data, {
  priority: isBatch ? 1 : 10, // 单个提交优先级更高
});
```

### 2.3 可观测性增强

#### 2.3.1 结构化日志

**优化项**：
```typescript
// 统一日志格式
this.logger.log({
  msg: 'Submission graded',
  submissionId,
  durationMs,
  status,
  retryCount,
  timestamp: new Date().toISOString(),
});
```

#### 2.3.2 性能指标上报

**优化项**：
```typescript
// 添加 Prometheus 指标
const gradingDuration = new Histogram({
  name: 'grading_duration_seconds',
  help: 'Grading duration in seconds',
  buckets: [1, 5, 10, 30, 60, 120],
});

// 在 worker 中记录
const timer = gradingDuration.startTimer();
// ... grading logic
timer();
```

---

## 阶段三：前端深度优化（1-2周）

### 3.1 构建优化

#### 3.1.1 分析打包体积

**优化项**：
```bash
# 添加分析脚本
pnpm add -D rollup-plugin-visualizer

# vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),
  ],
});
```

#### 3.1.2 优化第三方库

**优化项**：
```typescript
// 替换大体积库
// lodash -> lodash-es (tree-shaking)
import { debounce } from 'lodash-es';

// moment.js -> dayjs (体积减少 ~70KB)
import dayjs from 'dayjs';
```

### 3.2 渲染优化

#### 3.2.1 虚拟列表

**优化项**：
```typescript
// 使用 @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';

function SubmissionList({ submissions }) {
  const virtualizer = useVirtualizer({
    count: submissions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <div key={item.key} style={{ position: 'absolute', transform: `translateY(${item.start}px)` }}>
            {/* 渲染项 */}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3.2.2 useMemo/useCallback 优化

**优化项**：
```typescript
// 避免在渲染中创建新对象/函数
function HomeworkCard({ homework, onSelect }) {
  // 缓存计算结果
  const statusText = useMemo(() => 
    getStatusText(homework.status), [homework.status]
  );
  
  // 缓存回调函数
  const handleClick = useCallback(() => {
    onSelect(homework.id);
  }, [homework.id, onSelect]);
  
  return <Card onClick={handleClick}>{statusText}</Card>;
}
```

### 3.3 请求优化

#### 3.3.1 并行请求

**优化项**：
```typescript
// 页面加载时并行请求多个数据
function Dashboard() {
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: fetchClasses });
  const { data: homeworks } = useQuery({ queryKey: ['homeworks'], queryFn: fetchHomeworks });
  
  // 或使用 Promise.all
  const [classes, homeworks] = await Promise.all([
    fetchClasses(),
    fetchHomeworks(),
  ]);
}
```

#### 3.3.2 请求去重

**优化项**：
```typescript
// 使用 React Query 的内置去重
useQuery({
  queryKey: ['submission', id],
  queryFn: () => fetchSubmission(id),
  staleTime: 30000, // 30 秒内不重复请求
});
```

---

## 阶段四：小程序体验优化（1-2周）

### 4.1 UI/UX 优化

#### 4.1.1 骨架屏组件

**优化项**：
已有 `components/loading-skeleton/`，需要在所有列表页面应用。

#### 4.1.2 空状态组件

**优化项**：
已有 `components/empty-state/`，需要提供引导操作。

#### 4.1.3 帮助提示系统

**优化项**：
已有 `lib/help.js`，需要在关键页面添加帮助入口。

### 4.2 性能优化

#### 4.2.1 分页加载

**优化项**：
```javascript
// 实现触底加载更多
onReachBottom() {
  if (this.data.hasMore && !this.data.loadingMore) {
    this.loadData();
  }
}
```

#### 4.2.2 搜索防抖

**优化项**：
```javascript
// 使用 lib/utils.js 中的 debounce
const { debounce } = require('../../lib/utils');

onLoad() {
  this.debouncedSearch = debounce(this.performSearch, 300);
}

onSearchInput(e) {
  this.setData({ searchText: e.detail.value });
  this.debouncedSearch();
}
```

### 4.3 错误处理

#### 4.3.1 统一错误处理

**优化项**：
已有 `lib/error-handler.js`，需要在所有 API 调用处应用。

---

## 实施计划

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|----------|--------|
| 阶段一 | 快速收益优化 | 1 周 | 高 |
| 阶段二 | 后端深度优化 | 1-2 周 | 高 |
| 阶段三 | 前端深度优化 | 1-2 周 | 高 |
| 阶段四 | 小程序体验优化 | 1-2 周 | 中 |

**总预计时间**：4-7 周

---

## 验收标准

### 后端
- [ ] P95 响应时间下降 20%+
- [ ] Worker 吞吐量提升 30%+
- [ ] 数据库慢查询数量下降 50%+

### 前端
- [ ] 首屏加载时间下降 20%+
- [ ] 打包体积下降 15%+
- [ ] Lighthouse 性能分数提升 15+

### 小程序
- [ ] 首屏时间下降 20%+
- [ ] 列表滚动帧率 > 50fps
- [ ] 错误率下降 30%+

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 索引变更影响写入性能 | 中 | 在低峰期执行迁移 |
| 缓存一致性问题 | 高 | 设置合理的 TTL + 主动失效 |
| 前端改动引入 bug | 中 | 充分测试 + 灰度发布 |
| 小程序审核延迟 | 低 | 提前规划发布时间 |

---

## 参考资料

- [docs/OPTIMIZATION.md](../OPTIMIZATION.md) - 现有优化指南
- [docs/superpowers/specs/2026-04-03-teacher-miniapp-optimization-design.md](./2026-04-03-teacher-miniapp-optimization-design.md) - 小程序优化设计
- [docs/superpowers/specs/2026-04-04-deployment-stability-design.md](./2026-04-04-deployment-stability-design.md) - 部署稳定性设计
