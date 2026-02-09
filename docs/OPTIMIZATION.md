# Optimization Guide

This guide covers actionable performance, bundle size, and efficiency improvements for the Homework AI monorepo. Items are organized by priority and grouped by subsystem.

---

## Table of Contents

- [Quick Wins (< 1 hour each)](#quick-wins)
- [Backend: Database & Query Optimization](#backend-database--query-optimization)
- [Backend: Worker & Async Processing](#backend-worker--async-processing)
- [Backend: Caching & Compute](#backend-caching--compute)
- [Frontend: Bundle Size Reduction](#frontend-bundle-size-reduction)
- [Frontend: Rendering & React Performance](#frontend-rendering--react-performance)
- [Frontend: Network & API Efficiency](#frontend-network--api-efficiency)
- [Infrastructure](#infrastructure)

---

## Quick Wins

These deliver the most impact for the least effort. Implement first.

### 1. Parallelize Batch Queue Enqueuing

**File:** `apps/backend/src/submissions/submissions.service.ts`

The `regradeHomeworkSubmissions` and `regradeBatchSubmissions` methods enqueue grading jobs inside a sequential `for` loop. Each `enqueueRegrade` call waits for Redis round-trip before moving to the next.

```typescript
// BEFORE — sequential (~50ms × N submissions)
for (const id of ids) {
  await this.queueService.enqueueRegrade(id, { mode, needRewrite });
}

// AFTER — parallel (~50ms total)
await Promise.all(
  ids.map((id) =>
    this.queueService.enqueueRegrade(id, { mode, needRewrite }),
  ),
);
```

**Impact:** 100 submissions: ~5 s → ~50 ms.

---

### 2. Parallelize OCR Image Processing in Worker

**File:** `apps/backend/src/worker/grading.processor.ts` (lines 134-156)

Images are fetched from storage and OCR-processed one at a time. Since Baidu OCR is an external HTTP call, all images can be processed concurrently.

```typescript
// BEFORE — sequential
for (let i = 0; i < submission.images.length; i++) {
  const imageBuffer = await this.storage.getObject(image.objectKey);
  const ocrResult = await this.baiduOcrService.recognize(imageBuffer, ocrConfig);
}

// AFTER — parallel
const ocrResults = await Promise.allSettled(
  submission.images.map(async (image, i) => {
    const imageBuffer = await this.storage.getObject(image.objectKey);
    return this.baiduOcrService.recognize(imageBuffer, ocrConfig);
  }),
);
// Then iterate ocrResults, filter fulfilled vs rejected
```

**Impact:** 3 images × 150 ms = 450 ms → ~150 ms. Applies to every single submission.

---

### 3. Increase React Query `staleTime` for Stable Data

**File:** `apps/frontend/src/main.tsx` (line 18)

The global default `staleTime` is 60 s. Data like class lists and homework definitions rarely change, but the app re-fetches them on every page navigation after 1 minute.

```typescript
// Set per-query staleTime where appropriate:
// Classes, user profile → 10 minutes
// Homework list → 5 minutes
// Submission status → 30 seconds (already fine)
useQuery({
  queryKey: ['classes'],
  queryFn: fetchClasses,
  staleTime: 10 * 60 * 1000, // 10 min — this data rarely changes
});
```

**Impact:** Reduces redundant API calls by ~30-50% during normal usage.

---

### 4. Parallelize S3 Deletions in Image Cleanup

**File:** `apps/backend/src/submissions/submissions.service.ts` — `cleanupOldSubmissionImages()`

Old submission images are deleted sequentially inside a loop. Use `Promise.allSettled` for concurrent deletion.

```typescript
// BEFORE
for (const image of images) {
  await this.storage.deleteObject(image.objectKey);
}

// AFTER
await Promise.allSettled(
  images.map((image) => this.storage.deleteObject(image.objectKey)),
);
```

---

### 5. Add Missing Composite Database Index

**File:** `apps/backend/prisma/schema.prisma`

The `Submission` model already has `@@index([homeworkId, status])`, but common query patterns also filter by `(studentId, homeworkId)` together (e.g., the duplicate submission check, student submission listing). Add:

```prisma
model Submission {
  // ... existing indexes ...
  @@index([studentId, homeworkId])  // createSubmission duplicate check + student listing
}
```

Run `pnpm prisma:migrate` after adding. Check query plans with `EXPLAIN` to verify impact.

---

## Backend: Database & Query Optimization

### 6. Batch Late-Submission Config Lookups (N+1)

**File:** `apps/backend/src/homeworks/homeworks.service.ts` — `getLateSubmissionMap()`

Currently calls `systemConfigService.getValue()` once per homework ID, producing N queries for N homeworks.

**Fix:** Fetch all relevant config keys in a single query:

```typescript
// Fetch all late_submission config entries at once
const keys = uniqueIds.map((id) => `${lateSubmissionConfigKey}:${id}`);
const configs = await this.prisma.systemConfig.findMany({
  where: { key: { in: keys } },
});
const map = new Map(configs.map((c) => [c.key.replace(`${lateSubmissionConfigKey}:`, ''), c.value]));
```

---

### 7. Reduce Admin Metrics Query Count

**File:** `apps/backend/src/admin/admin.service.ts` — `getMetrics()` (lines 75-95)

Nine separate `COUNT(*)` queries run in parallel. For large tables this is expensive. Consolidate using `groupBy`:

```typescript
// BEFORE — 4 separate user counts
const [usersTotal, usersStudents, usersTeachers, usersAdmins] = await Promise.all([
  this.prisma.user.count(),
  this.prisma.user.count({ where: { role: 'STUDENT' } }),
  this.prisma.user.count({ where: { role: 'TEACHER' } }),
  this.prisma.user.count({ where: { role: 'ADMIN' } }),
]);

// AFTER — single query
const usersByRole = await this.prisma.user.groupBy({
  by: ['role'],
  _count: { _all: true },
});
const usersTotal = usersByRole.reduce((sum, g) => sum + g._count._all, 0);
```

Reduces 4 queries → 1 query. Apply the same approach to submission counts.

---

### 8. Implement Cursor-Based Pagination for Large Lists

**Files:** `submissions.service.ts`, `admin.service.ts`

Several endpoints use `take: 500-5000` without cursor. For large result sets, offset-based pagination degrades because the database still scans skipped rows.

```typescript
// Cursor-based pagination pattern
const submissions = await this.prisma.submission.findMany({
  where: { homeworkId },
  orderBy: { updatedAt: 'desc' },
  take: 50,
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
});
```

Apply to: `listHomeworkSubmissions`, `listBatchUploads`, `admin.listUsers`.

---

### 9. Select Only Required Fields

**File:** `apps/backend/src/submissions/submissions.service.ts`

Several queries use `include` to fetch related models, pulling entire objects when only a few fields are needed. Switching from `include` to `select` reduces payload size and DB transfer.

```typescript
// BEFORE
include: { student: { select: { id: true, name: true, account: true } } }

// This is already good. But check exportHomeworkCsv which uses full include:
const submissions = await this.prisma.submission.findMany({
  where: { homeworkId },
  include: { student: { select: { id: true, name: true, account: true } } },
  // gradingJson is fetched but only extractGrading() needs a few fields from it
});
```

For CSV export, `gradingJson` can be very large (10-50 KB per record × 5000 records = 50-250 MB in memory). Consider processing in batches of 100.

---

## Backend: Worker & Async Processing

### 10. Distribute OCR Token Cache via Redis

**File:** `apps/backend/src/ocr/baidu-ocr.service.ts`

The Baidu OCR access token is cached in-memory per process. If multiple workers run, each independently requests a token.

```typescript
// Store token in Redis (shared across all worker instances)
async getAccessToken(config: BaiduOcrConfig): Promise<string> {
  const cached = await this.redis.get('baidu:ocr:token');
  if (cached) return cached;

  const token = await this.requestNewToken(config);
  await this.redis.setex('baidu:ocr:token', 86400, token); // 24h TTL
  return token;
}
```

---

### 11. Add Submission Processing Backoff for Polling

**File:** `apps/frontend/src/pages/student/SubmissionResult.tsx` (line 53-59)

Polling runs at a fixed 2-second interval regardless of how long the job has been processing. For submissions that take >2 minutes, this generates unnecessary load.

```typescript
// Exponential backoff: 2s → 4s → 8s → ... max 15s
refetchInterval: (query) => {
  const data = query.state.data as { status: SubmissionStatus } | undefined;
  if (!data || data.status === 'DONE' || data.status === 'FAILED') return false;
  const elapsed = Date.now() - (query.state.dataUpdatedAt || Date.now());
  return Math.min(2000 * Math.pow(2, Math.floor(elapsed / 30000)), 15000);
},
```

---

## Backend: Caching & Compute

### 12. Cache Class Overview Report Data

**File:** `apps/backend/src/reports/reports.service.ts` — `getClassOverview()`

This endpoint aggregates scores, distributions, trends, and error types across all submissions. The computation is expensive for large classes but the underlying data only changes when grading completes.

**Strategy:** Cache the result in Redis with a 2-minute TTL, invalidated when a grading job completes for the class.

```typescript
const cacheKey = `report:class:${classId}:${days}`;
const cached = await this.redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await this.computeClassOverview(classId, days, user);
await this.redis.setex(cacheKey, 120, JSON.stringify(result));
return result;
```

---

### 13. Cache Landing Page Payload Client-Side

**File:** `apps/backend/src/public/public.service.ts`

The landing page payload is already cached server-side (6-hour TTL in SystemConfig). Add HTTP cache headers so browsers and CDNs cache it too:

```typescript
// In public.controller.ts
@Get('landing')
async landing(@Query() query, @Res({ passthrough: true }) res: Response) {
  const data = await this.publicService.getLanding(query);
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour browser cache
  return data;
}
```

---

## Frontend: Bundle Size Reduction

### 14. Dynamic Import for PDF and Chart Libraries

**File:** `apps/frontend/vite.config.ts`

The `manualChunks` config separates `echarts` (400 KB gzip) and `html2canvas + jspdf` (300 KB gzip) into dedicated chunks, but they are still loaded eagerly when their chunk is first referenced.

Ensure these are loaded on-demand at the component level:

```typescript
// In report components, use dynamic import:
const exportPdf = async () => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  // ... use them
};
```

Since routes already use `lazy()`, the `vendor-charts` and `vendor-pdf` chunks should only load when the user navigates to report pages. Verify by checking the network tab.

---

### 15. Optimize Ant Design Chunk

**File:** `apps/frontend/vite.config.ts` (line 32)

`@ant-design/pro-components` is bundled with `antd` in a single chunk, which can exceed 1 MB gzipped. Split them:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-antd': ['antd', '@ant-design/icons'],
  'vendor-antd-pro': ['@ant-design/pro-components'],
  'vendor-charts': ['echarts'],
  'vendor-pdf': ['html2canvas', 'jspdf'],
},
```

Also add a build target for modern browsers to reduce polyfills:

```typescript
build: {
  target: 'es2020',
  // ...
},
```

---

### 16. Split Large Page Components

These pages exceed 1000 lines and bundle significant logic that delays initial render:

| File | Lines | Suggested Extraction |
|------|-------|---------------------|
| `pages/teacher/HomeworkDetail.tsx` | 1,511 | `SubmissionTable`, `BatchUploadPanel`, `GradingPolicySection` |
| `pages/admin/Config.tsx` | 1,018 | `LlmProviderConfig`, `OcrConfigPanel`, `BudgetSettings` |
| `pages/Landing.tsx` | 1,277 | `HeroSection`, `FeaturesGrid`, `FaqSection`, `ConsultForm` |

Extract into separate files and co-locate with the parent page. This improves tree-shaking and makes future lazy-loading possible.

---

### 17. Split i18n by Feature Module

**File:** `apps/frontend/src/i18n.ts` (1,655 lines)

The entire translation dictionary for both locales is loaded upfront. Split by feature:

```
src/i18n/
  index.ts          // Core i18n setup + common translations
  zh-CN/
    student.ts
    teacher.ts
    admin.ts
  en-US/
    student.ts
    teacher.ts
    admin.ts
```

Lazy-load role-specific translations after login:

```typescript
const loadTranslations = async (role: string) => {
  const mod = await import(`./i18n/${language}/${role}.ts`);
  mergeTranslations(mod.default);
};
```

---

## Frontend: Rendering & React Performance

### 18. Memoize Computed Dashboard Data

**Files:** `pages/student/Dashboard.tsx`, `pages/teacher/Dashboard.tsx`

Summary card arrays, chart data, and table configurations are recreated on every render even when the underlying data hasn't changed.

```typescript
// BEFORE — recreated every render
const summaryCards = [
  { key: 'total', title: t('dashboard.total'), value: data?.total ?? 0 },
  // ...
];

// AFTER — only when data changes
const summaryCards = useMemo(() => [
  { key: 'total', title: t('dashboard.total'), value: data?.total ?? 0 },
  // ...
], [data, t]);
```

Apply the same to table column definitions, chart option objects, and filter configurations.

---

### 19. Add Image Lazy Loading

Add `loading="lazy"` to all `<img>` tags that appear below the fold, especially in:

- Submission image galleries
- Batch upload preview grids
- Landing page sections

```tsx
<img src={url} loading="lazy" alt={alt} />
```

For batch upload preview with 30+ thumbnails, consider virtual scrolling with `react-window` if scroll performance is an issue.

---

### 20. Batch React Query Cache Invalidation

**File:** `pages/teacher/Homeworks.tsx` and similar

Multiple sequential `invalidateQueries` calls trigger separate re-renders:

```typescript
// BEFORE — two re-renders
await queryClient.invalidateQueries({ queryKey: ['homeworks-summary', classId] });
await queryClient.invalidateQueries({ queryKey: ['homeworks', classId] });

// AFTER — single re-render
queryClient.invalidateQueries({
  predicate: (query) =>
    Array.isArray(query.queryKey) &&
    typeof query.queryKey[0] === 'string' &&
    query.queryKey[0].startsWith('homeworks') &&
    query.queryKey[1] === classId,
});
```

---

## Infrastructure

### 21. Enable Gzip/Brotli Compression in Nginx

**File:** `deploy/nginx/nginx.conf`

If not already configured, add compression for API responses and static assets:

```nginx
gzip on;
gzip_types text/plain application/json text/csv application/pdf application/javascript text/css;
gzip_min_length 1000;
gzip_comp_level 6;
```

For static assets served by Vite, enable Brotli in the build:

```bash
pnpm add -D vite-plugin-compression
```

### 22. Add Redis Memory Policy

**File:** `deploy/docker-compose.yml`

Ensure Redis has an eviction policy for when memory fills up:

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

---

## Priority Matrix

| # | Item | Impact | Effort | Priority |
|---|------|--------|--------|----------|
| 1 | Parallelize batch enqueue | High | 30 min | P0 |
| 2 | Parallelize OCR processing | High | 45 min | P0 |
| 3 | Increase React Query staleTime | Medium | 15 min | P0 |
| 4 | Parallelize S3 deletions | Medium | 15 min | P0 |
| 5 | Add composite DB index | Medium | 15 min | P0 |
| 6 | Batch late-submission lookups | Medium | 1 hr | P1 |
| 7 | Consolidate admin metrics | Medium | 1 hr | P1 |
| 8 | Cursor-based pagination | Medium | 3 hr | P1 |
| 9 | Select only required fields | Low | 2 hr | P2 |
| 10 | Distributed OCR token cache | Low | 1 hr | P2 |
| 11 | Polling backoff | Low | 30 min | P2 |
| 12 | Cache class reports | Medium | 1.5 hr | P1 |
| 13 | Landing page HTTP cache | Low | 15 min | P2 |
| 14 | Dynamic import PDF/charts | Medium | 1 hr | P1 |
| 15 | Split antd-pro chunk | Medium | 30 min | P1 |
| 16 | Split large components | Medium | 4 hr | P2 |
| 17 | Split i18n by module | Low | 2 hr | P2 |
| 18 | Memoize dashboard data | Medium | 1 hr | P1 |
| 19 | Image lazy loading | Low | 30 min | P2 |
| 20 | Batch cache invalidation | Low | 30 min | P2 |
| 21 | Nginx compression | Medium | 15 min | P1 |
| 22 | Redis eviction policy | Low | 5 min | P2 |

**Estimated total impact from P0 items alone:** Worker throughput +2-3x, page load 30-50% faster, API calls reduced ~30%.
