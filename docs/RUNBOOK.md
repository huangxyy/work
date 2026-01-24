# Runbook

## Retention cleanup (7 days)

### Controls
- `RUN_RETENTION=true` enables cron execution (set this only on `backend-api`).
- `RUN_RETENTION=false` or unset on `backend-worker`.
- `RETENTION_DAYS=7`, `RETENTION_BATCH_SIZE=200`, `RETENTION_DRY_RUN=false`, `RETENTION_CRON=30 3 * * *`.

### Manual dry-run
```bash
curl -X POST "http://localhost:3000/api/admin/retention/run" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"days":7,"batchSize":200}'
```

### Manual run
```bash
curl -X POST "http://localhost:3000/api/admin/retention/run" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"days":7,"batchSize":200}'
```

### Verification script
```powershell
powershell -ExecutionPolicy Bypass -File scripts/retention/verify-retention.ps1
```

Script inputs (environment variables):
- `API_BASE_URL` (default `http://localhost:3000/api`)
- `ADMIN_TOKEN` (optional; skips login/register)
- `ADMIN_ACCOUNT`, `ADMIN_PASSWORD`, `ADMIN_NAME`
- `RETENTION_DAYS`, `RETENTION_BATCH_SIZE`
