# Deployment Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Homework AI deployment experience and system stability through configuration optimization, documentation enhancement, and critical function improvements.

**Architecture:**
- Configuration: Centralized validation + Admin panel enhancement
- Deployment: Dual-path documentation (Docker + systemd)
- Stability: Streaming ZIP extraction, queue monitoring, PDF font fallback
- Testing: Manual checklist + E2E automation

**Tech Stack:** NestJS, React, Docker, yauzl, PDFKit, Vitest, Prisma

---

## File Structure

### New Files
```
docs/
├── DEPLOY-LANDING.md           # Deployment selection guide
├── DEPLOY-Docker.md            # Pure Docker deployment guide
└── TESTING.md                  # Manual testing checklist

apps/backend/src/
└── common/
    └── config-validator/       # Configuration validation module
        ├── config-validator.service.ts
        ├── config-validator.controller.ts
        ├── config-validator.module.ts
        └── dto/

apps/backend/e2e/               # E2E test suite
├── auth.e2e.spec.ts
├── submission.e2e.spec.ts
├── batch-upload.e2e.spec.ts
└── report.e2e.spec.ts

apps/frontend/src/pages/admin/
└── QueueMonitoring/            # New queue monitoring page
    ├── index.tsx
    ├── QueueStatus.tsx
    ├── FailedJobs.tsx
    ├── WorkerHealth.tsx
    └── components/

scripts/
└── config-validator.ts         # Standalone config validator
```

### Modified Files
```
apps/backend/.env.example       # Restructured with groups
apps/backend/src/submissions/
    └── submissions.service.ts  # Streaming ZIP extraction
apps/backend/src/admin/
    └── admin.controller.ts     # Queue monitoring endpoints
apps/backend/src/reports/
    └── reports.service.ts      # PDF font optimization
apps/backend/src/system-config/
    └── system-config.service.ts  # Config management enhancements
apps/frontend/src/
    └── api/admin.ts            # Queue monitoring API calls
deploy/docker-compose.prod.yml  # Documentation improvements
```

---

## Phase 1: Configuration File Optimization

### Task 1.1: Restructure .env.example

**Files:**
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Reorganize .env.example into logical groups**

Replace entire file with grouped structure:

```env
# =============================================================================
# Homework AI - Backend Environment Configuration
# =============================================================================
# Copy this file to .env and fill in actual values
# ⚠️ WARNING: Change all default passwords in production!
# =============================================================================

# -----------------------------------------------------------------------------
# Core Services (Database, Cache, Authentication)
# -----------------------------------------------------------------------------
DATABASE_URL=mysql://root:your_strong_db_password_here@localhost:3306/homework_ai?connection_limit=20&pool_timeout=10
# Required: MySQL connection string
# Production: Use strong password (16+ chars, mixed case, numbers, symbols)

REDIS_URL=redis://localhost:6379
# Required: Redis for BullMQ queue and caching
# Production: Add password: redis://:password@localhost:6379

JWT_SECRET=change_this_to_a_strong_random_string_minimum_64_characters
# Required: JWT signing secret
# Generate: openssl rand -base64 64
# Minimum: 64 characters

# -----------------------------------------------------------------------------
# AI Services (LLM Grading, OCR)
# -----------------------------------------------------------------------------
LLM_PROVIDER=cheap
# Default LLM mode: cheap (fast) or quality (detailed)

LLM_API_KEY=
# Required: DeepSeek API key for grading
# Get from: https://platform.deepseek.com

LLM_BASE_URL=
# Optional: LLM API base URL (defaults to DeepSeek)

LLM_MODEL=
# Optional: Model name (defaults to system setting)

LLM_MAX_TOKENS=2000
# Maximum output tokens (recommend 2000+ for complete responses)

LLM_DAILY_CALL_LIMIT=400
# Daily LLM call limit for budget control

BAIDU_OCR_API_KEY=
# Required: Baidu OCR API key
# Get from: https://cloud.baidu.com/product/ocr

BAIDU_OCR_SECRET_KEY=
# Required: Baidu OCR secret key

# -----------------------------------------------------------------------------
# Storage (MinIO S3-compatible)
# -----------------------------------------------------------------------------
STORAGE_PROVIDER=minio
# Storage provider (currently only minio supported)

MINIO_ENDPOINT=http://localhost:9000
# MinIO service address (port 9000 for API, 9001 for console)

MINIO_ACCESS_KEY=your_minio_access_key_here
# MinIO access key
# Production: Don't use default 'minioadmin'

MINIO_SECRET_KEY=your_minio_secret_key_here
# MinIO secret key
# Production: Use strong password (32+ chars)

MINIO_BUCKET=submissions
# Storage bucket name

MINIO_REGION=us-east-1
# MinIO region

# -----------------------------------------------------------------------------
# Email Notifications (Optional)
# -----------------------------------------------------------------------------
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@homework-ai.local
# SMTP configuration for email notifications
# Leave empty to disable email features

# -----------------------------------------------------------------------------
# Runtime Policies
# -----------------------------------------------------------------------------
BUDGET_MODE=soft
# Budget mode: soft (degrade) or hard (reject)

BUDGET_DAILY_LIMIT=100
# Daily budget limit in USD

RETENTION_DAYS=7
# Data retention period in days

RETENTION_CRON=30 3 * * *
# Cron schedule for retention cleanup (default: 3:30 AM daily)

RUN_RETENTION=true
# Enable retention cleanup (API: true, Worker: false)

WORKER_CONCURRENCY=5
# Worker concurrent task count

# -----------------------------------------------------------------------------
# Batch Upload Limits
# -----------------------------------------------------------------------------
BATCH_ZIP_MAX_BYTES=104857600
# Max ZIP file size (100MB)

BATCH_ZIP_MAX_UNCOMPRESSED_BYTES=314572800
# Max uncompressed size (300MB)

BATCH_ZIP_MAX_ENTRY_BYTES=15728640
# Max single file size (15MB)

# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------
PORT=3000
# Backend API server port

NODE_ENV=development
# Environment: development or production

# -----------------------------------------------------------------------------
# Development Only
# -----------------------------------------------------------------------------
SEED_USERS=false
# Create test accounts on startup (production: false)

SEED_PASSWORD=Dev@Pass2024!
# Test account password (development only)

# =============================================================================
# Configuration Validation
# =============================================================================
# Run: pnpm config:validate
# This will check all required fields and report issues
# =============================================================================
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/.env.example
git commit -m "refactor(env): restructure .env.example with logical grouping"
```

---

### Task 1.2: Create Configuration Validator Service

**Files:**
- Create: `apps/backend/src/common/config-validator/config-validator.service.ts`
- Create: `apps/backend/src/common/config-validator/config-validator.module.ts`
- Create: `apps/backend/src/common/config-validator/dto/
-validate-config.dto.ts`
- Create: `apps/backend/src/common/config-validator/config-validator.controller.ts`
- Create: `apps/backend/src/common/config-validator/index.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/backend/src/common/config-validator/dto/validate-config.dto.ts`:

```typescript
import { IsOptional, IsBoolean } from 'class-validator';

export class ValidateConfigDto {
  @IsOptional()
  @IsBoolean()
  fix?: boolean;
}
```

- [ ] **Step 2: Create the validator service**

