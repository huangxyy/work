#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  echo "已加载主机配置：${ENV_FILE}"
fi

APP_DIR="${APP_DIR:-/www/homework-ai}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/aigzy.cn}"
BRANCH="${BRANCH:-main}"
PNPM_VERSION="${PNPM_VERSION:-8.15.9}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
USE_SUDO="${USE_SUDO:-1}"
API_SERVICE="${API_SERVICE:-homework-ai-api}"
WORKER_SERVICE="${WORKER_SERVICE:-homework-ai-worker}"
API_PORT="${API_PORT:-3008}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}"
CHECK_HEALTH="${CHECK_HEALTH:-1}"
REQUIRE_HEALTHY="${REQUIRE_HEALTHY:-0}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${API_PORT}/api/health}"
HEALTH_MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-20}"
HEALTH_RETRY_INTERVAL="${HEALTH_RETRY_INTERVAL:-3}"
LOCK_FILE="${LOCK_FILE:-/tmp/homework-ai-deploy.lock}"
STRICT_GIT_CLEAN="${STRICT_GIT_CLEAN:-1}"
BACKUP_BEFORE_MIGRATION="${BACKUP_BEFORE_MIGRATION:-1}"
DB_BACKUP_DIR="${DB_BACKUP_DIR:-${APP_DIR}/backups/db}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DB_NAME="${DB_NAME:-homework_ai}"
DB_USER="${DB_USER:-homework_ai}"
DB_PASS="${DB_PASS:-}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"

