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
PNPM_VERSION="${PNPM_VERSION:-8.15.9}"
MIN_NODE_MAJOR="${MIN_NODE_MAJOR:-20}"
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
ROLLBACK_REF="${ROLLBACK_REF:-}"
ROLLBACK_TAG_FILE="${ROLLBACK_TAG_FILE:-${APP_DIR}/.deploy-last-successful-tag}"
ROLLBACK_REF_FILE="${ROLLBACK_REF_FILE:-${APP_DIR}/.deploy-last-successful}"

SUDO=""
if [ "${USE_SUDO}" = "1" ] && [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "USE_SUDO=1 但未找到 sudo。" >&2
    exit 1
  fi
fi

log_now() {
  date '+%Y-%m-%d %H:%M:%S'
}

log_info() {
  echo "[$(log_now)] [INFO] $*"
}

log_error() {
  echo "[$(log_now)] [ERROR] $*" >&2
}

run_cmd() {
  log_info "执行：$*"
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
    echo "未找到 flock，将在无锁模式下继续回滚。" >&2
    return
  fi
  mkdir -p "$(dirname "${LOCK_FILE}")"
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    echo "检测到其他部署/回滚任务正在运行（锁文件：${LOCK_FILE}）。" >&2
    exit 1
  fi
}

resolve_target_ref() {
  if [ -n "${ROLLBACK_REF}" ]; then
    printf '%s\n' "${ROLLBACK_REF}"
    return
  fi

  if [ -f "${ROLLBACK_TAG_FILE}" ]; then
    head -n 1 "${ROLLBACK_TAG_FILE}"
    return
  fi

  if [ -f "${ROLLBACK_REF_FILE}" ]; then
    head -n 1 "${ROLLBACK_REF_FILE}"
    return
  fi

  git -C "${APP_DIR}" rev-parse HEAD~1
}

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "应用目录不是 Git 仓库：${APP_DIR}" >&2
  exit 1
fi

acquire_lock

if ! command -v node >/dev/null 2>&1; then
  log_error "缺少 node 命令，无法执行回滚。"
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(\".\")[0]')"
if [ "${node_major}" -lt "${MIN_NODE_MAJOR}" ]; then
  log_error "Node 版本过低：${node_major}，要求 >= ${MIN_NODE_MAJOR}"
  exit 1
fi

target_ref="$(resolve_target_ref)"
if [ -z "${target_ref}" ]; then
  log_error "无法解析回滚目标版本。"
  exit 1
fi

run_cmd git -C "${APP_DIR}" fetch origin --prune
run_cmd git -C "${APP_DIR}" checkout --detach "${target_ref}"

cd "${APP_DIR}"

run_cmd corepack enable
run_cmd corepack prepare "pnpm@${PNPM_VERSION}" --activate
run_cmd pnpm install --frozen-lockfile
run_cmd pnpm --filter backend prisma:generate
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

printf '%s\n' "${target_ref}" > "${APP_DIR}/.deploy-last-rollback"
log_info "回滚完成，当前版本：${target_ref}"
log_info "如需恢复按分支发布，请执行 deploy/update-host.sh"
