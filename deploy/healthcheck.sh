#!/usr/bin/env bash
set -euo pipefail

URL="http://127.0.0.1:3000/api/health"
MAX_ATTEMPTS=20
RETRY_INTERVAL=3
REQUIRE_HEALTHY=0
NODE_BIN="${NODE_BIN:-node}"

usage() {
  cat <<EOF
用法：bash deploy/healthcheck.sh [选项]

选项：
  --url <url>                 健康检查地址（默认：${URL}）
  --max-attempts <number>     最大重试次数（默认：${MAX_ATTEMPTS}）
  --retry-interval <seconds>  重试间隔秒数（默认：${RETRY_INTERVAL}）
  --require-healthy           仅当 status=healthy 才视为通过
  --help                      显示帮助
EOF
}

is_positive_int() {
  local value="$1"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]]
}

extract_field() {
  local field="$1"
  "${NODE_BIN}" -e "
const fs = require('fs');
const field = process.argv[1];
const raw = fs.readFileSync(0, 'utf8');
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(2);
}
const value = field.split('.').reduce((acc, key) => {
  if (acc === null || acc === undefined) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(acc, key)) {
    return acc[key];
  }
  return undefined;
}, payload);
if (value === undefined || value === null) {
  process.exit(3);
}
process.stdout.write(String(value));
" "${field}"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --url)
      URL="$2"
      shift 2
      ;;
    --max-attempts)
      MAX_ATTEMPTS="$2"
      shift 2
      ;;
    --retry-interval)
      RETRY_INTERVAL="$2"
      shift 2
      ;;
    --require-healthy)
      REQUIRE_HEALTHY=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "未知选项：$1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! is_positive_int "${MAX_ATTEMPTS}"; then
  echo "--max-attempts 必须为正整数。" >&2
  exit 1
fi

if ! is_positive_int "${RETRY_INTERVAL}"; then
  echo "--retry-interval 必须为正整数。" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "执行健康检查需要 curl。" >&2
  exit 1
fi

if ! command -v "${NODE_BIN}" >/dev/null 2>&1; then
  echo "解析健康检查响应需要 ${NODE_BIN}。" >&2
  exit 1
fi

attempt=1
while [ "${attempt}" -le "${MAX_ATTEMPTS}" ]; do
  response="$(curl -fsS --max-time 8 "${URL}" 2>/dev/null || true)"

  if [ -n "${response}" ]; then
    status="$(printf '%s' "${response}" | extract_field status 2>/dev/null || true)"
    db_status="$(printf '%s' "${response}" | extract_field services.database.status 2>/dev/null || true)"
    redis_status="$(printf '%s' "${response}" | extract_field services.redis.status 2>/dev/null || true)"
    storage_status="$(printf '%s' "${response}" | extract_field services.storage.status 2>/dev/null || true)"

    echo "第 ${attempt}/${MAX_ATTEMPTS} 次：status=${status:-unknown} db=${db_status:-unknown} redis=${redis_status:-unknown} storage=${storage_status:-unknown}"

    accepted=0
    if [ "${REQUIRE_HEALTHY}" = "1" ]; then
      if [ "${status}" = "healthy" ]; then
        accepted=1
      fi
    else
      if [ "${status}" = "healthy" ] || [ "${status}" = "degraded" ]; then
        accepted=1
      fi
    fi

    if [ "${accepted}" = "1" ]; then
      echo "健康检查通过：${URL}"
      exit 0
    fi
  else
    echo "第 ${attempt}/${MAX_ATTEMPTS} 次：地址不可达（${URL}）"
  fi

  if [ "${attempt}" -lt "${MAX_ATTEMPTS}" ]; then
    sleep "${RETRY_INTERVAL}"
  fi
  attempt=$((attempt + 1))
done

echo "健康检查失败：重试 ${MAX_ATTEMPTS} 次后仍未通过（${URL}）" >&2
exit 1
