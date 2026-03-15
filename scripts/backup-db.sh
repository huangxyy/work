#!/bin/bash
# =============================================================================
# Homework AI - 数据库备份脚本
# =============================================================================
# 用途: 备份 MySQL 数据库到本地目录
# 使用: ./scripts/backup-db.sh
# =============================================================================

set -e

# =============================================================================
# 配置
# =============================================================================
BACKUP_DIR="./backup/db"
RETENTION_DAYS=7
MYSQL_CONTAINER="mysql"
DB_NAME="homework_ai"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 从 .env 文件加载环境变量
if [ -f "./deploy/.env" ]; then
  export $(cat ./deploy/.env | grep -v '^#' | xargs)
elif [ -f "./.env" ]; then
  export $(cat ./.env | grep -v '^#' | xargs)
fi

# 使用环境变量或默认值
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-root}

# =============================================================================
# 函数
# =============================================================================

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# =============================================================================
# 执行备份
# =============================================================================

log_info "开始备份数据库..."

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
BACKUP_FILE="$BACKUP_DIR/homework_ai_${TIMESTAMP}.sql"

# 检查 MySQL 容器是否运行
if ! docker ps | grep -q "$MYSQL_CONTAINER"; then
  log_error "MySQL 容器 $MYSQL_CONTAINER 未运行"
  exit 1
fi

# 执行备份
log_info "正在执行 mysqldump..."
docker exec "$MYSQL_CONTAINER" mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --quick \
  --lock-tables=false \
  "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null

# 检查备份是否成功
if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  log_info "数据库备份完成: $BACKUP_FILE"

  # 压缩备份文件
  gzip "$BACKUP_FILE"
  log_info "备份文件已压缩: ${BACKUP_FILE}.gz"

  # 计算文件大小
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
  log_info "备份文件大小: $BACKUP_SIZE"

  # 清理旧备份
  log_info "清理 $RETENTION_DAYS 天前的旧备份..."
  DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
  log_info "已删除 $DELETED 个旧备份文件"

  log_info "备份任务完成!"
else
  log_error "数据库备份失败"
  [ -f "$BACKUP_FILE" ] && rm -f "$BACKUP_FILE"
  exit 1
fi
