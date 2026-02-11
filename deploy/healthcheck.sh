#!/usr/bin/env bash
set -euo pipefail

URL="http://127.0.0.1:3000/api/health"
MAX_ATTEMPTS=20
RETRY_INTERVAL=3
REQUIRE_HEALTHY=0
NODE_BIN="${NODE_BIN:-node}"

usage() {
  cat <<EOF
Usage: bash deploy/healthcheck.sh [options]

Options:
  --url <url>                 Health endpoint URL (default: ${URL})
  --max-attempts <number>     Retry count before failing (default: ${MAX_ATTEMPTS})
  --retry-interval <seconds>  Seconds between retries (default: ${RETRY_INTERVAL})
  --require-healthy           Only accept status=healthy
  --help                      Show this message
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
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! is_positive_int "${MAX_ATTEMPTS}"; then
  echo "--max-attempts must be a positive integer." >&2
  exit 1
fi

if ! is_positive_int "${RETRY_INTERVAL}"; then
  echo "--retry-interval must be a positive integer." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for health checks." >&2
  exit 1
fi

if ! command -v "${NODE_BIN}" >/dev/null 2>&1; then
  echo "${NODE_BIN} is required to parse health response." >&2
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

    echo "Attempt ${attempt}/${MAX_ATTEMPTS}: status=${status:-unknown} db=${db_status:-unknown} redis=${redis_status:-unknown} storage=${storage_status:-unknown}"

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
      echo "Health check passed for ${URL}."
      exit 0
    fi
  else
    echo "Attempt ${attempt}/${MAX_ATTEMPTS}: endpoint not reachable (${URL})"
  fi

  if [ "${attempt}" -lt "${MAX_ATTEMPTS}" ]; then
    sleep "${RETRY_INTERVAL}"
  fi
  attempt=$((attempt + 1))
done

echo "Health check failed after ${MAX_ATTEMPTS} attempts: ${URL}" >&2
exit 1
