# 数据备份与恢复指南

本文档介绍 Homework AI 系统的数据备份和恢复流程。

---

## 目录

- [备份概述](#备份概述)
- [数据库备份恢复](#数据库备份恢复)
- [MinIO 备份恢复](#minio-备份恢复)
- [完整备份方案](#完整备份方案)
- [自动化备份](#自动化备份)
- [备份策略建议](#备份策略建议)
- [灾难恢复](#灾难恢复)

---

## 备份概述

系统需要备份的关键数据：

| 数据类型 | 存储位置 | 备份优先级 | 说明 |
|---------|---------|-----------|------|
| **数据库** | MySQL | 高 | 用户、作业、提交等核心数据 |
| **文件存储** | MinIO | 高 | 学生上传的作业图片 |
| **配置文件** | 配置目录 | 中 | 环境变量、Nginx 配置等 |
| **日志** | 日志目录 | 低 | 审计和故障排查 |

---

## 数据库备份恢复

### 手动备份

#### 使用 mysqldump

```bash
# 进入 Docker 容器执行备份
docker exec mysql mysqldump \
  -u root \
  -p${MYSQL_ROOT_PASSWORD} \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  homework_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# 压缩备份文件
gzip backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 使用 Docker 卷备份

```bash
# 停止数据库服务
docker-compose stop mysql

# 备份数据卷
docker run --rm \
  -v work_mysql-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/mysql_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 恢复服务
docker-compose start mysql
```

### 自动化备份

创建备份脚本 `scripts/backup-db.sh`：

```bash
#!/bin/bash
set -e

# 配置
BACKUP_DIR="./backup/db"
RETENTION_DAYS=7
MYSQL_CONTAINER="mysql"
DB_NAME="homework_ai"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
BACKUP_FILE="$BACKUP_DIR/homework_ai_$(date +%Y%m%d_%H%M%S).sql"

# 执行备份
echo "开始备份数据库..."
docker exec "$MYSQL_CONTAINER" mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" > "$BACKUP_FILE"

# 压缩备份
gzip "$BACKUP_FILE"
echo "数据库备份完成: ${BACKUP_FILE}.gz"

# 清理旧备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "已清理 $RETENTION_DAYS 天前的旧备份"
```

添加执行权限：
```bash
chmod +x scripts/backup-db.sh
```

### 数据库恢复

#### 从 SQL 文件恢复

```bash
# 解压备份文件（如果已压缩）
gunzip backup_20240115_103045.sql.gz

# 恢复数据库
docker exec -i mysql mysql \
  -u root \
  -p${MYSQL_ROOT_PASSWORD} \
  homework_ai < backup_20240115_103045.sql
```

#### 从数据卷恢复

```bash
# 停止数据库服务
docker-compose stop mysql

# 恢复数据卷
docker run --rm \
  -v work_mysql-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/mysql_20240115_103045.tar.gz -C /data

# 启动数据库服务
docker-compose start mysql
```

---

## MinIO 备份恢复

### 手动备份

#### 使用 mc (MinIO Client)

```bash
# 安装 mc 工具
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
mv mc /usr/local/bin/

# 配置 MinIO 别名
mc alias set local http://localhost:9000 minioadmin minioadmin

# 同步整个 bucket 到本地
mc mirror local/submissions ./backup/minio/submissions_$(date +%Y%m%d_%H%M%S)

# 仅同步新增和修改的文件
mc mirror --watch local/submissions ./backup/minio/current
```

#### 使用 rsync

```bash
# 通过 MinIO 的挂载点备份
rsync -avz /path/to/minio/mount/submissions/ \
  ./backup/minio/submissions_$(date +%Y%m%d_%H%M%S)/
```

### 数据卷备份

```bash
# 停止 MinIO 服务
docker-compose stop minio

# 备份 MinIO 数据卷
docker run --rm \
  -v work_minio-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 恢复服务
docker-compose start minio
```

### MinIO 恢复

#### 从数据卷恢复

```bash
# 停止 MinIO 服务
docker-compose stop minio

# 恢复数据卷
docker run --rm \
  -v work_minio-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/minio_20240115_103045.tar.gz -C /data

# 启动 MinIO 服务
docker-compose start minio
```

#### 从本地文件恢复

```bash
# 使用 mc 工具
mc mirror ./backup/minio/submissions_20240115_103045/ local/submissions
```

---

## 完整备份方案

### 完整备份脚本

创建 `scripts/full-backup.sh`：

```bash
#!/bin/bash
set -e

# 配置
BACKUP_ROOT="./backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/full_$TIMESTAMP"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"/{db,minio,config}

echo "======================================"
echo "开始完整备份: $TIMESTAMP"
echo "======================================"

# 1. 备份数据库
echo "[1/4] 备份数据库..."
docker exec mysql mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  homework_ai | gzip > "$BACKUP_DIR/db/homework_ai.sql.gz"

# 2. 备份 MinIO 数据
echo "[2/4] 备份文件存储..."
docker run --rm \
  -v work_minio-data:/data \
  -v "$BACKUP_DIR/minio:/backup" \
  alpine tar czf /backup/minio_data.tar.gz -C /data .

# 3. 备份配置文件
echo "[3/4] 备份配置文件..."
cp -r deploy/.env* "$BACKUP_DIR/config/" 2>/dev/null || true
cp -r deploy/nginx/* "$BACKUP_DIR/config/nginx/" 2>/dev/null || true
cp -r apps/backend/.env* "$BACKUP_DIR/config/backend/" 2>/dev/null || true

# 4. 生成备份清单
echo "[4/4] 生成备份清单..."
cat > "$BACKUP_DIR/manifest.txt" << EOF
备份时间: $(date)
备份类型: 完整备份
备份内容:
  - 数据库: homework_ai.sql.gz
  - MinIO: minio_data.tar.gz
  - 配置文件: config/
EOF

# 5. 压缩完整备份
cd "$BACKUP_ROOT"
tar czf "full_backup_${TIMESTAMP}.tar.gz" "full_${TIMESTAMP}"
rm -rf "full_${TIMESTAMP}"

echo "======================================"
echo "备份完成: full_backup_${TIMESTAMP}.tar.gz"
echo "======================================"

# 6. 清理旧备份
find "$BACKUP_ROOT" -name "full_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "已清理 $RETENTION_DAYS 天前的旧备份"
```

### 完整恢复脚本

创建 `scripts/full-restore.sh`：

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "用法: $0 <备份文件.tar.gz>"
  exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="./restore_$(date +%Y%m%d_%H%M%S)"

echo "======================================"
echo "开始恢复: $BACKUP_FILE"
echo "======================================"

# 1. 解压备份文件
echo "[1/5] 解压备份文件..."
mkdir -p "$RESTORE_DIR"
tar xzf "$BACKUP_FILE" -C "$RESTORE_DIR"
BACKUP_EXTRACTED=$(find "$RESTORE_DIR" -name "full_*" -type d | head -1)

# 2. 停止服务
echo "[2/5] 停止相关服务..."
docker-compose stop mysql minio

# 3. 恢复数据库
echo "[3/5] 恢复数据库..."
gunzip -c "$BACKUP_EXTRACTED/db/homework_ai.sql.gz" | \
  docker exec -i mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" homework_ai

# 4. 恢复 MinIO
echo "[4/5] 恢复文件存储..."
docker run --rm \
  -v work_minio-data:/data \
  -v "$BACKUP_EXTRACTED/minio:/backup" \
  alpine tar xzf /backup/minio_data.tar.gz -C /data

# 5. 恢复配置文件
echo "[5/5] 恢复配置文件..."
# 用户手动确认配置文件恢复

# 6. 启动服务
echo "启动服务..."
docker-compose start mysql minio

echo "======================================"
echo "恢复完成!"
echo "临时文件位置: $RESTORE_DIR"
echo "======================================"
```

---

## 自动化备份

### Cron 定时任务

编辑 crontab：
```bash
crontab -e
```

添加定时任务：
```bash
# 每天凌晨 2 点执行数据库备份
0 2 * * * /path/to/scripts/backup-db.sh

# 每周日凌晨 3 点执行完整备份
0 3 * * 0 /path/to/scripts/full-backup.sh
```

### Docker Compose 备份服务

在 `docker-compose.yml` 中添加备份服务：

```yaml
services:
  backup:
    image: alpine:latest
    volumes:
      - ./scripts:/scripts
      - ./backup:/backup
      - mysql-data:/data/mysql:ro
      - minio-data:/data/minio:ro
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - RETENTION_DAYS=7
    command: /scripts/backup-db.sh
    restart: "no"
```

手动执行备份：
```bash
docker-compose run --rm backup
```

---

## 备份策略建议

### 3-2-1 备份原则

- **3**：保留至少 3 份副本
- **2**：使用 2 种不同的存储介质
- **1**：至少 1 份异地备份

### 备份频率建议

| 数据类型 | 备份频率 | 保留时间 |
|---------|---------|---------|
| 数据库 | 每日 | 30 天 |
| MinIO 文件 | 每周 | 90 天 |
| 配置文件 | 每次变更 | 永久 |

### 异地备份

```bash
# 使用 rsync 同步到远程服务器
rsync -avz -e ssh ./backup/ user@remote-server:/backup/homework-ai/

# 使用 rclone 同步到云存储
rclone sync ./backup/ remote:homework-ai-backup
```

---

## 灾难恢复

### 恢复优先级

1. **关键服务** (0-2 小时)
   - 数据库恢复
   - MinIO 恢复
   - 配置文件恢复

2. **完整服务** (2-24 小时)
   - 验证数据完整性
   - 测试核心功能
   - 恢复监控告警

3. **完整验证** (24-48 小时)
   - 数据一致性检查
   - 性能验证
   - 安全审计

### 灾难恢复检查清单

- [ ] 确认灾难范围和影响
- [ ] 准备备份文件
- [ ] 验证备份文件完整性
- [ ] 准备恢复环境
- [ ] 执行数据库恢复
- [ ] 执行 MinIO 恢复
- [ ] 恢复配置文件
- [ ] 启动所有服务
- [ ] 验证核心功能
- [ ] 检查数据一致性
- [ ] 恢复监控告警
- [ ] 记录灾难恢复报告
