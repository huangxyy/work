#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# In-place upgrade script for production host (Debian + BT + systemd).
# Use this script on servers that already run an older Homework AI version.
#
# Default flow:
# 1) backup current commit/env
# 2) run deploy/update-host.sh (pull, migrate, build, restart, healthcheck)
# 3) auto rollback on failure (optional)
#
# Usage:
#   bash deploy/upgrade-prod.sh
#   bash deploy/upgrade-prod.sh --branch main --require-healthy
#   bash deploy/upgrade-prod.sh --project-dir /www/wwwroot/source-code --web-root /www/wwwroot/aigzy.cn
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/source-code}"
BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/aigzy.cn}"
HOST_ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
BACKUP_BEFORE_MIGRATION="${BACKUP_BEFORE_MIGRATION:-1}"
REQUIRE_HEALTHY="${REQUIRE_HEALTHY:-0}"
AUTO_ROLLBACK_ON_FAILURE="${AUTO_ROLLBACK_ON_FAILURE:-1}"

API_SERVICE="${API_SERVICE:-homework-ai-api}"
WORKER_SERVICE="${WORKER_SERVICE:-homework-ai-worker}"

usage() {
  cat <<EOF
Usage: bash deploy/upgrade-prod.sh [options]

Options:
  --project-dir <path>     Project root on server (default: ${PROJECT_DIR})
  --web-root <path>        BT/Nginx web root for frontend dist (default: ${WEB_ROOT})
  --branch <name>          Git branch to deploy (default: ${BRANCH})
  --host-env <path>        host.env path (default: ${HOST_ENV_FILE})
  --no-migrate             Skip prisma migrate deploy
  --no-db-backup           Skip DB backup before migration
  --require-healthy        Require health status=healthy
  --no-auto-rollback       Disable rollback when upgrade fails
  --help                   Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --web-root)
      WEB_ROOT="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --host-env)
      HOST_ENV_FILE="$2"
      shift 2
      ;;
    --no-migrate)
      RUN_MIGRATIONS=0
      shift
      ;;
    --no-db-backup)
      BACKUP_BEFORE_MIGRATION=0
      shift
      ;;
    --require-healthy)
      REQUIRE_HEALTHY=1
      shift
      ;;
    --no-auto-rollback)
      AUTO_ROLLBACK_ON_FAILURE=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ ! -d "${PROJECT_DIR}/.git" ]; then
  echo "Not a git repo: ${PROJECT_DIR}" >&2
  exit 1
fi

if [ ! -f "${PROJECT_DIR}/deploy/update-host.sh" ]; then
  echo "Missing deploy/update-host.sh under ${PROJECT_DIR}" >&2
  exit 1
fi

log() {
  echo "[upgrade] $*"
}

timestamp="$(date +%Y%m%d_%H%M%S)"
before_rev="$(git -C "${PROJECT_DIR}" rev-parse HEAD)"
before_ref_file="${PROJECT_DIR}/.deploy-before-upgrade"

log "Project: ${PROJECT_DIR}"
log "Current commit: ${before_rev}"
log "Target branch: ${BRANCH}"

printf '%s\n' "${before_rev}" > "${before_ref_file}"
log "Saved rollback ref: ${before_ref_file}"

if [ -f "${PROJECT_DIR}/apps/backend/.env" ]; then
  env_backup="${PROJECT_DIR}/apps/backend/.env.bak.${timestamp}"
  cp "${PROJECT_DIR}/apps/backend/.env" "${env_backup}"
  log "Backed up backend env: ${env_backup}"
fi

run_upgrade() {
  APP_DIR="${PROJECT_DIR}" \
  WEB_ROOT="${WEB_ROOT}" \
  BRANCH="${BRANCH}" \
  RUN_MIGRATIONS="${RUN_MIGRATIONS}" \
  BACKUP_BEFORE_MIGRATION="${BACKUP_BEFORE_MIGRATION}" \
  CHECK_HEALTH=1 \
  REQUIRE_HEALTHY="${REQUIRE_HEALTHY}" \
  API_SERVICE="${API_SERVICE}" \
  WORKER_SERVICE="${WORKER_SERVICE}" \
  HOST_ENV_FILE="${HOST_ENV_FILE}" \
  bash "${PROJECT_DIR}/deploy/update-host.sh"
}

run_rollback() {
  APP_DIR="${PROJECT_DIR}" \
  WEB_ROOT="${WEB_ROOT}" \
  ROLLBACK_REF="${before_rev}" \
  CHECK_HEALTH=1 \
  REQUIRE_HEALTHY="${REQUIRE_HEALTHY}" \
  API_SERVICE="${API_SERVICE}" \
  WORKER_SERVICE="${WORKER_SERVICE}" \
  HOST_ENV_FILE="${HOST_ENV_FILE}" \
  bash "${PROJECT_DIR}/deploy/rollback-host.sh"
}

if run_upgrade; then
  after_rev="$(git -C "${PROJECT_DIR}" rev-parse HEAD)"
  log "Upgrade succeeded: ${before_rev} -> ${after_rev}"
  exit 0
fi

echo "Upgrade failed." >&2

if [ "${AUTO_ROLLBACK_ON_FAILURE}" = "1" ] && [ -f "${PROJECT_DIR}/deploy/rollback-host.sh" ]; then
  log "Auto rollback enabled, rolling back to ${before_rev} ..."
  if run_rollback; then
    log "Rollback succeeded. Service restored to previous version."
    exit 1
  fi
  echo "Rollback failed. Manual intervention required." >&2
  exit 2
fi

echo "Auto rollback disabled or rollback script missing." >&2
exit 1
