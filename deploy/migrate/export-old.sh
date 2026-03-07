#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/homework-ai}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${APP_DIR}/apps/backend/.env}"
EXPORT_ROOT="${EXPORT_ROOT:-${APP_DIR}/backups/migrate}"
TIMESTAMP="${TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}"
EXPORT_DIR="${EXPORT_DIR:-${EXPORT_ROOT}/${TIMESTAMP}}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
DB_NAME="${DB_NAME:-homework_ai}"
DB_USER="${DB_USER:-homework_ai}"
DB_PASS="${DB_PASS:-}"
MINIO_SYNC_ENABLED="${MINIO_SYNC_ENABLED:-0}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-/var/lib/minio/data}"
MINIO_BUCKET="${MINIO_BUCKET:-submissions}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_EXPORT] $*"
}

fail() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_EXPORT] [ERROR] $*" >&2
  exit 1
}

extract_env_value() {
  local key="$1"
  awk -F '=' -v target="${key}" '
    $0 ~ /^[[:space:]]*#/ { next }
    $1 == target {
      v = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
      gsub(/^"|"$/, "", v)
      print v
      exit
    }
  ' "${BACKEND_ENV_FILE}"
}

main() {
  [ -d "${APP_DIR}" ] || fail "APP_DIR 不存在：${APP_DIR}"
  [ -f "${BACKEND_ENV_FILE}" ] || fail "后端 .env 不存在：${BACKEND_ENV_FILE}"
  command -v mysqldump >/dev/null 2>&1 || fail "未找到 mysqldump"
  command -v gzip >/dev/null 2>&1 || fail "未找到 gzip"

  mkdir -p "${EXPORT_DIR}"
  log "导出目录：${EXPORT_DIR}"

  if [ -z "${DB_PASS}" ]; then
    DB_PASS="$(extract_env_value DB_PASS || true)"
  fi

  local db_file="${EXPORT_DIR}/${DB_NAME}.sql.gz"
  log "导出 MySQL：${DB_NAME}"
  MYSQL_PWD="${DB_PASS}" mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "${DB_NAME}" | gzip -c > "${db_file}"

  [ -s "${db_file}" ] || fail "数据库导出失败：${db_file}"
  log "数据库导出完成：${db_file}"

  if [ "${MINIO_SYNC_ENABLED}" = "1" ]; then
    [ -d "${MINIO_DATA_DIR}/${MINIO_BUCKET}" ] || fail "MinIO 数据目录不存在：${MINIO_DATA_DIR}/${MINIO_BUCKET}"
    local minio_tar="${EXPORT_DIR}/minio-${MINIO_BUCKET}.tar.gz"
    log "导出 MinIO Bucket：${MINIO_BUCKET}"
    tar -C "${MINIO_DATA_DIR}" -czf "${minio_tar}" "${MINIO_BUCKET}"
    [ -s "${minio_tar}" ] || fail "MinIO 导出失败：${minio_tar}"
    log "MinIO 导出完成：${minio_tar}"
  else
    log "已跳过 MinIO 导出（MINIO_SYNC_ENABLED=${MINIO_SYNC_ENABLED}）"
  fi

  cat > "${EXPORT_DIR}/manifest.txt" <<EOF
timestamp=${TIMESTAMP}
db_file=$(basename "${db_file}")
minio_sync_enabled=${MINIO_SYNC_ENABLED}
minio_bucket=${MINIO_BUCKET}
generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

  log "导出完成，可将目录同步到新机：${EXPORT_DIR}"
}

main "$@"
