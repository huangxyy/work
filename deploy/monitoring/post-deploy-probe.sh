#!/usr/bin/env bash
set -euo pipefail

API_SERVICE="${API_SERVICE:-homework-ai-api}"
WORKER_SERVICE="${WORKER_SERVICE:-homework-ai-worker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3008/api/health}"
LOGIN_PROBE_URL="${LOGIN_PROBE_URL:-}"
LOGIN_PROBE_BODY="${LOGIN_PROBE_BODY:-{\"account\":\"student01\",\"password\":\"Test1234\"}}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [POST_DEPLOY_PROBE] $*"
}

check_service() {
  local svc="$1"
  if systemctl is-active --quiet "${svc}"; then
    log "服务正常：${svc}"
  else
    log "服务异常：${svc}"
    systemctl status "${svc}" --no-pager -n 40 || true
    return 1
  fi
}

main() {
  check_service "${API_SERVICE}"
  check_service "${WORKER_SERVICE}"

  curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null
  log "健康检查通过：${HEALTH_URL}"

  if [ -n "${LOGIN_PROBE_URL}" ]; then
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -X POST "${LOGIN_PROBE_URL}" \
      -H 'Content-Type: application/json' \
      -d "${LOGIN_PROBE_BODY}" || true)"
    if [ "${code}" = "200" ] || [ "${code}" = "201" ]; then
      log "登录探针通过：${LOGIN_PROBE_URL}"
    else
      log "登录探针失败：HTTP ${code}"
      return 1
    fi
  fi

  log "部署后探针通过"
}

main "$@"
