#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
fi

APP_DIR="${APP_DIR:-/www/homework-ai}"
OUTPUT_DIR="${OUTPUT_DIR:-${APP_DIR}/backups/storage}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-minioadmin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-minioadmin}}"
MINIO_BUCKET="${MINIO_BUCKET:-submissions}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPRESS="${COMPRESS:-1}"

usage() {
  cat <<EOF
用法：bash deploy/backup-storage.sh [选项]

选项：
  --output-dir <path>       输出目录
  --endpoint <url>          MinIO 地址（默认：${MINIO_ENDPOINT}）
  --access-key <key>        MinIO 访问密钥
  --secret-key <key>        MinIO 秘密密钥
  --bucket <name>           MinIO 桶名
  --retention-days <days>   清理 N 天前备份（0 表示不清理）
  --compress                输出 .tar.gz（默认）
  --no-compress             保留为目录
  --help                    显示帮助
EOF
}

is_non_negative_int() {
  local value="$1"
  [[ "${value}" =~ ^[0-9]+$ ]]
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --endpoint)
      MINIO_ENDPOINT="$2"
      shift 2
      ;;
    --access-key)
      MINIO_ACCESS_KEY="$2"
      shift 2
      ;;
    --secret-key)
      MINIO_SECRET_KEY="$2"
      shift 2
      ;;
    --bucket)
      MINIO_BUCKET="$2"
      shift 2
      ;;
    --retention-days)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --compress)
      COMPRESS=1
      shift
      ;;
    --no-compress)
      COMPRESS=0
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

if ! is_non_negative_int "${RETENTION_DAYS}"; then
  echo "--retention-days 必须为非负整数。" >&2
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  echo "需要安装 mc（MinIO 客户端）。安装文档：https://min.io/docs/minio/linux/reference/minio-mc.html" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

alias_name="backup-$(date +%s)-$$"
timestamp="$(date +%Y%m%d_%H%M%S)"
raw_dir="${OUTPUT_DIR}/${MINIO_BUCKET}_${timestamp}"

cleanup_alias() {
  mc alias rm "${alias_name}" >/dev/null 2>&1 || true
}
trap cleanup_alias EXIT

mc alias set "${alias_name}" "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null
mc ls "${alias_name}/${MINIO_BUCKET}" >/dev/null

mc mirror --overwrite "${alias_name}/${MINIO_BUCKET}" "${raw_dir}"

final_output="${raw_dir}"
if [ "${COMPRESS}" = "1" ]; then
  archive_path="${raw_dir}.tar.gz"
  tar -C "${OUTPUT_DIR}" -czf "${archive_path}" "$(basename "${raw_dir}")"
  rm -rf "${raw_dir}"
  final_output="${archive_path}"
fi

if [ "${RETENTION_DAYS}" -gt 0 ]; then
  find "${OUTPUT_DIR}" -maxdepth 1 -type f -name "${MINIO_BUCKET}_*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete
  find "${OUTPUT_DIR}" -maxdepth 1 -type d -name "${MINIO_BUCKET}_*" -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
fi

echo "对象存储备份完成：${final_output}"
