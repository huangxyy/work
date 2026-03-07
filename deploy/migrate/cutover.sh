#!/usr/bin/env bash
set -euo pipefail

ACTION="${ACTION:-}"
API_SERVICE="${API_SERVICE:-homework-ai-api}"
WORKER_SERVICE="${WORKER_SERVICE:-homework-ai-worker}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3008/api/health}"

usage() {
  cat <<EOF
用法：
  ACTION=freeze-old bash deploy/migrate/cutover.sh
  ACTION=unfreeze-old bash deploy/migrate/cutover.sh
  ACTION=verify-new bash deploy/migrate/cutover.sh

动作：
  freeze-old    停止旧机 API/Worker，进入短暂停机窗口
  unfreeze-old  恢复旧机 API/Worker（回退时使用）
  verify-new    在新机执行健康检查和基础烟测
EOF
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CUTOVER] $*"
}

case "${ACTION}" in
  freeze-old)
    log "停止旧机写入进程：${API_SERVICE} ${WORKER_SERVICE}"
    systemctl stop "${WORKER_SERVICE}" || true
    systemctl stop "${API_SERVICE}" || true
    log "旧机已冻结，可执行最终数据导出与切换。"
    ;;
  unfreeze-old)
    log "恢复旧机服务：${API_SERVICE} ${WORKER_SERVICE}"
    systemctl start "${API_SERVICE}" "${WORKER_SERVICE}"
    systemctl is-active --quiet "${API_SERVICE}"
    systemctl is-active --quiet "${WORKER_SERVICE}"
    log "旧机已恢复。"
    ;;
  verify-new)
    log "执行新机健康检查：${HEALTH_URL}"
    curl -fsS --max-time 8 "${HEALTH_URL}" >/dev/null
    log "健康检查通过。"
    ;;
  *)
    usage
    exit 1
    ;;
esac
