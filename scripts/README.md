# Scripts 目录说明

本目录包含 Homework AI 系统的运维脚本。

---

## 备份脚本

### backup-db.sh

数据库备份脚本，备份 MySQL 数据到本地目录。

**使用方法**:
```bash
./scripts/backup-db.sh
```

**配置**:
- `BACKUP_DIR`: 备份文件存储目录 (默认: `./backup/db`)
- `RETENTION_DAYS`: 备份保留天数 (默认: 7 天)
- `MYSQL_CONTAINER`: MySQL 容器名称 (默认: `mysql`)

**备份文件命名**: `homework_ai_YYYYMMDD_HHMMSS.sql.gz`

---

### full-backup.sh

完整备份脚本，备份数据库、MinIO 文件和配置文件。

**使用方法**:
```bash
./scripts/full-backup.sh
```

**备份内容**:
1. 数据库 (MySQL)
2. 文件存储 (MinIO)
3. 配置文件 (环境变量、Nginx 配置等)
4. 备份清单 (MANIFEST.txt)

**配置**:
- `BACKUP_ROOT`: 备份根目录 (默认: `./backup`)
- `RETENTION_DAYS`: 备份保留天数 (默认: 30 天)

**备份文件命名**: `full_backup_YYYYMMDD_HHMMSS.tar.gz`

---

## 定时任务配置

### 添加 Cron 定时任务

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点执行数据库备份
0 2 * * * cd /path/to/project && ./scripts/backup-db.sh >> ./backup/logs/backup.log 2>&1

# 每周日凌晨 3 点执行完整备份
0 3 * * 0 cd /path/to/project && ./scripts/full-backup.sh >> ./backup/logs/backup.log 2>&1
```

---

## 恢复操作

### 数据库恢复

```bash
# 解压备份文件
gunzip backup/db/homework_ai_20240115_103045.sql.gz

# 恢复到数据库
docker exec -i mysql mysql -u root -p homework_ai < backup/db/homework_ai_20240115_103045.sql
```

### 完整恢复

```bash
# 解压完整备份
tar xzf backup/full_backup_20240115_103045.tar.gz -C /tmp/restore

# 按照备份清单中的说明执行恢复
cat /tmp/restore/full_20240115_103045/MANIFEST.txt
```

---

## 注意事项

1. **权限**: 脚本需要执行权限，首次使用请运行:
   ```bash
   chmod +x scripts/*.sh
   ```

2. **环境变量**: 确保项目根目录有正确的 `.env` 文件配置

3. **Docker 运行**: 备份脚本需要 Docker 服务运行

4. **磁盘空间**: 定期清理旧备份，避免磁盘空间不足

5. **备份验证**: 定期测试备份恢复流程，确保备份有效性