Create `apps/backend/src/common/config-validator/config-validator.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
}

@Injectable()
export class ConfigValidatorService {
  private readonly logger = new Logger(ConfigValidatorService.name);

  constructor(private readonly config: NestConfigService) {}

  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixes: string[] = [];

    // Required fields validation
    const required = [
      { key: 'DATABASE_URL', name: 'Database URL' },
      { key: 'REDIS_URL', name: 'Redis URL' },
      { key: 'JWT_SECRET', name: 'JWT Secret' },
      { key: 'LLM_API_KEY', name: 'LLM API Key' },
    ];

    for (const field of required) {
      const value = this.config.get(field.key);
      if (!value || value === '' || value.includes('your_')) {
        errors.push(`${field.name} (${field.key}) is missing or using placeholder value`);
        fixes.push(`Set ${field.key} in .env file`);
      }
    }

    // JWT secret strength
    const jwtSecret = this.config.get('JWT_SECRET');
    if (jwtSecret && jwtSecret.length < 64) {
      warnings.push('JWT_SECRET should be at least 64 characters');
      fixes.push('Generate stronger secret: openssl rand -base64 64');
    }

    // Password strength warnings
    const dbUrl = this.config.get('DATABASE_URL');
    if (dbUrl && dbUrl.includes('123456') || dbUrl?.includes('password')) {
      warnings.push('Database password appears weak');
      fixes.push('Use strong password (16+ chars, mixed case, numbers, symbols)');
    }

    // Port conflict detection
    const port = this.config.get('PORT', 3000);
    const portStr = String(port);
    if (portStr === '3001') {
      warnings.push('PORT 3001 conflicts with frontend dev server default');
    }

    // Font path validation
    const fontPath = this.config.get('PDF_FONT_PATH');
    if (fontPath) {
      const resolved = resolve(fontPath);
      if (!existsSync(resolved)) {
        warnings.push(`PDF_FONT_PATH specified but file not found: ${fontPath}`);
        fixes.push('Remove PDF_FONT_PATH or correct the path');
      }
    }

    // OCR keys
    const ocrKey = this.config.get('BAIDU_OCR_API_KEY');
    if (!ocrKey) {
      warnings.push('BAIDU_OCR_API_KEY not set - OCR functionality will be disabled');
    }

    // MinIO configuration
    const minioEndpoint = this.config.get('MINIO_ENDPOINT');
    if (minioEndpoint?.includes('localhost')) {
      warnings.push('MINIO_ENDPOINT uses localhost - this may cause issues in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fixes,
    };
  }

  getConfigSummary(): Record<string, string | boolean | null> {
    return {
      database: !!this.config.get('DATABASE_URL'),
      redis: !!this.config.get('REDIS_URL'),
      jwtSecret: !!this.config.get('JWT_SECRET'),
      llmApiKey: !!this.config.get('LLM_API_KEY'),
      ocrApiKey: !!this.config.get('BAIDU_OCR_API_KEY'),
      minio: !!this.config.get('MINIO_ENDPOINT'),
      smtp: !!this.config.get('SMTP_HOST'),
      retentionDays: this.config.get('RETENTION_DAYS'),
      budgetLimit: this.config.get('BUDGET_DAILY_LIMIT'),
      workerConcurrency: this.config.get('WORKER_CONCURRENCY'),
    };
  }
}
```

- [ ] **Step 3: Create the controller**

Create `apps/backend/src/common/config-validator/config-validator.controller.ts`:

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { ConfigValidatorService } from './config-validator.service';
import { ValidateConfigDto } from './dto/validate-config.dto';

@ApiTags('Config Validator')
@Controller('config-validator')
export class ConfigValidatorController {
  constructor(private readonly validator: ConfigValidatorService) {}

  @Get('validate')
  validate() {
    return this.validator.validate();
  }

  @Get('summary')
  getSummary() {
    return this.validator.getConfigSummary();
  }
}
```

- [ ] **Step 4: Create the module**

Create `apps/backend/src/common/config-validator/config-validator.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigValidatorController } from './config-validator.controller';
import { ConfigValidatorService } from './config-validator.service';

@Module({
  imports: [ConfigModule],
  controllers: [ConfigValidatorController],
  providers: [ConfigValidatorService],
  exports: [ConfigValidatorService],
})
export class ConfigValidatorModule {}
```

- [ ] **Step 5: Create index file**

Create `apps/backend/src/common/config-validator/index.ts`:

```typescript
export * from './config-validator.module';
export * from './config-validator.service';
export * from './config-validator.controller';
```

- [ ] **Step 6: Integrate into AppModule**

Modify `apps/backend/src/app.module.ts`:

Add import:
```typescript
import { ConfigValidatorModule } from './common/config-validator';
```

Add to imports array:
```typescript
ConfigValidatorModule,
```

- [ ] **Step 7: Add to public module for unauthenticated access**

Modify `apps/backend/src/public/public.module.ts`:

```typescript
import { ConfigValidatorModule } from '../common/config-validator';

@Module({
  imports: [
    // ... existing imports
    ConfigValidatorModule,
  ],
})
export class PublicModule {}
```

- [ ] **Step 8: Move controller to public for health check access**

Actually, let's add endpoint to public controller instead. Modify `apps/backend/src/public/public.controller.ts`:

```typescript
import { ConfigValidatorService } from '../common/config-validator';

@Controller('public')
export class PublicController {
  constructor(private readonly validator: ConfigValidatorService) {}

  @Get('config/validate')
  validateConfig() {
    return this.validator.validate();
  }

  // ... existing endpoints
}
```

Update module:
```typescript
@Module({
  imports: [ConfigValidatorModule],
  controllers: [PublicController],
  providers: [PublicService, ConfigValidatorService],
  // ...
})
```

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/common/config-validator apps/backend/src/public/public.module.ts apps/backend/src/public/public.controller.ts
git commit -m "feat(config): add configuration validator service and API endpoint"
```

---

### Task 1.3: Create Standalone Config Validator Script

**Files:**
- Create: `scripts/config-validator.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Create standalone validator script**

Create `scripts/config-validator.ts`:

```typescript
#!/usr/bin/env ts-node

