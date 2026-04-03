# Deployment Stability Design

**Date**: 2026-04-04
**Status**: Approved
**Author**: Claude Code

## Overview

This design document outlines improvements to make the Homework AI system more deployable and stable in single-school deployments, paving the way for future multi-school platform expansion.

## Goals

1. **完善单校部署文档** - Provide comprehensive deployment guides for both Docker and systemd approaches
2. **统一配置入口** - Centralize configuration management with improved structure and validation
3. **关键功能稳定性** - Improve stability of batch upload, queue monitoring, and PDF export
4. **全链路自测清单** - Provide manual testing checklist and automated E2E tests

---

## 1. Deployment Documentation

### 1.1 New Documentation Structure

```
docs/
├── DEPLOY.md           # Existing: systemd deployment
├── DEPLOY-Docker.md    # New: pure Docker deployment
└── DEPLOY-LANDING.md   # New: deployment selection guide
```

### 1.2 DEPLOY-LANDING.md

**Purpose**: Help users choose the right deployment approach.

**Content**:
- Quick comparison table (Docker vs systemd)
- Scenario recommendations
- Pros/cons of each approach
- Links to detailed guides

**Comparison Table**:

| Aspect | Docker | systemd |
|--------|--------|---------|
| Setup Complexity | Low (one command) | Medium (multiple steps) |
| Resource Usage | Higher | Lower |
| Portability | High | Low |
| Production Ready | Yes | Yes |
| Debugging | Harder | Easier |
| Recommended For | Quick start, testing | Production, long-running |

### 1.3 DEPLOY-Docker.md

**Content Sections**:
1. Prerequisites (Docker only)
2. Environment variable configuration
3. One-command startup (`docker-compose up -d`)
4. Health check verification
5. Common issues troubleshooting
6. Backup and restore procedures

**Key Commands**:
```bash
# Startup
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d

# Health check
curl http://localhost/api/health

# View logs
docker compose logs -f api worker

# Backup
docker compose exec mysql mysqldump -u root -p homework_ai > backup.sql
```

### 1.4 DEPLOY.md Enhancements

- Add missing configuration explanations
- Add comparison with Docker approach
- Improve troubleshooting section

---

## 2. Unified Configuration Management

### 2.1 Configuration File Structure

Reorganize `.env.example` into logical groups:

```env
# =============================================================================
# Core Services
# =============================================================================
DATABASE_URL=mysql://...
REDIS_URL=redis://...
JWT_SECRET=...

# =============================================================================
# AI Services
# =============================================================================
LLM_API_KEY=...
LLM_BASE_URL=...
LLM_MODEL=...
BAIDU_OCR_API_KEY=...
BAIDU_OCR_SECRET_KEY=...

# =============================================================================
# Storage & Email
# =============================================================================
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
SMTP_HOST=...
SMTP_PORT=...

# =============================================================================
# Runtime Policies
# =============================================================================
BUDGET_DAILY_LIMIT=...
RETENTION_DAYS=...
WORKER_CONCURRENCY=...
```

### 2.2 Configuration Validator

Create `scripts/config-validator.ts`:

**Features**:
- Validate required fields on startup
- Detect configuration conflicts
- Generate configuration report
- Provide clear error messages

**Usage**:
```bash
# Validate .env before starting
pnpm config:validate

# Auto-fix common issues
pnpm config:validate --fix
```

**Validation Rules**:
- Required fields present
- Valid URL formats
- Password strength (for development warning)
- Port conflicts detection
- File path existence (for fonts, etc.)

### 2.3 Admin Configuration Enhancement

**New Configuration Page Features**:
- Grouped display (AI Services, Storage, Budget, Policies)
- Configuration tooltips and help text
- Reset to default button
- Configuration history (audit log)

**Security Boundaries**:
- Sensitive credentials stay in `.env` (DB_PASS, JWT_SECRET, API keys)
- Admin panel shows "Configured/Not Configured" status only
- Non-sensitive settings manageable from Admin (LLM model, budget limits, retention days)

---

## 3. Critical Function Stability

### 3.1 Batch Upload Streaming

**Problem**: Large ZIP files cause OOM when extracted in memory.

**Solution**: Use `yauzl` library for streaming extraction.

**Implementation**:
```typescript
// Replace unzipper with yauzl
import yauzl from 'yauzl';

async function extractZipStreaming(buffer: Buffer) {
  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = [];
    let totalUncompressedSize = 0;

    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.on('entry', (entry) => {
        // Size validation before extraction
        totalUncompressedSize += entry.uncompressedSize;
        if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
          return reject(new BadRequestException('ZIP too large'));
        }

        // Stream each entry
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) return reject(err);
          // Process stream...
        });
      });

      zipfile.on('end', () => resolve(entries));
    });
  });
}
```

**Benefits**:
- Constant memory usage regardless of ZIP size
- Progress reporting capability
- Early rejection of oversized files

### 3.2 Queue Monitoring Enhancement

**Frontend Queue Monitoring Page** (`/admin/queue`):

**Real-time Display**:
- Queue status (waiting/active/completed/failed counts)
- Worker health status
- Failed jobs list with retry button
- Historical trends chart

