# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Homework AI** - An AI-powered English essay grading system. Students upload handwritten homework images (1-3 photos per submission), processed through OCR (Baidu OCR) and graded by AI (DeepSeek LLM). Three user roles: STUDENT, TEACHER, ADMIN.

**Monorepo**: pnpm workspaces with `apps/backend` (NestJS) and `apps/frontend` (React + Vite).

## Development Commands

### Root Level
```bash
pnpm dev:frontend    # Start frontend dev server (port 3001, proxied via Nginx on port 80)
pnpm dev:backend     # Start API server (port 3000, proxied via Nginx)
pnpm dev:worker      # Start background worker for async grading
pnpm build           # Build all apps
pnpm lint            # Lint all apps
pnpm typecheck       # TypeScript type check all apps
pnpm test            # Run backend tests
pnpm test:cov        # Run backend tests with coverage
```

### Backend (apps/backend/)
```bash
pnpm start:dev       # Start API server with hot-reload
pnpm start:worker:dev # Start worker process
pnpm build           # Build for production
pnpm test            # Run Jest tests
pnpm test:watch      # Run tests in watch mode
pnpm test:cov        # Run tests with coverage
pnpm prisma:generate # Generate Prisma client
pnpm prisma:migrate  # Run database migrations
```

### Frontend (apps/frontend/)
```bash
pnpm dev             # Start Vite dev server (port 3001)
pnpm build           # Build for production
pnpm preview         # Preview production build
pnpm lint            # ESLint
pnpm test            # Run Vitest tests
pnpm test:watch      # Run tests in watch mode
pnpm test:cov        # Run tests with coverage
```

### Running Single Tests
```bash
# Backend: Run a specific test file
pnpm --filter backend test -- path/to/file.spec.ts

# Frontend: Run a specific test file
pnpm --filter frontend test -- path/to/file.test.ts
```

## Startup Scripts

- `start-services.bat` - Main startup script for Windows (supports `--skip-docker` flag)
- `restart-services.ps1` - PowerShell version with more features
- `scripts/check-ports.bat` - Auto-fixes nginx port configuration
- `pnpm handover:package` - Create deployment package for handover
- `pnpm handover:package:with-accounts` - Include test accounts file in package

## Critical Architecture: Grading Workflow

```
1. Student uploads images → API creates Submission (QUEUED)
2. BullMQ enqueue('grading', { submissionId, mode, needRewrite })
3. Worker picks up job:
   - OCR: Baidu OCR for text recognition (stored in submission.ocrText)
   - LLM: DeepSeek grades the text (result in submission.gradingJson)
   - Status updates: QUEUED → PROCESSING → DONE/FAILED
4. Results saved to DB with totalScore
```

**CRITICAL**: Worker process MUST be running for submissions to be processed. QUEUED submissions won't auto-process without it.

## Backend Module Reference

| Module | Purpose |
|--------|---------|
| `src/auth/` | JWT authentication with Passport |
| `src/queue/` | BullMQ queue management (grades queue) |
| `src/worker/` | Background worker entry point (`src/worker/main.ts`) |
| `src/grading/` | DeepSeek LLM integration |
| `src/ocr/` | Baidu OCR service |
| `src/storage/` | MinIO S3-compatible file storage |
| `src/retention/` | Scheduled data cleanup (7-day retention) |
| `src/public/` | Public endpoints (landing page) |
| `src/submissions/` | Student/Teacher submission CRUD |
| `src/homeworks/` | Homework management |
| `src/classes/` | Class & enrollment management |
| `src/admin/` | Admin dashboard endpoints |
| `src/reports/` | PDF/CSV export functionality |

## Frontend Structure Reference

| Path | Purpose |
|------|---------|
| `src/pages/student/` | Student dashboard, homework submission, results |
| `src/pages/teacher/` | Teacher dashboard, batch upload, grading review |
| `src/pages/admin/` | System administration |
| `src/layouts/` | Layout components for each role |
| `src/routes/router.tsx` | React Router v6 configuration |
| `src/i18n.ts` | Chinese/English translations (single file) |
| `src/api/` | API client functions (modularized) |

## WeChat Mini-Program

Located in `wechat-miniapp/` - Independent WeChat mini-program for students with **Rainbow World** theme design.

### Design System

- **Theme**: Rainbow World (活泼有趣风格) - colorful gradients, rounded corners, playful animations
- **Page Themes**: Each page has a unique gradient color scheme (purple, pink, blue, green, orange, teal-pink)
- **Style Files**:
  - `styles/theme.wxss` - CSS variables and theme definitions
  - `styles/components.wxss` - Reusable components (buttons, cards, tags)
  - `styles/animations.wxss` - Animation effects (fadeIn, scaleIn, spin, pulse)

### Pages

- `pages/login/` - Student login (purple welcome theme)
- `pages/homeworks/` - Homework list (purple gradient)
- `pages/submit/` - Submit homework (pink gradient)
- `pages/submission-result/` - Grading results (blue gradient)
- `pages/submissions/` - Submission history (blue gradient)
- `pages/homework-detail/` - Homework details (purple gradient)
- `pages/profile/` - Personal center (green gradient)
- `pages/messages/` - Notifications (orange-pink gradient)
- `pages/report/` - Learning reports (teal-pink gradient)

### Components

- `components/gradient-button/` - Gradient button component

### Documentation

See `docs/WECHAT_MINIAPP.md` for detailed mini-program documentation.

## Database Schema (Prisma)