import { loadDotEnv } from './config-loader';
import { validateConfiguration } from './validator-core';

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');

  console.log('🔍 Validating Homework AI configuration...\n');

  loadDotEnv();
  const result = validateConfiguration();

  if (result.valid) {
    console.log('✅ Configuration is valid!\n');
    console.log('Summary:', result.summary);
    process.exit(0);
  }

  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach(e => console.error(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (result.fixes.length > 0) {
    console.log('\n💡 Suggested fixes:');
    result.fixes.forEach(f => console.log(`  - ${f}`));
  }

  console.log();
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm scripts**

Modify root `package.json`:

```json
{
  "scripts": {
    "config:validate": "ts-node scripts/config-validator.ts",
    "prestart:dev": "pnpm config:validate || true"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/config-validator.ts package.json
git commit -m "feat(script): add standalone configuration validator script"
```

---

## Phase 2: Docker Deployment Documentation

### Task 2.1: Create Deployment Landing Page

**Files:**
- Create: `docs/DEPLOY-LANDING.md`

- [ ] **Step 1: Write deployment selection guide**

Create `docs/DEPLOY-LANDING.md`:

```markdown
# Deployment Guide - Choose Your Approach

This document helps you choose the best deployment method for your use case.

## Quick Comparison

| Aspect | Docker | systemd |
|--------|--------|---------|
| **Setup Complexity** | Low (one command) | Medium (multiple steps) |
| **Resource Usage** | Higher (~500MB overhead) | Lower (native processes) |
| **Portability** | High (works anywhere with Docker) | Low (Linux specific) |
| **Production Ready** | ✅ Yes | ✅ Yes |
| **Debugging** | Harder (container logs) | Easier (systemd journal) |
| **Updates** | Rebuild containers | git pull + rebuild |
| **Recommended For** | Quick start, testing, small deployments | Production, long-running, large scale |

## Decision Tree

```
Start
 │
 ├─ Are you deploying on Linux (Debian/Ubuntu)?
 │   ├─ Yes → Do you want maximum performance?
 │   │   ├─ Yes → Use **systemd** (DEPLOY.md)
 │   │   └─ No → Use **Docker** (DEPLOY-Docker.md)
 │   │
 │   └─ No (Windows/macOS) → Use **Docker** (DEPLOY-Docker.md)
 │
 └─ Do you need to deploy quickly for testing?
     ├─ Yes → Use **Docker** (DEPLOY-Docker.md)
     └─ No → Use **systemd** (DEPLOY.md)
```

## Docker Deployment

**Choose this if:**
- You're new to deployment
- You want to get started quickly
- You're on Windows or macOS
- You prefer containerized services
- You want easy rollback with docker-compose

**Guide:** [DEPLOY-Docker.md](./DEPLOY-Docker.md)

## systemd Deployment

**Choose this if:**
- You're deploying on Linux (Debian/Ubuntu/CentOS)
- You want maximum performance
- You're comfortable with Linux system administration
- You need fine-grained control over services
- You're using existing infrastructure (MySQL, Redis)

**Guide:** [DEPLOY.md](./DEPLOY.md)

## Common Requirements

Both methods require:
- Node.js 20+ (for building only)
- MySQL 8+ or managed database
- Redis 7+ or managed cache
- Domain name (for production)
- SSL certificates (for production)

## Need Help?

- See [DEVELOPMENT.md](./DEVELOPMENT.md) for local development
- See [RUNBOOK.md](./RUNBOOK.md) for troubleshooting
- Check GitHub Issues for common problems
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY-LANDING.md
git commit -m "docs: add deployment selection guide"
```

---

### Task 2.2: Write Docker Deployment Guide

**Files:**
- Create: `docs/DEPLOY-Docker.md`

- [ ] **Step 1: Write comprehensive Docker deployment guide**

Create `docs/DEPLOY-Docker.md`:

```markdown
# Docker Deployment Guide

This guide covers deploying Homework AI using Docker and Docker Compose.

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- At least 2GB RAM available
- 10GB free disk space

Check installation:
```bash
docker --version
docker compose version
```

## Quick Start

### 1. Clone Repository

```bash
git clone <YOUR_REPO_URL> homework-ai
cd homework-ai
```

### 2. Configure Environment

```bash
# Copy production env template
cp deploy/.env.prod.example deploy/.env.prod

# Edit with your values
nano deploy/.env.prod
```

**Required settings:**
```env
# Database
DB_PASS=your_strong_password_here

# MinIO
MINIO_ROOT_PASSWORD=your_strong_minio_password

# JWT
JWT_SECRET=$(openssl rand -base64 64)

# AI Services
LLM_API_KEY=your_deepseek_api_key
BAIDU_OCR_API_KEY=your_baidu_ocr_key
BAIDU_OCR_SECRET_KEY=your_baidu_ocr_secret

# Frontend
WEB_PORT=80
CORS_ORIGIN=https://your-domain.com
```

### 3. Start Services

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

This starts:
- MySQL (port 3306)
- Redis (port 6379)
- MinIO (ports 9000, 9001)
- Backend API (internal)
- Worker (internal)
- Frontend (port 80)

### 4. Run Database Migrations

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec -T api npx prisma migrate deploy
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost/api/health

# Check all services
docker compose -f deploy/docker-compose.prod.yml ps
```

## Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost | Default port 80 |
| API | http://localhost/api | Proxied through nginx |
| MinIO Console | http://localhost:9001 | File management UI |

## Default Accounts

After first deployment, create admin user via API:

```bash
curl -X POST http://localhost/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourStrongPassword123!"}'
```

## Common Operations

### View Logs

```bash
# All services
docker compose -f deploy/docker-compose.prod.yml logs -f

# Specific service
docker compose -f deploy/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker-compose.prod.yml logs -f worker
```

### Restart Services

```bash
docker compose -f deploy/docker-compose.prod.yml restart api worker
```

### Update to Latest Version

```bash
cd /path/to/homework-ai
git pull main

# Rebuild and restart
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build

# Run migrations
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec -T api npx prisma migrate deploy
```

### Backup Database

```bash
# Backup
docker compose -f deploy/docker-compose.prod.yml exec mysql mysqldump -u root -p homework_ai > backup-$(date +%Y%m%d).sql

# Restore
docker compose -f deploy/docker-compose.prod.yml exec -T mysql mysql -u root -p homework_ai < backup-YYYYMMDD.sql
```

### Backup MinIO Data

```bash
# Using mc (MinIO Client)
docker run --rm -v minio-data:/data --network homework-ai_internal minio/mc \
  alias set local http://minio:9000 MINIO_ROOT_USER MINIO_ROOT_PASSWORD

docker run --rm -v minio-data:/data --network homework-ai_internal minio/mc \
  mirror local/submissions ./backup/minio
```

## Troubleshooting

### Container Keeps Restarting

```bash
# Check logs
docker compose -f deploy/docker-compose.prod.yml logs api

# Common issues:
# - Database connection: Check DB_PASS in .env.prod
# - Port conflicts: Change WEB_PORT in .env.prod
```

### Database Connection Failed

```bash
# Ensure mysql is healthy
docker compose -f deploy/docker-compose.prod.yml ps mysql

# Wait for healthy status, then restart api
docker compose -f deploy/docker-compose.prod.yml restart api
```

### Submissions Stuck in QUEUED

```bash
# Check worker is running
docker compose -f deploy/docker-compose.prod.yml ps worker

# Check worker logs
docker compose -f deploy/docker-compose.prod.yml logs worker
```

## Production Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET (64+ chars)
- [ ] Configure CORS_ORIGIN to your domain
- [ ] Enable HTTPS (use reverse proxy with SSL)
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set resource limits in docker-compose
- [ ] Monitor disk usage (logs, MinIO data)

## SSL/HTTPS Setup

For production, use a reverse proxy with SSL:

### Option 1: Caddy (Automatic HTTPS)

```yaml
# Add to docker-compose.prod.yml
caddy:
  image: caddy:2-alpine
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./caddy/Caddyfile:/etc/caddy/Caddyfile
    - caddy-data:/data
  restart: unless-stopped
```

Caddyfile:
```
your-domain.com {
  reverse_proxy web:80
}
```

### Option 2: Nginx + Let's Encrypt

Use certbot for certificate management outside Docker.

## Performance Tuning

### Adjust Resource Limits

In `docker-compose.prod.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G  # Increase from 512M
        reservations:
          memory: 512M
```

### Increase Worker Concurrency

In `.env.prod`:
```env
WORKER_REPLICAS=2  # Multiple worker containers
WORKER_CONCURRENCY=10  # Tasks per worker
```

## Monitoring

### Health Check Endpoint

```bash
watch -n 5 'curl -s http://localhost/api/health | jq .'
```

### Container Stats

```bash
docker stats
```

## See Also

- [DEPLOY.md](./DEPLOY.md) - systemd deployment
- [RUNBOOK.md](./RUNBOOK.md) - Operations guide
- [ARCH.md](./ARCH.md) - Architecture overview
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY-Docker.md
git commit -m "docs: add comprehensive Docker deployment guide"
```

---

### Task 2.3: Enhance Existing DEPLOY.md

**Files:**
- Modify: `docs/DEPLOY.md`

- [ ] **Step 1: Add comparison and reference to Docker guide**

Add to top of `docs/DEPLOY.md` after title:

```markdown
> **New to deployment?** See [DEPLOY-LANDING.md](./DEPLOY-LANDING.md) to choose between Docker and systemd deployment.
> **Prefer Docker?** See [DEPLOY-Docker.md](./DEPLOY-Docker.md) for containerized deployment.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add reference to Docker deployment guide"
```

---

## Phase 3: Batch Upload Streaming

### Task 3.1: Add yauzl Dependency

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install yauzl package**

```bash
cd apps/backend
pnpm add yauzl
pnpm add -D @types/yauzl
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/package.json apps/backend/pnpm-lock.yaml
git commit -m "deps: add yauzl for streaming ZIP extraction"
```

---

### Task 3.2: Implement Streaming ZIP Extraction

**Files:**
- Modify: `apps/backend/src/submissions/submissions.service.ts`

- [ ] **Step 1: Add yauzl import and types**

At top of file, add:
```typescript
import * as yauzl from 'yauzl';

interface ZipEntry {
  filename: string;
  buffer: Buffer;
  size: number;
}
```

- [ ] **Step 2: Create streaming extraction helper**

Add method after existing helpers:
```typescript
/**
 * Extract ZIP file using streaming to avoid OOM on large files
 */
private extractZipStreaming(buffer: Buffer, maxSize: number): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = [];
    let totalUncompressedSize = 0;
    let entryCount = 0;

    yauzl.fromBuffer(buffer, {
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    }, (err, zipfile) => {
      if (err) {
        this.logger.warn(`ZIP parse error: ${err.message}`);
        return reject(new BadRequestException('Invalid ZIP file format'));
      }

      if (!zipfile) {
        return reject(new BadRequestException('Failed to open ZIP file'));
      }

      zipfile.on('entry', (entry: yauzl.Entry) => {
        // Skip directories
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        // Check individual file size
        const maxEntryBytes = Number(this.config.get('BATCH_ZIP_MAX_ENTRY_BYTES') || 15728640);
        if (entry.uncompressedSize > maxEntryBytes) {
          zipfile.close();
          return reject(new BadRequestException(
            `File ${entry.fileName} exceeds maximum size of ${maxEntryBytes} bytes`
          ));
        }

        // Check total uncompressed size
        totalUncompressedSize += entry.uncompressedSize;
        const maxUncompressed = Number(this.config.get('BATCH_ZIP_MAX_UNCOMPRESSED_BYTES') || 314572800);
        if (totalUncompressedSize > maxUncompressed) {
          zipfile.close();
          return reject(new BadRequestException(
            `ZIP contents exceed maximum uncompressed size of ${maxUncompressed} bytes`
          ));
        }

        // Check entry count
        entryCount++;
        if (entryCount > 500) {
          zipfile.close();
          return reject(new BadRequestException('ZIP contains too many files (max 500)'));
        }

        // Open read stream for this entry
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            this.logger.error(`Error opening entry ${entry.fileName}: ${err.message}`);
            zipfile.readEntry();
            return;
          }

          const chunks: Buffer[] = [];
          let entrySize = 0;

          readStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            entrySize += chunk.length;
          });

          readStream.on('end', () => {
            entries.push({
              filename: entry.fileName,
              buffer: Buffer.concat(chunks),
              size: entrySize,
            });
            zipfile.readEntry();
          });

          readStream.on('error', (err) => {
            this.logger.error(`Error reading entry ${entry.fileName}: ${err.message}`);
            zipfile.readEntry();
          });
        });
      });

      zipfile.on('end', () => {
        this.logger.debug(`ZIP extraction complete: ${entries.length} files, ${totalUncompressedSize} bytes`);
        resolve(entries);
      });

      zipfile.on('error', (err) => {
        this.logger.error(`ZIP processing error: ${err.message}`);
        reject(new BadRequestException('Failed to process ZIP file'));
      });

      // Start reading entries
      zipfile.readEntry();
    });
  });
}
```

- [ ] **Step 3: Replace unzipper usage in batchUpload method**

Find the `batchUpload` method and replace the unzipper section:

Old code (approximately lines 500-550):
```typescript
const zip = await new Promise<any>((resolve, reject) => {
  unzipper.Buffer().extract(buffer)
    .on('entry', (entry: any) => {
      // ... existing code
    })
    .on('finish', resolve)
    .on('error', reject);
});
```

Replace with:
```typescript
// Use streaming extraction to handle large ZIPs
const zipEntries = await this.extractZipStreaming(buffer, maxSize);
```

And update the processing loop:
```typescript
for (const entry of zipEntries) {
  // Process entry.filename and entry.buffer
  const filename = entry.filename;
  const fileBuffer = entry.buffer;

  // Validate image type
  const imageType = await this.detectImageType(fileBuffer);
  if (!imageType) {
    this.logger.warn(`Skipping non-image file: ${filename}`);
    continue;
  }

  // Extract student identifier from filename
  const match = filename.match(/(\d{6,})/);
  if (!match) {
    this.logger.warn(`Skipping file without student ID: ${filename}`);
    continue;
  }

  const studentIdentifier = match[1];
  // ... rest of processing
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/submissions/submissions.service.ts
git commit -m "feat(batch): use streaming ZIP extraction to handle large files"
```

---

### Task 3.3: Update Tests for Streaming Extraction

**Files:**
- Modify: `apps/backend/src/submissions/submissions.service.spec.ts`

- [ ] **Step 1: Add streaming extraction tests**

Add test suite:
```typescript
describe('extractZipStreaming', () => {
  it('should extract valid ZIP file', async () => {
    const zipBuffer = await createTestZip(['test1.jpg', 'test2.jpg']);
    const result = await service.extractZipStreaming(zipBuffer, 10 * 1024 * 1024);

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('test1.jpg');
    expect(result[0].buffer).toBeInstanceOf(Buffer);
  });

  it('should reject oversized ZIP before extraction', async () => {
    const largeZip = await createTestZip(['test.jpg'], 200 * 1024 * 1024);

    await expect(
      service.extractZipStreaming(largeZip, 100 * 1024 * 1024)
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject ZIP with oversized entry', async () => {
    const zipWithLargeEntry = await createTestZipWithLargeEntry('large.jpg', 20 * 1024 * 1024);

    await expect(
      service.extractZipStreaming(zipWithLargeEntry, 100 * 1024 * 1024)
    ).rejects.toThrow('exceeds maximum size');
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/submissions/submissions.service.spec.ts
git commit -m "test(batch): add tests for streaming ZIP extraction"
```

---

## Phase 4: Queue Monitoring

### Task 4.1: Add Queue Monitoring Backend Endpoints

**Files:**
- Modify: `apps/backend/src/admin/admin.controller.ts`
- Modify: `apps/backend/src/admin/admin.service.ts`
- Create: `apps/backend/src/admin/dto/queue-alert.dto.ts`

- [ ] **Step 1: Create alert DTO**

Create `apps/backend/src/admin/dto/queue-alert.dto.ts`:

```typescript
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueueAlertConfigDto {
  @IsNumber()
  backlogThreshold?: number;

  @IsNumber()
  failureRateThreshold?: number;

  @IsNumber()
  staleMinutes?: number;

  @IsString()
  @IsOptional()
  email?: string;
}

export class QueueAlertDto {
  active: boolean;
  type: 'backlog' | 'failure_rate' | 'worker_stale' | 'queue_stale';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}
```

- [ ] **Step 2: Add monitoring methods to AdminService**

Add to `apps/backend/src/admin/admin.service.ts`:

```typescript
async getQueueAlerts(): Promise<QueueAlertDto[]> {
  const alerts: QueueAlertDto[] = [];
  const metrics = await this.getQueueMetrics({ queue: 'grading' });

  // Backlog alert
  const backlogThreshold = 100;
  if (metrics.waiting > backlogThreshold) {
    alerts.push({
      active: true,
      type: 'backlog',
      message: `Queue backlog: ${metrics.waiting} jobs waiting`,
      value: metrics.waiting,
      threshold: backlogThreshold,
      timestamp: new Date(),
    });
  }

  // Failure rate alert
  const failureRateThreshold = 0.1; // 10%
  const totalCompleted = metrics.completed + metrics.failed;
  const failureRate = totalCompleted > 0 ? metrics.failed / totalCompleted : 0;

  if (failureRate > failureRateThreshold && metrics.failed > 5) {
    alerts.push({
      active: true,
      type: 'failure_rate',
      message: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
      value: Math.round(failureRate * 100),
      threshold: failureRateThreshold * 100,
      timestamp: new Date(),
    });
  }

  // Stale queue alert
  const staleMinutes = 5;
  const queue = this.queueManager.getQueue('grading');
  if (queue) {
    const jobs = await queue.getRepeatableJobs();
    const lastJob = await queue.getDelayed()[0];
    // Check if queue is processing
    const activeCount = await queue.getActiveCount();
    if (activeCount === 0 && metrics.waiting > 0) {
      alerts.push({
        active: true,
        type: 'queue_stale',
        message: 'Queue has waiting jobs but no active processing',
        value: metrics.waiting,
        threshold: 0,
        timestamp: new Date(),
      });
    }
  }

  return alerts;
}

async getWorkerHealth(): Promise<{
  healthy: boolean;
  workers: Array<{ id: string; status: string; lastSeen: Date }>;
}> {
  const workers = await this.redis.get('bull:grading:workers') || '[]';
  const workerList = JSON.parse(workers as string);

  return {
    healthy: workerList.length > 0,
    workers: workerList.map((w: any) => ({
      id: w.id,
      status: w.status,
      lastSeen: new Date(w.lastSeen),
    })),
  };
}

async getQueueTrends(days: number = 7): Promise<{
  dates: string[];
  waiting: number[];
  completed: number[];
  failed: number[];
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dates: string[] = [];
  const waiting: number[] = [];
  const completed: number[] = [];
  const failed: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    dates.push(dateStr);

    // Get metrics from Redis stored daily stats
    const stats = await this.redis.get(`queue:stats:${dateStr}`);
    if (stats) {
      const parsed = JSON.parse(stats);
      waiting.push(parsed.waiting || 0);
      completed.push(parsed.completed || 0);
      failed.push(parsed.failed || 0);
    } else {
      waiting.push(0);
      completed.push(0);
      failed.push(0);
    }
  }

  return { dates, waiting, completed, failed };
}
```

- [ ] **Step 3: Add controller endpoints**

Add to `apps/backend/src/admin/admin.controller.ts`:

```typescript
@Get('queue/alerts')
async getQueueAlerts() {
  return this.adminService.getQueueAlerts();
}

@Get('queue/worker-health')
async getWorkerHealth() {
  return this.adminService.getWorkerHealth();
}

@Get('queue/trends')
async getQueueTrends(@Query('days') days?: string) {
  return this.adminService.getQueueTrends(days ? parseInt(days) : 7);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/admin/admin.controller.ts apps/backend/src/admin/admin.service.ts apps/backend/src/admin/dto/queue-alert.dto.ts
git commit -m "feat(admin): add queue monitoring endpoints with alerts"
```

---

### Task 4.2: Create Queue Monitoring Frontend Page

**Files:**
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/index.tsx`
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/QueueStatus.tsx`
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/FailedJobs.tsx`
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/WorkerHealth.tsx`
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/QueueTrends.tsx`
- Create: `apps/frontend/src/pages/admin/QueueMonitoring/components/AlertCard.tsx`
- Modify: `apps/frontend/src/api/admin.ts`
- Modify: `apps/frontend/src/routes/router.tsx`

- [ ] **Step 1: Add API functions**

Add to `apps/frontend/src/api/admin.ts`:

```typescript
export interface QueueAlert {
  active: boolean;
  type: 'backlog' | 'failure_rate' | 'worker_stale' | 'queue_stale';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface WorkerHealth {
  healthy: boolean;
  workers: Array<{ id: string; status: string; lastSeen: string }>;
}

export interface QueueTrends {
  dates: string[];
  waiting: number[];
  completed: number[];
  failed: number[];
}

export const getQueueAlerts = () =>
  api.get<QueueAlert[]>('/admin/queue/alerts');

export const getWorkerHealth = () =>
  api.get<WorkerHealth>('/admin/queue/worker-health');

export const getQueueTrends = (days: number = 7) =>
  api.get<QueueTrends>('/admin/queue/trends', { params: { days } });
```

- [ ] **Step 2: Create main monitoring page**

Create `apps/frontend/src/pages/admin/QueueMonitoring/index.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Alert as AntAlert, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../../hooks/useI18n';
import {
  getQueueMetrics,
  getQueueAlerts,
  getWorkerHealth,
  getQueueTrends,
} from '../../../api/admin';
import QueueStatus from './QueueStatus';
import FailedJobs from './FailedJobs';
import WorkerHealth from './WorkerHealth';
import QueueTrends from './QueueTrends';

export default function QueueMonitoring() {
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['queue-metrics', refreshKey],
    queryFn: () => getQueueMetrics({ queue: 'grading' }),
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['queue-alerts', refreshKey],
    queryFn: getQueueAlerts,
    refetchInterval: 10000,
  });

  const { data: workerHealth } = useQuery({
    queryKey: ['worker-health', refreshKey],
    queryFn: getWorkerHealth,
    refetchInterval: 10000,
  });

  const { data: trends } = useQuery({
    queryKey: ['queue-trends'],
    queryFn: () => getQueueTrends(7),
    refetchInterval: 60000,
  });

  const hasAlerts = alerts && alerts.some(a => a.active);

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <h1>Queue Monitoring</h1>
        </Col>
        <Col>
          <ReloadOutlined
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ fontSize: 20, cursor: 'pointer' }}
          />
        </Col>
      </Row>

      {hasAlerts && alerts?.map(alert => (
        alert.active && (
          <AntAlert
            key={alert.type}
            message={alert.message}
            type="warning"
            showIcon
            closable
            style={{ marginBottom: 16 }}
          />
        )
      ))}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title="Waiting"
              value={metrics?.waiting || 0}
              valueStyle={{ color: metrics?.waiting > 100 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title="Active"
              value={metrics?.active || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title="Completed"
              value={metrics?.completed || 0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title="Failed"
              value={metrics?.failed || 0}
              valueStyle={{ color: metrics?.failed > 10 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <QueueStatus metrics={metrics} />
        </Col>
        <Col span={12}>
          <WorkerHealth health={workerHealth} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <FailedJobs />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <QueueTrends trends={trends} />
        </Col>
      </Row>
    </div>
  );
}
```

- [ ] **Step 3: Create component files**

Create remaining component files with basic implementations:

`QueueStatus.tsx`:
```typescript
import { Card, Progress } from 'antd';

export default function QueueStatus({ metrics }: any) {
  return (
    <Card title="Queue Status">
      <p>Active Jobs: {metrics?.active || 0}</p>
      <p>Waiting Jobs: {metrics?.waiting || 0}</p>
      <Progress
        percent={
          metrics?.completed && metrics?.failed
            ? Math.round((metrics.completed / (metrics.completed + metrics.failed)) * 100)
            : 0
        }
        status="active"
      />
    </Card>
  );
}
```

`FailedJobs.tsx`:
```typescript
import { Card, Table, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { listFailedQueueJobs } from '../../../api/admin';

export default function FailedJobs() {
  const { data: failedJobs, refetch } = useQuery({
    queryKey: ['failed-jobs'],
    queryFn: () => listFailedQueueJobs({ queue: 'grading', limit: 20 }),
    refetchInterval: 10000,
  });

  return (
    <Card
      title="Failed Jobs"
      extra={<Button onClick={() => refetch()}>Refresh</Button>}
    >
      <Table
        dataSource={failedJobs?.jobs || []}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 100 },
          { title: 'Error', dataIndex: 'failedReason' },
          { title: 'Attempts', dataIndex: 'attemptsMade', width: 100 },
          { title: 'Failed At', dataIndex: 'failedAt', render: (d: string) => new Date(d).toLocaleString() },
        ]}
      />
    </Card>
  );
}
```

`WorkerHealth.tsx`:
```typescript
import { Card, Badge, List } from 'antd';

export default function WorkerHealth({ health }: any) {
  const isHealthy = health?.healthy ?? false;

  return (
    <Card
      title="Worker Health"
      extra={<Badge status={isHealthy ? 'success' : 'error'} text={isHealthy ? 'Healthy' : 'Unhealthy'} />}
    >
      <List
        dataSource={health?.workers || []}
        renderItem={(worker: any) => (
          <List.Item>
            <List.Item.Meta
              title={`Worker ${worker.id?.slice(0, 8)}`}
              description={`Status: ${worker.status} | Last seen: ${new Date(worker.lastSeen).toLocaleString()}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
```

`QueueTrends.tsx`:
```typescript
import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';

export default function QueueTrends({ trends }: any) {
  const option = {
    title: { text: '7-Day Queue Trends' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['Waiting', 'Completed', 'Failed'] },
    xAxis: { type: 'category', data: trends?.dates || [] },
    yAxis: { type: 'value' },
    series: [
      { name: 'Waiting', type: 'line', data: trends?.waiting || [], color: '#faad14' },
      { name: 'Completed', type: 'line', data: trends?.completed || [], color: '#52c41a' },
      { name: 'Failed', type: 'line', data: trends?.failed || [], color: '#ff4d4f' },
    ],
  };

  return (
    <Card title="Queue Trends (7 Days)">
      <ReactECharts option={option} style={{ height: 300 }} />
    </Card>
  );
}
```

- [ ] **Step 4: Add route**

Add to router configuration in `apps/frontend/src/routes/router.tsx`:

```typescript
{
  path: '/admin/queue',
  element: <QueueMonitoring />,
}
```

- [ ] **Step 5: Update menu**

Add to admin menu items.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/admin/QueueMonitoring apps/frontend/src/api/admin.ts apps/frontend/src/routes/router.tsx
git commit -m "feat(admin): add queue monitoring page with real-time updates"
```

---

## Phase 5: PDF Export Optimization

### Task 5.1: Bundle CJK Font

**Files:**
- Create: `apps/backend/assets/fonts/.gitkeep`
- Download: `NotoSansCJK-Regular.ttc` to assets folder

- [ ] **Step 1: Create fonts directory structure**

```bash
mkdir -p apps/backend/assets/fonts
touch apps/backend/assets/fonts/.gitkeep
```

- [ ] **Step 2: Add download instructions to README**

Add to `apps/backend/README.md`:

```markdown
## Fonts

For PDF export with Chinese characters, download Noto Sans CJK:

```bash
cd apps/backend/assets/fonts
curl -L -O https://github.com/googlefonts/noto-cjk/releases/download/Sans2.004/NotoSansCJK-Regular.ttc
```
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/assets/fonts apps/backend/README.md
git commit -m "chore: add fonts directory for PDF CJK support"
```

---

### Task 5.2: Improve Font Resolution Logic

**Files:**
- Modify: `apps/backend/src/reports/reports.service.ts`

- [ ] **Step 1: Enhance resolvePdfFont method**

Replace existing `resolvePdfFont` method with improved version:

```typescript
private resolvePdfFont(lang?: string): string {
  if (!this.isZhLang(lang)) {
    return 'Helvetica';
  }

  // Cache resolved font at module level
  if ((this.constructor as any).cachedFontPath) {
    return (this.constructor as any).cachedFontPath;
  }

  // 1. Environment variable (highest priority)
  const envFont = process.env.PDF_FONT_PATH || process.env.REPORT_PDF_FONT;
  if (envFont && existsSync(envFont)) {
    this.logger.info(`Using PDF font from env: ${envFont}`);
    (this.constructor as any).cachedFontPath = envFont;
    return envFont;
  }

  // 2. Bundled font (if available)
  const bundledFont = resolve(__dirname, '../../assets/fonts/NotoSansCJK-Regular.ttc');
  if (existsSync(bundledFont)) {
    this.logger.info(`Using bundled PDF font: ${bundledFont}`);
    (this.constructor as any).cachedFontPath = bundledFont;
    return bundledFont;
  }

  // 3. Platform-specific fonts
  const normalizePath = (p: string) => p.replace(/\\/g, '/');

  const candidates: Record<string, string[]> = {
    win32: [
      'C:/Windows/Fonts/msyh.ttf',
      'C:/Windows/Fonts/msyhbd.ttf',
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/simsun.ttc',
      'C:/Windows/Fonts/simkai.ttf',
    ],
    darwin: [
      '/Library/Fonts/Arial Unicode.ttf',
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
    ],
    linux: [
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJKsc-Regular.otf',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ],
  };

  const platform = process.platform as keyof typeof candidates;
  const platformFonts = candidates[platform] || [];

  for (const font of platformFonts) {
    if (existsSync(font)) {
      this.logger.info(`Using system PDF font: ${font}`);
      (this.constructor as any).cachedFontPath = font;
      return font;
    }
  }

  // 4. Final fallback
  this.logger.warn('No CJK font found for PDF, Chinese characters will not display correctly');
  this.logger.warn('Set PDF_FONT_PATH environment variable or install Noto Sans CJK');
  (this.constructor as any).cachedFontPath = 'Helvetica';
  return 'Helvetica';
}
```

- [ ] **Step 2: Add font validation on startup**

Add to `reports.module.ts` `onModuleInit`:

```typescript
async onModuleInit() {
  // Validate font availability
  const testService = new ReportsService(this.prisma);
  const font = testService['resolvePdfFont']('zh');
  if (font === 'Helvetica') {
    this.logger.warn('PDF CJK font not available - install Noto Sans CJK or set PDF_FONT_PATH');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/reports/reports.service.ts apps/backend/src/reports/reports.module.ts
git commit -m "feat(reports): improve PDF font resolution with fallback chain"
```

---

## Phase 6: Manual Testing Checklist

### Task 6.1: Create Testing Documentation

**Files:**
- Create: `docs/TESTING.md`

- [ ] **Step 1: Write comprehensive testing guide**

Create `docs/TESTING.md`:

```markdown
# Testing Guide

This document provides comprehensive testing checklists for Homework AI.

## Pre-Deployment Verification

### Services Check

- [ ] MySQL is running and accessible
- [ ] Redis is running and accessible
- [ ] MinIO is running and accessible
- [ ] Backend API is running on configured port
- [ ] Worker is running (check `ps aux | grep worker`)
- [ ] Frontend is accessible via configured URL

### Health Check

```bash
curl http://your-domain/api/health
```

Expected: `{"status":"healthy","timestamp":"..."}`

### Configuration Validation

```bash
cd apps/backend
pnpm config:validate
```

Expected: All required fields marked as configured

---

## Student End Testing

**Test Account:** `student01` / `123456` (or configured password)

### Authentication

- [ ] Login with student credentials
- [ ] Logout works correctly
- [ ] Token refresh works (no re-login after 1 hour)

### Homework Viewing

- [ ] View homework list
- [ ] See upcoming homework with due dates
- [ ] See past homework
- [ ] Homework details display correctly

### Homework Submission

- [ ] Submit single image
- [ ] Submit multiple images (2-3)
- [ ] See submission status change (QUEUED → PROCESSING → DONE)
- [ ] View submission result after grading
- [ ] See score and feedback
- [ ] View corrected text
- [ ] Download original images

### Submission History

- [ ] View all past submissions
- [ ] Filter by homework
- [ ] See submission status for each
- [ ] Re-submit if allowed

### Learning Report

- [ ] View learning report
- [ ] See average score trend
- [ ] See error type distribution
- [ ] See next step recommendations
- [ ] Export report as PDF (if available)

---

## Teacher End Testing

**Test Account:** `teacher01` / `123456` (or configured password)

### Authentication

- [ ] Login with teacher credentials
- [ ] Access all classes
- [ ] See class roster

### Homework Management

- [ ] Create new homework
- [ ] Set due date and time
- [ ] Edit existing homework
- [ ] Delete homework (no submissions)
- [ ] Publish homework announcement
- [ ] Unpublish homework

### Student Submissions

- [ ] View all submissions for a homework
- [ ] Filter by submission status
- [ ] View individual submission details
- [ ] See student information
- [ ] Download submitted images
- [ ] View grading results

### Batch Upload

- [ ] Upload single images (drag & drop)
- [ ] Upload ZIP file with multiple images
- [ ] See upload progress
- [ ] Verify student matching from filename
- [ ] Handle unmatched files
- [ ] Retry skipped submissions
- [ ] View upload results summary

### Reports

- [ ] View class overview report
- [ ] See submission statistics
- [ ] See score distribution
- [ ] See top students
- [ ] Export class report as PDF
- [ ] Export class report as CSV

### Student Reports

- [ ] Select student from class
- [ ] View individual student report
- [ ] See student submission history
- [ ] See student progress trend
- [ ] Export student report as PDF

### Announcements

- [ ] Create class announcement
- [ ] Edit announcement
- [ ] Delete announcement
- [ ] Students see announcements

### Grading Settings

- [ ] Configure class grading policy
- [ ] Configure homework-specific policy
- [ ] Enable/disable rewrite requirement
- [ ] Set LLM mode (cheap/quality)

---

## Admin End Testing

**Test Account:** `admin` / `123456` (or configured password)

### Dashboard

- [ ] View system metrics
- [ ] See total users count
- [ ] See total submissions count
- [ ] See recent activity
- [ ] View LLM usage summary

### User Management

- [ ] List all users
- [ ] Filter by role
- [ ] Search by name/account
- [ ] Create new user
- [ ] Edit user information
- [ ] Reset user password
- [ ] Disable/enable user
- [ ] Delete user
- [ ] Bulk import users (CSV)
- [ ] Bulk disable users
- [ ] Bulk reset passwords
- [ ] Export users as CSV

### Class Management

- [ ] View all classes
- [ ] See class summaries
- [ ] View class student count
- [ ] View class submission statistics

### System Configuration

- [ ] View current configuration
- [ ] Update LLM settings
- [ ] Update budget limits
- [ ] Update retention policy
- [ ] Test LLM connection
- [ ] Test OCR connection
- [ ] Test storage connection
- [ ] Test email connection

### Queue Monitoring

- [ ] View queue metrics
- [ ] See waiting/active/completed/failed counts
- [ ] View failed jobs list
- [ ] Retry failed jobs
- [ ] Clean completed jobs
- [ ] Pause queue
- [ ] Resume queue
- [ ] See worker health status
- [ ] View queue trends

### LLM Logs

- [ ] View LLM call logs
- [ ] Filter by date range
- [ ] Filter by user/submission
- [ ] See token usage
- [ ] See cost summary
- [ ] Clear old logs

### Audit Logs

- [ ] View audit trail
- [ ] Filter by action type
- [ ] Filter by user
- [ ] See IP addresses
- [ ] Export audit logs

### Feature Flags

- [ ] View all feature flags
- [ ] Enable/disable features
- [ ] See feature flag history

---

## Integration Testing

### Full Submission Flow

1. Teacher creates homework
2. Student views homework
3. Student submits images
4. Status changes to QUEUED
5. Worker picks up job
6. Status changes to PROCESSING
7. OCR processes images
8. LLM grades submission
9. Status changes to DONE
10. Student views result
11. Teacher views submission

### Batch Upload Flow

1. Teacher prepares ZIP with named images
2. Teacher uploads ZIP
3. System extracts and processes
4. Submissions created for matched students
5. Worker processes submissions
6. Results available in class view

### Report Generation

1. Multiple submissions exist for class
2. Teacher generates class report
3. PDF downloads correctly
4. Chinese characters display correctly
5. Charts render properly
6. CSV exports correctly

---

## Performance Testing

### Load Testing

```bash
# Submit 10 concurrent homework submissions
for i in {1..10}; do
  curl -X POST http://localhost/api/submissions \
    -H "Authorization: Bearer $TOKEN" \
    -F "homeworkId=$HOMEWORK_ID" \
    -F "images=@test.jpg" &
done
```

- [ ] All submissions accepted
- [ ] Worker processes all without error
- [ ] Queue doesn't grow indefinitely

### Memory Testing

- [ ] Upload 100MB ZIP file
- [ ] Process 50-image ZIP
- [ ] Generate large class report (100+ students)
- [ ] Monitor memory usage stays within limits

---

## Error Handling

### Worker Failure Scenarios

- [ ] Worker stopped mid-processing
- [ ] Redis connection lost
- [ ] MinIO unavailable
- [ ] LLM API timeout
- [ ] LLM API returns error

### Frontend Error Scenarios

- [ ] Network timeout
- [ ] Server error (500)
- [ ] Unauthorized access
- [ ] Invalid file upload
- [ ] Oversized file upload

---

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Regression Testing

After each deployment, verify:

- [ ] No existing features broken
- [ ] All user roles can login
- [ ] Submission flow works end-to-end
- [ ] Reports generate correctly
- [ ] Configuration changes apply

---

## Troubleshooting

### Issues and Solutions

| Issue | Solution |
|-------|----------|
| Login fails | Check JWT_SECRET matches between services |
| Submissions stuck QUEUED | Restart worker, check Redis connection |
| PDF shows boxes | Install CJK font or set PDF_FONT_PATH |
| Images not uploading | Check MinIO connection and credentials |
| Grading fails | Verify LLM_API_KEY is valid and has credits |
| ZIP upload fails | Check file size limits, error message |
```

- [ ] **Step 2: Commit**

```bash
git add docs/TESTING.md
git commit -m "docs: add comprehensive testing checklist"
```

---

## Phase 7: Automated E2E Tests

### Task 7.1: Set Up E2E Test Infrastructure

**Files:**
- Create: `apps/backend/e2e/jest.e2e.json`
- Create: `apps/backend/e2e/test-setup.ts`
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Create E2E Jest config**

Create `apps/backend/e2e/jest.e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/../src/$1"
  }
}
```

- [ ] **Step 2: Create test setup**

Create `apps/backend/e2e/test-setup.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

export async function createE2EApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

export async function cleanupE2EApp(app: INestApplication): Promise<void> {
  await app.close();
}
```

- [ ] **Step 3: Add E2E scripts**

Add to `apps/backend/package.json`:

```json
{
  "scripts": {
    "test:e2e": "jest --config e2e/jest.e2e.json",
    "test:e2e:watch": "jest --config e2e/jest.e2e.json --watch",
    "test:e2e:coverage": "jest --config e2e/jest.e2e.json --coverage"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/e2e apps/backend/package.json
git commit -m "test(e2e): add E2E test infrastructure"
```

---

### Task 7.2: Write Authentication E2E Test

**Files:**
- Create: `apps/backend/e2e/auth.e2e-spec.ts`

- [ ] **Step 1: Write auth E2E test**

Create `apps/backend/e2e/auth.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp, cleanupE2EApp } from './test-setup';

describe('Authentication E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    app = await createE2EApp();
  });

  afterAll(async () => {
    await cleanupE2EApp(app);
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          account: 'student01',
          password: '123456',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('role');

      authToken = response.body.accessToken;
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          account: 'student01',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should reject missing credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/api/homeworks')
        .expect(401);
    });

    it('should reject protected route with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/homeworks')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('account');
      expect(response.body).toHaveProperty('name');
      expect(response.body).not.toHaveProperty('password');
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/e2e/auth.e2e-spec.ts
git commit -m "test(e2e): add authentication E2E tests"
```

---

### Task 7.3: Write Submission E2E Test

**Files:**
- Create: `apps/backend/e2e/submission.e2e-spec.ts`

- [ ] **Step 1: Write submission E2E test**

Create `apps/backend/e2e/submission.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp, cleanupE2EApp } from './test-setup';
import * as fs from 'fs';
import * as path from 'path';

describe('Submission E2E', () => {
  let app: INestApplication;
  let studentToken: string;
  let teacherToken: string;
  let homeworkId: string;
  let submissionId: string;

  beforeAll(async () => {
    app = await createE2EApp();

    // Login as student
    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ account: 'student01', password: '123456' });
    studentToken = studentLogin.body.accessToken;

    // Login as teacher
    const teacherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ account: 'teacher01', password: '123456' });
    teacherToken = teacherLogin.body.accessToken;

    // Create test homework
    const homework = await request(app.getHttpServer())
      .post('/api/homeworks')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'E2E Test Homework',
        content: 'Write about your hobby',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    homeworkId = homework.body.id;
  });

  afterAll(async () => {
    await cleanupE2EApp(app);
  });

  describe('Student Submission Flow', () => {
    it('should create a submission', async () => {
      const testImagePath = path.join(__dirname, 'fixtures/test-image.jpg');

      // Create test image if not exists
      if (!fs.existsSync(path.dirname(testImagePath))) {
        fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
      }
      if (!fs.existsSync(testImagePath)) {
        // Create minimal JPEG
        const minimalJpg = Buffer.from(
          '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////wAALCAACAgIDAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AT//Z'
        );
        fs.writeFileSync(testImagePath, minimalJpg);
      }

      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('homeworkId', homeworkId)
        .attach('images', testImagePath)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('QUEUED');
      submissionId = response.body.id;
    });

    it('should get submission by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.id).toBe(submissionId);
    });

    it('should list student submissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Teacher Submission Viewing', () => {
    it('should get class submissions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/homeworks/${homeworkId}/submissions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get submission details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/teacher/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('homework');
    });
  });

  describe('Grading Polling', () => {
    it('should eventually complete grading (with timeout)', async () => {
      const startTime = Date.now();
      const timeout = 60000; // 1 minute timeout

      while (Date.now() - startTime < timeout) {
        const response = await request(app.getHttpServer())
          .get(`/api/submissions/${submissionId}`)
          .set('Authorization', `Bearer ${studentToken}`);

        const status = response.body.status;

        if (status === 'DONE') {
          expect(response.body).toHaveProperty('totalScore');
          expect(response.body).toHaveProperty('gradingJson');
          return;
        }

        if (status === 'FAILED') {
          throw new Error('Submission failed during grading');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      throw new Error('Grading did not complete within timeout');
    }, 70000);
  });

  describe('Report Generation', () => {
    it('should generate student report', async () => {
      await request(app.getHttpServer())
        .get('/api/reports/student')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ days: 7 })
        .expect(200);
    });

    it('should export class CSV as teacher', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/class/csv')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ classId: homeworkId, days: 7 })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/e2e/submission.e2e-spec.ts
git commit -m "test(e2e): add submission flow E2E tests"
```

---

### Task 7.4: Write Remaining E2E Tests

**Files:**
- Create: `apps/backend/e2e/batch-upload.e2e-spec.ts`
- Create: `apps/backend/e2e/report.e2e-spec.ts`

- [ ] **Step 1: Write batch upload E2E**

Create `apps/backend/e2e/batch-upload.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp, cleanupE2EApp } from './test-setup';
import * as archiver from 'archiver';

describe('Batch Upload E2E', () => {
  let app: INestApplication;
  let teacherToken: string;
  let homeworkId: string;

  beforeAll(async () => {
    app = await createE2EApp();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ account: 'teacher01', password: '123456' });
    teacherToken = login.body.accessToken;

    const homework = await request(app.getHttpServer())
      .post('/api/homeworks')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Batch Upload Test',
        content: 'Test content',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    homeworkId = homework.body.id;
  });

  afterAll(async () => {
    await cleanupE2EApp(app);
  });

  async function createTestZip(filenames: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const zip = archiver('zip');
      const chunks: Buffer[] = [];

      zip.on('data', (chunk) => chunks.push(chunk));
      zip.on('end', () => resolve(Buffer.concat(chunks)));
      zip.on('error', reject);

      // Create minimal JPEG for each file
      const minimalJpg = Buffer.from(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////wAALCAACAgIDAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AT//Z'
      );

      filenames.forEach(name => {
        zip.append(minimalJpg, { name });
      });

      zip.finalize();
    });
  }

  it('should upload ZIP with multiple images', async () => {
    const zipBuffer = await createTestZip([
      '2023001_homework.jpg',
      '2023002_essay.jpg',
      '2023003_test.jpg',
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/teacher/batch-upload')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('homeworkId', homeworkId)
      .attach('zip', zipBuffer, 'submissions.zip')
      .expect(201);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('matched');
    expect(response.body).toHaveProperty('skipped');
  });

  it('should reject oversized ZIP', async () => {
    // Create ZIP larger than limit
    const largeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB

    await request(app.getHttpServer())
      .post('/api/teacher/batch-upload')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('homeworkId', homeworkId)
      .attach('zip', largeBuffer, 'large.zip')
      .expect(400);
  });
});
```

- [ ] **Step 2: Write report E2E**

Create `apps/backend/e2e/report.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2EApp, cleanupE2EApp } from './test-setup';

describe('Report E2E', () => {
  let app: INestApplication;
  let studentToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    app = await createE2EApp();

    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ account: 'student01', password: '123456' });
    studentToken = studentLogin.body.accessToken;

    const teacherLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ account: 'teacher01', password: '123456' });
    teacherToken = teacherLogin.body.accessToken;
  });

  afterAll(async () => {
    await cleanupE2EApp(app);
  });

  describe('Student Reports', () => {
    it('should get student overview', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/student')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ days: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('studentId');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('trend');
    });

    it('should get student class comparison', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/student/comparison')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ rangeDays: 30 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Class Reports', () => {
    it('should get class overview', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/class')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ classId: 'test-class', days: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('className');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('distribution');
    });

    it('should export class CSV', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/class/csv')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ classId: 'test-class', days: 7 })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should export class PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/class/pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ classId: 'test-class', days: 7, lang: 'zh' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.body.length).toBeGreaterThan(1000);
    });

    it('should export student PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/reports/student/pdf')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ days: 7, lang: 'en' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
    });
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/e2e/batch-upload.e2e-spec.ts apps/backend/e2e/report.e2e.spec.ts
git commit -m "test(e2e): add batch upload and report E2E tests"
```

---

## Final Steps

### Task 8.1: Update Root Package.json Scripts

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add convenience scripts**

Add to root `package.json`:

```json
{
  "scripts": {
    "config:validate": "ts-node scripts/config-validator.ts",
    "test:e2e": "pnpm --filter backend test:e2e",
    "deploy:docker": "docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d",
    "deploy:docker:build": "docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add convenience npm scripts for deployment and testing"
```

---

### Task 8.2: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add deployment links**

Add to README deployment section:

```markdown
## Deployment

Choose your deployment approach:

- [**Deployment Guide**](docs/DEPLOY-LANDING.md) - Choose between Docker and systemd
- [**Docker Deployment**](docs/DEPLOY-Docker.md) - Quick containerized setup
- [**systemd Deployment**](docs/DEPLOY.md) - Production Linux deployment

## Testing

- [**Testing Guide**](docs/TESTING.md) - Comprehensive testing checklist
- [**Development Guide**](docs/DEVELOPMENT.md) - Local development setup
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with deployment and testing links"
```

---

### Task 8.3: Create Implementation Summary

**Files:**
- Create: `docs/IMPLEMENTATION-SUMMARY.md`

- [ ] **Step 1: Write implementation summary**

Create `docs/IMPLEMENTATION-SUMMARY.md`:

```markdown
# Deployment Stability Implementation Summary

**Completed:** 2026-04-04
**Status:** ✅ Complete

## Overview

This implementation improves Homework AI's deployment experience and system stability through configuration optimization, documentation enhancement, and critical function improvements.

## What Was Delivered

### 1. Configuration Management

- ✅ Restructured `.env.example` with logical grouping
- ✅ Created configuration validator service
- ✅ Added standalone config validation script
- ✅ Added `/api/public/config/validate` endpoint

**Usage:**
```bash
pnpm config:validate
```

### 2. Deployment Documentation

- ✅ Created `docs/DEPLOY-LANDING.md` - Deployment selection guide
- ✅ Created `docs/DEPLOY-Docker.md` - Comprehensive Docker deployment
- ✅ Enhanced `docs/DEPLOY.md` - Added Docker references

**Quick Start:**
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

### 3. Batch Upload Stability

- ✅ Implemented streaming ZIP extraction using yauzl
- ✅ Added size validation before extraction
- ✅ Reduced memory usage for large ZIP files
- ✅ Added tests for streaming extraction

**Benefits:**
- Handles 100MB+ ZIP files without OOM
- Constant memory usage regardless of ZIP size
- Early rejection of oversized files

### 4. Queue Monitoring

- ✅ Added queue monitoring API endpoints
- ✅ Created `/admin/queue` monitoring page
- ✅ Implemented real-time status updates
- ✅ Added alert thresholds (backlog, failure rate, worker health)
- ✅ Added queue trends visualization

**Features:**
- Real-time queue metrics (waiting, active, completed, failed)
- Failed jobs list with retry functionality
- Worker health monitoring
- 7-day trend charts

### 5. PDF Export Optimization

- ✅ Improved font resolution with multi-tier fallback
- ✅ Added bundled CJK font support path
- ✅ Enhanced platform-specific font detection
- ✅ Added font validation on startup

**Fallback Chain:**
1. Environment variable `PDF_FONT_PATH`
2. Bundled Noto Sans CJK (if downloaded)
3. Platform-specific fonts (Windows/macOS/Linux)
4. Helvetica with warning

### 6. Testing Documentation

- ✅ Created comprehensive `docs/TESTING.md`
- ✅ Covers all user roles (student, teacher, admin)
- ✅ Includes integration testing scenarios
- ✅ Performance and error handling tests
- ✅ Browser compatibility checklist

### 7. E2E Test Suite

- ✅ Set up E2E test infrastructure
- ✅ Created authentication E2E tests
- ✅ Created submission flow E2E tests
- ✅ Created batch upload E2E tests
- ✅ Created report generation E2E tests

**Run:**
```bash
pnpm test:e2e
```

## New Files Created

```
docs/
├── DEPLOY-LANDING.md
├── DEPLOY-Docker.md
├── TESTING.md
└── IMPLEMENTATION-SUMMARY.md

apps/backend/src/common/config-validator/
├── config-validator.service.ts
├── config-validator.controller.ts
├── config-validator.module.ts
└── dto/validate-config.dto.ts

apps/backend/e2e/
├── jest.e2e.json
├── test-setup.ts
├── auth.e2e-spec.ts
├── submission.e2e-spec.ts
├── batch-upload.e2e-spec.ts
└── report.e2e-spec.ts

apps/frontend/src/pages/admin/QueueMonitoring/
├── index.tsx
├── QueueStatus.tsx
├── FailedJobs.tsx
├── WorkerHealth.tsx
└── QueueTrends.tsx

scripts/
└── config-validator.ts
```

## Configuration Changes

### Environment Variables

`.env.example` now organized into groups:
- Core Services
- AI Services
- Storage & Email
- Runtime Policies
- Batch Upload Limits
- Server Configuration

### New API Endpoints

```
GET  /api/public/config/validate  - Validate configuration
GET  /api/admin/queue/alerts      - Get queue alerts
GET  /api/admin/queue/worker-health - Get worker health
GET  /api/admin/queue/trends      - Get queue trends
```

### New Frontend Routes

```
/admin/queue - Queue monitoring dashboard
```

## Migration Guide

### For Existing Deployments

1. Pull latest code
2. Run database migrations (if any)
3. Update `.env` to match new grouped structure
4. Restart services
5. Verify with `pnpm config:validate`

### For New Deployments

See [DEPLOY-LANDING.md](./DEPLOY-LANDING.md) to choose your deployment approach.

## Testing

Run the full test suite:

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Manual testing
# Follow docs/TESTING.md checklist
```

## Known Limitations

1. **PDF CJK Font**: Must be manually downloaded for Chinese support
   - Run: `cd apps/backend/assets/fonts && curl -L -O https://github.com/googlefonts/noto-cjk/releases/download/Sans2.004/NotoSansCJK-Regular.ttc`

2. **Queue Monitoring Alerts**: Email notifications not implemented (visual only)

3. **E2E Tests**: Require test database with seeded users

## Future Enhancements

- [ ] Email notifications for queue alerts
- [ ] Automated backup scripts
- [ ] Performance benchmarking suite
- [ ] Multi-school deployment support
- [ ] Queue metrics export

## Support

For issues or questions:
- Check [RUNBOOK.md](./RUNBOOK.md) for troubleshooting
- Review [TESTING.md](./TESTING.md) for verification
- See GitHub Issues for known problems
```

- [ ] **Step 2: Final commit**

```bash
git add docs/IMPLEMENTATION-SUMMARY.md
git commit -m "docs: add implementation summary for deployment stability"
```

---

## Summary

This plan provides a complete roadmap for improving Homework AI's deployment experience and system stability. The implementation is organized into phases that can be executed independently:

1. **Phase 1**: Configuration optimization
2. **Phase 2**: Docker documentation
3. **Phase 3**: Batch upload stability
4. **Phase 4**: Queue monitoring
5. **Phase 5**: PDF export optimization
6. **Phase 6**: Testing documentation
7. **Phase 7**: E2E automation
8. **Phase 8**: Final integration

Total estimated effort: 11-17 days

**Next Step:** Choose execution approach (Subagent-Driven or Inline)