**Polling Strategy**:
- Websocket or SSE for real-time updates
- 5-second refresh interval

**Alerting Mechanism**:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Queue backlog | > 100 jobs | Warning |
| Failure rate | > 10% | Warning |
| Worker disconnected | Any | Critical |
| Queue stale | No progress in 5 min | Warning |

**Alert Delivery**:
- Admin dashboard notification
- Optional email/SMS (future)
- Audit log entry

### 3.3 PDF Export Optimization

**Problem**: Chinese font loading is inconsistent across platforms.

**Solution**: Multi-tier font fallback strategy.

**Implementation**:

```typescript
private resolvePdfFont(lang?: string): string {
  if (!this.isZhLang(lang)) return 'Helvetica';

  // 1. Environment variable (highest priority)
  const envFont = process.env.PDF_FONT_PATH;
  if (envFont && existsSync(envFont)) return envFont;

  // 2. Platform-specific fonts
  const candidates = [
    // Windows
    'C:/Windows/Fonts/msyh.ttf',
    'C:/Windows/Fonts/simhei.ttf',
    // macOS
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/PingFang.ttc',
    // Linux
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  ];

  for (const font of candidates) {
    if (existsSync(font)) return font;
  }

  // 3. Bundled fallback (Noto Sans CJK - add to project)
  const bundledFont = path.join(__dirname, '../../assets/fonts/NotoSansCJK-Regular.ttc');
  if (existsSync(bundledFont)) return bundledFont;

  // 4. Final fallback with warning
  this.logger.warn('No CJK font found, Chinese will not display correctly');
  return 'Helvetica';
}
```

**Additional Improvements**:
- Register font once at startup
- Cache resolved font path
- Font validation on startup

---

## 4. Full-Stack Testing

### 4.1 Manual Testing Checklist

Create `docs/TESTING.md` with comprehensive checklist:

**Post-Deployment Verification**:
- [ ] All services running (API, Worker, Nginx, MySQL, Redis, MinIO)
- [ ] Health check endpoints respond
- [ ] Database migrations applied

**Student End**:
- [ ] Login with student account
- [ ] View homework list
- [ ] Submit homework (single image)
- [ ] Submit homework (multiple images)
- [ ] View submission result
- [ ] View submission history
- [ ] View learning report

**Teacher End**:
- [ ] Login with teacher account
- [ ] Create homework
- [ ] Edit homework
- [ ] View class submissions
- [ ] Batch upload (single images)
- [ ] Batch upload (ZIP file)
- [ ] View submission details
- [ ] View class report
- [ ] View student report
- [ ] Create announcement
- [ ] Configure grading policy

**Admin End**:
- [ ] Login with admin account
- [ ] View system metrics
- [ ] View/manage users
- [ ] Export user CSV
- [ ] Test LLM connection
- [ ] Test OCR connection
- [ ] View queue metrics
- [ ] Retry failed jobs
- [ ] Update system configuration
- [ ] View audit logs

### 4.2 Automated E2E Test Suite

Create `apps/backend/e2e/` directory:

**Test Files**:
- `auth.e2e.spec.ts` - Authentication flow
- `submission.e2e.spec.ts` - Complete submission and grading flow
- `batch-upload.e2e.spec.ts` - Batch upload functionality
- `report.e2e.spec.ts` - Report generation (CSV, PDF)

**Example Test Structure**:
```typescript
describe('Submission E2E', () => {
  it('should complete full submission and grading flow', async () => {
    // 1. Student login
    // 2. Create homework (as teacher)
    // 3. Upload submission (as student)
    // 4. Wait for grading (poll status)
    // 5. Verify grading result
    // 6. Verify report generation
  });
});
```

**Test Commands**:
```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test
pnpm test:e2e submission.e2e.spec.ts

# Run with coverage
pnpm test:e2e --coverage
```

---

## Implementation Phases

| Phase | Tasks | Priority | Estimate |
|-------|-------|----------|----------|
| **Phase 1** | Configuration file optimization + validator | High | 1-2 days |
| **Phase 2** | Docker deployment documentation | High | 1 day |
| **Phase 3** | Batch upload streaming | High | 2-3 days |
| **Phase 4** | Queue monitoring page + alerts | Medium | 2-3 days |
| **Phase 5** | PDF export optimization | Medium | 1 day |
| **Phase 6** | Manual testing checklist | Medium | 1 day |
| **Phase 7** | Automated E2E tests | Low | 3-4 days |

**Total Estimate**: 11-17 days

---

## Success Criteria

1. New user can deploy using Docker in under 30 minutes
2. All configuration clearly documented with validation
3. ZIP files up to 100MB process reliably
4. Queue issues detected and alerted automatically
5. PDF exports work on Windows/macOS/Linux without manual font configuration
6. Complete testing coverage for all user roles

---

## Open Questions

None at this time.

---

## References

- Current deployment: `docs/DEPLOY.md`
- Docker configs: `deploy/docker-compose.yml`, `deploy/docker-compose.prod.yml`
- Configuration: `apps/backend/.env.example`
- Roadmap: `docs/future-roadmap.md`
