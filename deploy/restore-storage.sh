#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
fi

SOURCE_PATH=""
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-minioadmin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-minioadmin}}"
MINIO_BUCKET="${MINIO_BUCKET:-submissions}"
REMOVE_EXTRA="0"

usage() {
  cat <<EOF
用法：bash deploy/restore-storage.sh --source <path> [选项]

选项：
  --source <path>           备份源目录或 .tar.gz 备份文件
  --endpoint <url>          MinIO 地址（默认：${MINIO_ENDPOINT}）
  --access-key <key>        MinIO 访问密钥
  --secret-key <key>        MinIO 秘密密钥
  --bucket <name>           MinIO 桶名
  --remove-extra            删除桶中源数据不存在的对象
  --help                    显示帮助
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      SOURCE_PATH="$2"
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
    --remove-extra)
      REMOVE_EXTRA=1
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

if [ -z "${SOURCE_PATH}" ]; then
  echo "--source 为必填参数。" >&2
  usage
  exit 1
fi

if [ ! -e "${SOURCE_PATH}" ]; then
  echo "未找到源路径：${SOURCE_PATH}" >&2
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  echo "需要安装 mc（MinIO 客户端）。" >&2
  exit 1
fi

alias_name="restore-$(date +%s)-$$"
tmp_dir=""

cleanup() {
  mc alias rm "${alias_name}" >/dev/null 2>&1 || true
  if [ -n "${tmp_dir}" ] && [ -d "${tmp_dir}" ]; then
    rm -rf "${tmp_dir}"
  fi
}
trap cleanup EXIT

restore_dir="${SOURCE_PATH}"
if [ -f "${SOURCE_PATH}" ] && [[ "${SOURCE_PATH}" == *.tar.gz ]]; then
  tmp_dir="$(mktemp -d)"
  tar -C "${tmp_dir}" -xzf "${SOURCE_PATH}"
  first_dir="$(find "${tmp_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "${first_dir}" ]; then
    echo "压缩包中未找到可恢复目录：${SOURCE_PATH}" >&2
    exit 1
  fi
  restore_dir="${first_dir}"
fi

if [ ! -d "${restore_dir}" ]; then
  echo "恢复源必须是目录：${restore_dir}" >&2
  exit 1
fi

mc alias set "${alias_name}" "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null

mirror_args=(--overwrite)
if [ "${REMOVE_EXTRA}" = "1" ]; then
  mirror_args+=(--remove)
fi

mc mirror "${mirror_args[@]}" "${restore_dir}" "${alias_name}/${MINIO_BUCKET}"

echo "对象存储恢复完成：${SOURCE_PATH} -> ${MINIO_BUCKET}"
