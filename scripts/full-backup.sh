#!/bin/bash
# =============================================================================
# Homework AI - 完整备份脚本
# =============================================================================
# 用途: 备份数据库、MinIO 文件和配置文件
# 使用: ./scripts/full-backup.sh
# =============================================================================

set -e

# =============================================================================
# 配置
# =============================================================================
BACKUP_ROOT="./backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/full_${TIMESTAMP}"
RETENTION_DAYS=30
MYSQL_CONTAINER="mysql"
MINIO_VOLUME="work_minio-data"
MYSQL_VOLUME="work_mysql-data"

# 从 .env 文件加载环境变量
if [ -f "./deploy/.env" ]; then
  export $(cat ./deploy/.env | grep -v '^#' | xargs)
elif [ -f "./.env" ]; then
  export $(cat ./.env | grep -v '^#' | xargs)
fi

MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-root}
DB_NAME="homework_ai"

# =============================================================================
# 函数
# =============================================================================

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1"
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

cleanup() {
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
  fi
}

trap cleanup EXIT

# =============================================================================
# 执行备份
# =============================================================================

log_info "======================================"
log_info "开始完整备份: $TIMESTAMP"
log_info "======================================"

# 创建备份目录
mkdir -p "$BACKUP_DIR"/{db,minio,config}

# 1. 备份数据库
log_info "[1/5] 备份数据库..."

if docker ps | grep -q "$MYSQL_CONTAINER"; then
  docker exec "$MYSQL_CONTAINER" mysqldump \
    -u root \
    -p"${MYSQL_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --quick \
    --lock-tables=false \
    "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_DIR/db/homework_ai.sql.gz"

  if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/db/homework_ai.sql.gz" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/db/homework_ai.sql.gz" | cut -f1)
    log_info "数据库备份完成: $BACKUP_SIZE"
  else
    log_error "数据库备份失败"
    exit 1
  fi
else
  log_error "MySQL 容器未运行"
  exit 1
fi

# 2. 备份 MinIO 数据
log_info "[2/5] 备份 MinIO 文件存储..."

docker run --rm \
  -v "${MINIO_VOLUME}:/data:ro" \
  -v "$BACKUP_DIR/minio:/backup" \
  alpine:latest tar czf /backup/minio_data.tar.gz -C /data . 2>/dev/null

if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/minio/minio_data.tar.gz" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_DIR/minio/minio_data.tar.gz" | cut -f1)
  log_info "MinIO 备份完成: $BACKUP_SIZE"
else
  log_error "MinIO 备份失败"
  exit 1
fi

# 3. 备份配置文件
log_info "[3/5] 备份配置文件..."

# 备份 deploy 配置
mkdir -p "$BACKUP_DIR/config/deploy"
[ -f "./deploy/docker-compose.yml" ] && cp "./deploy/docker-compose.yml" "$BACKUP_DIR/config/deploy/"
[ -f "./deploy/.env" ] && cp "./deploy/.env" "$BACKUP_DIR/config/deploy/" 2>/dev/null || true
[ -f "./deploy/.env.prod" ] && cp "./deploy/.env.prod" "$BACKUP_DIR/config/deploy/" 2>/dev/null || true

# 备份 nginx 配置
mkdir -p "$BACKUP_DIR/config/nginx"
cp -r "./deploy/nginx/"* "$BACKUP_DIR/config/nginx/" 2>/dev/null || true

# 备份后端配置
mkdir -p "$BACKUP_DIR/config/backend"
[ -f "./apps/backend/.env" ] && cp "./apps/backend/.env" "$BACKUP_DIR/config/backend/" 2>/dev/null || true

# 备份前端配置
mkdir -p "$BACKUP_DIR/config/frontend"
[ -f "./apps/frontend/.env" ] && cp "./apps/frontend/.env" "$BACKUP_DIR/config/frontend/" 2>/dev/null || true

log_info "配置文件备份完成"

# 4. 生成备份清单
log_info "[4/5] 生成备份清单..."

cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
========================================
Homework AI - 备份清单
========================================

备份时间: $(date)
备份类型: 完整备份
备份版本: ${TIMESTAMP}

备份内容:
  - 数据库: db/homework_ai.sql.gz
  - MinIO: minio/minio_data.tar.gz
  - 配置文件: config/

系统信息:
  主机名: $(hostname)
  用户: $(whoami)
  Docker 版本: $(docker --version)
  Docker Compose 版本: $(docker-compose --version)

环境变量:
  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:+[已设置]}
  MINIO_ROOT_USER: ${MINIO_ROOT_USER:-未设置}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:+[已设置]}

恢复说明:
  1. 停止服务: docker-compose stop mysql minio
  2. 恢复数据库: gunzip -c db/homework_ai.sql.gz | docker exec -i mysql mysql -u root -p homework_ai
  3. 恢复 MinIO: docker run --rm -v ${MINIO_VOLUME}:/data -v \$(pwd)/minio:/backup alpine tar xzf /backup/minio_data.tar.gz -C /data
  4. 恢复配置: 复制 config/ 目录下的文件到相应位置
  5. 启动服务: docker-compose start mysql minio

========================================
EOF

log_info "备份清单已生成"

# 5. 压缩完整备份
log_info "[5/5] 压缩完整备份..."

cd "$BACKUP_ROOT"
tar czf "full_backup_${TIMESTAMP}.tar.gz" "full_${TIMESTAMP}"

BACKUP_SIZE=$(du -h "full_backup_${TIMESTAMP}.tar.gz" | cut -f1)
log_info "压缩完成: full_backup_${TIMESTAMP}.tar.gz ($BACKUP_SIZE)"

# 清理临时目录
rm -rf "full_${TIMESTAMP}"
cd - > /dev/null

# 6. 清理旧备份
log_info "清理 $RETENTION_DAYS 天前的旧备份..."
DELETED=$(find "$BACKUP_ROOT" -name "full_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log_info "已删除 $DELETED 个旧备份文件"

log_info "======================================"
log_info "完整备份成功!"
log_info "备份文件: ${BACKUP_ROOT}/full_backup_${TIMESTAMP}.tar.gz"
log_info "备份大小: $BACKUP_SIZE"
log_info "======================================"
