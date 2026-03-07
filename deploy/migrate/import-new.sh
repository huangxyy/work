#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/homework-ai}"
IMPORT_DIR="${IMPORT_DIR:-}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${APP_DIR}/apps/backend/.env}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/aigzy.cn}"
API_SERVICE="${API_SERVICE:-homework-ai-api}"
WORKER_SERVICE="${WORKER_SERVICE:-homework-ai-worker}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
RESTORE_MINIO_DATA="${RESTORE_MINIO_DATA:-0}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-/var/lib/minio/data}"
MINIO_BUCKET="${MINIO_BUCKET:-submissions}"
CHECK_HEALTH="${CHECK_HEALTH:-1}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3008/api/health}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_IMPORT] $*"
}

fail() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_IMPORT] [ERROR] $*" >&2
  exit 1
}

main() {
  [ -n "${IMPORT_DIR}" ] || fail "请设置 IMPORT_DIR"
  [ -d "${IMPORT_DIR}" ] || fail "导入目录不存在：${IMPORT_DIR}"
  [ -d "${APP_DIR}" ] || fail "APP_DIR 不存在：${APP_DIR}"
  [ -f "${BACKEND_ENV_FILE}" ] || fail "后端 .env 不存在：${BACKEND_ENV_FILE}"

  command -v mysql >/dev/null 2>&1 || fail "未找到 mysql"
  command -v gunzip >/dev/null 2>&1 || fail "未找到 gunzip"
  command -v systemctl >/dev/null 2>&1 || fail "未找到 systemctl"

  local db_file
  db_file="$(ls -1 "${IMPORT_DIR}"/*.sql.gz 2>/dev/null | head -n 1 || true)"
  [ -n "${db_file}" ] || fail "未找到数据库备份文件（*.sql.gz）"

  log "恢复数据库：${db_file}"
  local db_url db_user db_pass db_host db_port db_name
  db_url="$(grep -E '^DATABASE_URL=' "${BACKEND_ENV_FILE}" | head -n 1 | cut -d'=' -f2-)"
  db_user="$(printf '%s' "${db_url}" | sed -E 's#^[a-zA-Z0-9+.-]+://([^:/@]+).*#\1#')"
  db_pass="$(printf '%s' "${db_url}" | sed -nE 's#^[a-zA-Z0-9+.-]+://[^:]+:([^@]+)@.*#\1#p')"
  db_host="$(printf '%s' "${db_url}" | sed -E 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?([^:/?]+).*#\2#')"
  db_port="$(printf '%s' "${db_url}" | sed -nE 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?[^:/?]+:([0-9]+).*$#\2#p')"
  db_name="$(printf '%s' "${db_url}" | sed -E 's#^[a-zA-Z0-9+.-]+://[^/]+/([^?]+).*$#\1#')"
  db_port="${db_port:-3306}"

  MYSQL_PWD="${db_pass}" gunzip -c "${db_file}" | mysql -h "${db_host}" -P "${db_port}" -u "${db_user}" "${db_name}"

  if [ "${RESTORE_MINIO_DATA}" = "1" ]; then
    local minio_tar="${IMPORT_DIR}/minio-${MINIO_BUCKET}.tar.gz"
    [ -f "${minio_tar}" ] || fail "未找到 MinIO 备份包：${minio_tar}"
    log "恢复 MinIO 数据：${minio_tar}"
    mkdir -p "${MINIO_DATA_DIR}"
    tar -C "${MINIO_DATA_DIR}" -xzf "${minio_tar}"
  fi

  cd "${APP_DIR}"
  corepack enable
  corepack prepare pnpm@8.15.9 --activate
  pnpm install --frozen-lockfile
  pnpm --filter backend prisma:generate
  if [ "${RUN_MIGRATIONS}" = "1" ]; then
    pnpm --filter backend exec prisma migrate deploy
  fi
  pnpm --filter backend build
  VITE_API_BASE_URL=/api pnpm --filter frontend build

  mkdir -p "${WEB_ROOT}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${APP_DIR}/apps/frontend/dist/" "${WEB_ROOT}/"
  else
    rm -rf "${WEB_ROOT:?}"/*
    cp -a "${APP_DIR}/apps/frontend/dist/." "${WEB_ROOT}/"
  fi

  systemctl restart "${API_SERVICE}" "${WORKER_SERVICE}"
  systemctl is-active --quiet "${API_SERVICE}"
  systemctl is-active --quiet "${WORKER_SERVICE}"

  if [ "${CHECK_HEALTH}" = "1" ]; then
    bash "${APP_DIR}/deploy/healthcheck.sh" --url "${HEALTH_URL}" --max-attempts 20 --retry-interval 3
  fi

  log "新机导入与启动完成"
}

main "$@"