SUDO=""
if [ "${USE_SUDO}" = "1" ] && [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "USE_SUDO=1 但未找到 sudo。" >&2
    exit 1
  fi
fi

run_cmd() {
  echo "==> $*"
  "$@"
}

run_with_sudo() {
  if [ -n "${SUDO}" ]; then
    echo "==> ${SUDO} $*"
    ${SUDO} "$@"
  else
    run_cmd "$@"
  fi
}

acquire_lock() {
  if ! command -v flock >/dev/null 2>&1; then
    echo "未找到 flock，将在无部署锁模式下继续。" >&2
    return
  fi

  mkdir -p "$(dirname "${LOCK_FILE}")"
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    echo "检测到其他部署任务正在运行（锁文件：${LOCK_FILE}）。" >&2
    exit 1
  fi
}

print_service_debug() {
  set +e
  echo "部署失败，正在输出最近服务状态..." >&2
  if command -v systemctl >/dev/null 2>&1; then
    if [ -n "${SUDO}" ]; then
      ${SUDO} systemctl status "${API_SERVICE}" --no-pager -n 40 || true
      ${SUDO} systemctl status "${WORKER_SERVICE}" --no-pager -n 40 || true
    else
      systemctl status "${API_SERVICE}" --no-pager -n 40 || true
      systemctl status "${WORKER_SERVICE}" --no-pager -n 40 || true
    fi
  fi
}

backup_database() {
  if [ "${BACKUP_BEFORE_MIGRATION}" != "1" ]; then
    echo "==> 已跳过数据库备份（BACKUP_BEFORE_MIGRATION=${BACKUP_BEFORE_MIGRATION}）"
    return
  fi

  local backup_script="${APP_DIR}/deploy/backup-db.sh"
  if [ -f "${backup_script}" ]; then
    run_cmd bash "${backup_script}" \
      --output-dir "${DB_BACKUP_DIR}" \
      --retention-days "${BACKUP_RETENTION_DAYS}"
    return
  fi

  if [ -z "${DB_PASS}" ]; then
    echo "DB_PASS 为空，已跳过数据库备份。" >&2
    return
  fi

  if ! command -v mysqldump >/dev/null 2>&1; then
    echo "未找到 mysqldump，无法在迁移前执行数据库备份。" >&2
    exit 1
  fi

  run_cmd mkdir -p "${DB_BACKUP_DIR}"
  local timestamp backup_file
  timestamp="$(date +%Y%m%d_%H%M%S)"
  backup_file="${DB_BACKUP_DIR}/${DB_NAME}_${timestamp}.sql.gz"

  echo "==> 正在备份数据库到 ${backup_file}"
  MYSQL_PWD="${DB_PASS}" mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "${DB_NAME}" | gzip -c > "${backup_file}"

  if [ ! -s "${backup_file}" ]; then
    echo "备份失败：${backup_file} 为空。" >&2
    exit 1
  fi

  if [[ "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]+$ ]] && [ "${BACKUP_RETENTION_DAYS}" -gt 0 ]; then
    find "${DB_BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  fi
}

trap print_service_debug ERR

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "应用目录不是 Git 仓库：${APP_DIR}" >&2
  echo "请先执行 deploy/install-host.sh。" >&2
  exit 1
fi

acquire_lock

if [ "${STRICT_GIT_CLEAN}" = "1" ] && [ -n "$(git -C "${APP_DIR}" status --porcelain --untracked-files=no)" ]; then
  echo "${APP_DIR} 存在本地改动，STRICT_GIT_CLEAN=1 时拒绝发布。" >&2
  echo "请先提交/暂存改动，或将 STRICT_GIT_CLEAN 设为 0 后再发布。" >&2
  exit 1
fi

previous_rev="$(git -C "${APP_DIR}" rev-parse HEAD)"

run_cmd git -C "${APP_DIR}" fetch origin --prune
run_cmd git -C "${APP_DIR}" checkout "${BRANCH}"
run_cmd git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"

cd "${APP_DIR}"

run_cmd corepack enable
run_cmd corepack prepare "pnpm@${PNPM_VERSION}" --activate
run_cmd pnpm install --frozen-lockfile
run_cmd pnpm --filter backend prisma:generate

if [ "${RUN_MIGRATIONS}" = "1" ]; then
  backup_database
  run_cmd pnpm --filter backend exec prisma migrate deploy
else
  echo "==> 已跳过 prisma migrate deploy（RUN_MIGRATIONS=${RUN_MIGRATIONS}）"
fi

run_cmd pnpm --filter backend build

echo "==> 正在构建前端"
VITE_API_BASE_URL="${VITE_API_BASE_URL}" pnpm --filter frontend build

run_with_sudo mkdir -p "${WEB_ROOT}"
if command -v rsync >/dev/null 2>&1; then
  run_with_sudo rsync -a --delete "${APP_DIR}/apps/frontend/dist/" "${WEB_ROOT}/"
else
  run_with_sudo rm -rf "${WEB_ROOT:?}"/*
  run_with_sudo cp -a "${APP_DIR}/apps/frontend/dist/." "${WEB_ROOT}/"
fi

run_with_sudo systemctl restart "${API_SERVICE}"
run_with_sudo systemctl restart "${WORKER_SERVICE}"
run_with_sudo systemctl is-active --quiet "${API_SERVICE}"
run_with_sudo systemctl is-active --quiet "${WORKER_SERVICE}"

if [ "${CHECK_HEALTH}" = "1" ]; then
  health_args=(
    --url "${HEALTH_URL}"
    --max-attempts "${HEALTH_MAX_ATTEMPTS}"
    --retry-interval "${HEALTH_RETRY_INTERVAL}"
  )
  if [ "${REQUIRE_HEALTHY}" = "1" ]; then
    health_args+=(--require-healthy)
  fi

  run_cmd bash "${APP_DIR}/deploy/healthcheck.sh" "${health_args[@]}"
fi

current_rev="$(git -C "${APP_DIR}" rev-parse HEAD)"
printf '%s\n' "${previous_rev}" > "${APP_DIR}/.deploy-previous"
printf '%s\n' "${current_rev}" > "${APP_DIR}/.deploy-last-successful"
echo "==> 发布版本：${current_rev}"

echo "发布完成：${APP_DIR}（分支：${BRANCH}）"
