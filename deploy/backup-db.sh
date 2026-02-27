#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HOST_ENV_FILE:-${SCRIPT_DIR}/host.env}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
fi

APP_DIR="${APP_DIR:-/www/homework-ai}"
OUTPUT_DIR="${OUTPUT_DIR:-${DB_BACKUP_DIR:-${APP_DIR}/backups/db}}"
DB_NAME="${DB_NAME:-homework_ai}"
DB_USER="${DB_USER:-homework_ai}"
DB_PASS="${DB_PASS:-}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
RETENTION_DAYS="${RETENTION_DAYS:-${BACKUP_RETENTION_DAYS:-7}}"
COMPRESS="${COMPRESS:-1}"

usage() {
  cat <<EOF
用法：bash deploy/backup-db.sh [选项]

选项：
  --output-dir <path>      备份输出目录
  --db-name <name>         数据库名
  --db-user <name>         数据库用户名
  --db-pass <password>     数据库密码
  --db-host <host>         数据库主机
  --db-port <port>         数据库端口
  --retention-days <days>  清理 N 天前的备份（0 表示不清理）
  --compress               导出为 .sql.gz（默认）
  --no-compress            导出为 .sql
  --help                   显示帮助
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
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --db-pass)
      DB_PASS="$2"
      shift 2
      ;;
    --db-host)
      MYSQL_HOST="$2"
      shift 2
      ;;
    --db-port)
      MYSQL_PORT="$2"
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

if [ -z "${DB_PASS}" ]; then
  echo "DB_PASS 为空，请在 deploy/host.env 中设置或通过 --db-pass 传入。" >&2
  exit 1
fi

if ! is_non_negative_int "${RETENTION_DAYS}"; then
  echo "--retention-days 必须为非负整数。" >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "执行数据库备份需要 mysqldump。" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

timestamp="$(date +%Y%m%d_%H%M%S)"
if [ "${COMPRESS}" = "1" ]; then
  output_file="${OUTPUT_DIR}/${DB_NAME}_${timestamp}.sql.gz"
  MYSQL_PWD="${DB_PASS}" mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "${DB_NAME}" | gzip -c > "${output_file}"
else
  output_file="${OUTPUT_DIR}/${DB_NAME}_${timestamp}.sql"
  MYSQL_PWD="${DB_PASS}" mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "${DB_NAME}" > "${output_file}"
fi

if [ ! -s "${output_file}" ]; then
  echo "备份文件为空：${output_file}" >&2
  exit 1
fi

if [ "${RETENTION_DAYS}" -gt 0 ]; then
  find "${OUTPUT_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.sql*" -mtime "+${RETENTION_DAYS}" -delete
fi

echo "数据库备份完成：${output_file}"
