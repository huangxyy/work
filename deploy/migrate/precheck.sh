#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/homework-ai}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${APP_DIR}/apps/backend/.env}"
API_PORT="${API_PORT:-3008}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${API_PORT}/api/health}"
MIN_NODE_MAJOR="${MIN_NODE_MAJOR:-20}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_PRECHECK] $*"
}

fail() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MIGRATE_PRECHECK] [ERROR] $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || fail "缺少命令：${cmd}"
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

parse_host_from_url() {
  local value="$1"
  printf '%s' "${value}" | sed -E 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?\[?([^]:/?]+)\]?(:[0-9]+)?(/.*)?$#\2#'
}

parse_port_from_url() {
  local value="$1"
  local default_port="$2"
  local parsed
  parsed="$(printf '%s' "${value}" | sed -nE 's#^[a-zA-Z0-9+.-]+://([^@/]+@)?\[?[^]:/?]+\]?[:]([0-9]+).*$#\2#p')"
  if [ -n "${parsed}" ]; then
    printf '%s\n' "${parsed}"
  else
    printf '%s\n' "${default_port}"
  fi
}

check_tcp() {
  local host="$1"
  local port="$2"
  timeout 5 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null
}

main() {
  [ -d "${APP_DIR}" ] || fail "APP_DIR 不存在：${APP_DIR}"
  [ -f "${BACKEND_ENV_FILE}" ] || fail "后端 .env 不存在：${BACKEND_ENV_FILE}"

  require_cmd bash
  require_cmd git
  require_cmd node
  require_cmd curl
  require_cmd timeout
  require_cmd systemctl

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "${node_major}" -ge "${MIN_NODE_MAJOR}" ] || fail "Node 版本过低：${node_major}"

  local free_mb
  free_mb="$(df -Pm "${APP_DIR}" | awk 'NR==2 {print $4}')"
  [ -n "${free_mb}" ] && [ "${free_mb}" -ge "${MIN_FREE_MB}" ] || fail "可用磁盘不足：${free_mb:-0}MB"

  local key
  for key in PORT DATABASE_URL REDIS_URL JWT_SECRET MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY LLM_BASE_URL; do
    [ -n "$(extract_env_value "${key}" || true)" ] || fail ".env 缺少必填项：${key}"
  done

  local db_url redis_url minio_endpoint db_host db_port redis_host redis_port
  db_url="$(extract_env_value DATABASE_URL)"
  redis_url="$(extract_env_value REDIS_URL)"
  minio_endpoint="$(extract_env_value MINIO_ENDPOINT)"

  db_host="$(parse_host_from_url "${db_url}")"
  db_port="$(parse_port_from_url "${db_url}" "3306")"
  redis_host="$(parse_host_from_url "${redis_url}")"
  redis_port="$(parse_port_from_url "${redis_url}" "6379")"

  check_tcp "${db_host}" "${db_port}" || fail "数据库不可达：${db_host}:${db_port}"
  check_tcp "${redis_host}" "${redis_port}" || fail "Redis 不可达：${redis_host}:${redis_port}"

  local minio_code
  minio_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "${minio_endpoint%/}" || true)"
  if [ "${minio_code}" != "200" ] && [ "${minio_code}" != "403" ]; then
    fail "MinIO Endpoint 不可用：${minio_endpoint} (HTTP ${minio_code:-000})"
  fi

  if curl -fsS --max-time 5 "${HEALTH_URL}" >/dev/null 2>&1; then
    log "本机健康检查可访问：${HEALTH_URL}"
  else
    log "提示：当前健康检查不可访问（新机初始化阶段可忽略）"
  fi

  log "预检通过"
}

main "$@"