**Core Models**:
- `User` - Three roles: STUDENT, TEACHER, ADMIN
- `Class` - School classes with teacher-student relationships
- `Enrollment` - Many-to-many between Class and User
- `Homework` - Assignments linked to Class
- `Submission` - Student homework submissions with images
- `BatchUpload` - Teacher bulk upload tracking
- `SubmissionImage` - Individual images per submission
- `GradingPolicy` - Per-class/homework LLM grading mode overrides
- `SystemConfig` - Key-value config (OCR keys, LLM settings)
- `LlmCallLog` - API usage tracking
- `Notification` - User notifications (type: `GRADING_DONE`, etc.)
- `Announcement` - Class-wide announcements
- `HomeworkTemplate` - Reusable homework templates for teachers
- `AuditLog` - Action tracking for admin audit trail

**Submission Status**: QUEUED → PROCESSING → DONE/FAILED

## External Services Configuration

| Service | Purpose | Config Keys |
|---------|---------|-------------|
| Baidu OCR | Text recognition from images | BAIDU_OCR_API_KEY, BAIDU_OCR_SECRET_KEY |
| DeepSeek LLM | Essay grading | LLM_API_KEY, LLM_BASE_URL, LLM_MODEL |
| MinIO | Image storage | MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY |

**Additional LLM Config Keys**:
- `LLM_MAX_TOKENS` - Maximum output tokens (default: 2000, recommend 2000+)
- `LLM_MAX_INPUT_CHARS` - Input truncation threshold (default: 6000)
- `LLM_DAILY_QUOTA` - Daily call limit for budget tracking
- `LLM_QUOTA_MODE` - 'soft' (degrade) or 'hard' (reject) when exceeded

## Important Patterns

### Authentication & Authorization
- JWT stored in localStorage (`authStore`)
- `@UseGuards(JwtAuthGuard)` on protected endpoints
- `@Roles(Role.TEACHER, Role.ADMIN)` for role-based access
- Public routes: `/landing`, `/login`, `/api/public/*`

### Queue Job Data Structure
```typescript
type GradingJobData = {
  submissionId: string;
  mode?: 'cheap' | 'quality';  // cheap=fast model, quality=full model
  needRewrite?: boolean;        // include rewritten version
};
```

**Job Types**: The `grading` queue processes three job types:
- `demo` - Test job for queue health checking
- `grading` - Standard grading job for new submissions
- `regrade` - Re-grading job for re-processing failed/submission

**Worker Concurrency**: Controlled by `WORKER_CONCURRENCY` env var (default: 5)

**LLM Grading Modes**:
- `cheap` - Fast model, lower cost, suitable for batch operations
- `quality` - Full model, higher quality, more detailed feedback

**Grading Degradation Strategy**: When LLM calls fail or quota is exceeded, the service:
1. Retries with reduced `maxTokens`
2. Falls back to "short mode" (no rewrite, simplified scoring)
3. Logs degradation reason in grading metadata

### Frontend API Pattern
- All API calls in `src/api/` modules
- Returns typed responses (not axios promises directly)
- Uses React Query for caching with proper staleTime/gcTime

### i18n Pattern
- `useI18n()` hook for accessing translations
- `t('key.path')` function for translation lookup
- All keys defined in `src/i18n.ts` (single file, not split)

### Error Handling
- Backend: `HttpExceptionFilter` in `src/common/filters/`
- Frontend: `resolveApiErrorMessage()` helper for extracting meaningful messages

### Notification Types
Notifications are created via `NotificationService` with types:
- `GRADING_DONE` - Student notification when grading completes
- Other types defined in `src/notifications/`

### Audit Logging
The `AuditLog` model tracks important user actions for admin review:
- Action type, user ID, target ID, IP address
- Automatically logged by `AuditInterceptor` on write operations
- Configured in `src/common/audit/`

## Default Test Accounts

> ⚠️ **Security Warning**: The following passwords are for local development only. Must change for production!

**Password**: `123456` (development environment only)
- Admin: `admin`
- Teacher: `teacher01`
- Student: `student01`

## Service Passwords (Development)

All development passwords are set to `123456`:
- MySQL root password: `123456`
- MinIO secret key: `minioadmin123` (MinIO requires 8+ characters)
- All user passwords: `123456`
- JWT secret: `123456...` (64 characters)

### Password Security Policy

Production passwords must meet these requirements:
- **Minimum length**: 16 characters
- **Complexity**: Uppercase, lowercase, numbers, special characters
- **Uniqueness**: Different passwords for different services
- **Rotation**: Change every 90 days recommended
- **Generation**: Use password manager or `openssl rand -base64 24`

## Port Configuration

| Service | Port |
|---------|------|
| Backend API | 3000 |
| Frontend | 3001 |
| Nginx (proxy) | 80 |
| MySQL | 3306 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Common Issues

- **Submissions stuck in QUEUED**: Worker process not running (`pnpm dev:worker`)
- **Grading fails with MAX_RETRIES_EXCEEDED**: `LLM_MAX_TOKENS` too low (set to 2000+)
- **502 errors**: Backend API or Worker not running
- **Page refresh issues**: Check Nginx proxy configuration in `deploy/nginx/`
- **PDF export corruption**: Chinese font loading failure (check `PDF_FONT_PATH`)

## Project Documentation

Located in `docs/`:
- `DEVELOPMENT.md` - Developer onboarding and setup guide
- `API.md` - Complete API reference
- `ARCH.md` - System architecture
- `DEPLOY.md` - Production deployment guide
- `RUNBOOK.md` - Operations and troubleshooting
- `PROJECT_OVERVIEW.md` - High-level project overview
- `future-roadmap.md` - Development roadmap
