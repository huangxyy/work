#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  echo "Loaded host config from ${ENV_FILE}"
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

SUDO=""
if [ "${USE_SUDO}" = "1" ] && [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "USE_SUDO=1 but sudo was not found." >&2
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

if [ ! -d "${APP_DIR}/.git" ]; then
  echo "App directory is not a git repository: ${APP_DIR}" >&2
  echo "Run deploy/install-host.sh first." >&2
  exit 1
fi

run_cmd git -C "${APP_DIR}" fetch origin --prune
run_cmd git -C "${APP_DIR}" checkout "${BRANCH}"
run_cmd git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"

cd "${APP_DIR}"

run_cmd corepack enable
run_cmd corepack prepare "pnpm@${PNPM_VERSION}" --activate
run_cmd pnpm install --frozen-lockfile
run_cmd pnpm --filter backend prisma:generate

if [ "${RUN_MIGRATIONS}" = "1" ]; then
  run_cmd pnpm --filter backend exec prisma migrate deploy
else
  echo "==> Skipping prisma migrate deploy (RUN_MIGRATIONS=${RUN_MIGRATIONS})"
fi

run_cmd pnpm --filter backend build

echo "==> Building frontend"
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

echo "Update complete for ${APP_DIR} (${BRANCH})."
