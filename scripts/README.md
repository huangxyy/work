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

## 部署脚本

### create-handover-package.ps1

创建项目交接部署包，用于项目移交和二次部署。

**使用方法**:
```powershell
# 基础打包
pnpm handover:package

# 包含测试账号文件
pnpm handover:package:with-accounts

# 完整打包（包含数据库和存储备份）
.\scripts\create-handover-package.ps1 -IncludeDatabaseDump -IncludeStorageBackup
```

**参数**:
- `-OutputDir`: 输出目录 (默认: `release`)
- `-PackageName`: 包名前缀 (默认: `homework-ai-handover`)
- `-IncludeDatabaseDump`: 包含数据库备份
- `-DatabaseDumpPath`: 数据库备份文件路径
- `-IncludeStorageBackup`: 包含存储文件备份
- `-StorageBackupPath`: 存储备份目录路径
- `-IncludeAccountFile`: 包含测试账号文件
- `-AccountFilePath`: 账号文件路径

**输出内容**:
- 源代码压缩包
- 部署说明文档
- 环境配置模板
- 可选的数据库和存储备份

---

### check-ports.bat

Nginx 代理端口自动检测与同步工具，解决 Vite 开发服务器端口与 Nginx 配置不匹配的问题。

**使用方法**:
```bash
.\scripts\check-ports.bat
```

**功能**:
1. 检测 Nginx 配置的代理端口
2. 检测 Vite 配置文件的期望端口
3. 检测 Vite 实际运行的端口
4. 自动同步 Nginx 配置并重启

**适用场景**:
- 前端服务启动后页面无法访问
- Nginx 代理端口与 Vite 端口不匹配
- 端口被占用导致 Vite 自动切换端口

---

## 验证脚本

### retention/verify-retention.ps1

验证数据保留策略是否正确执行。

**使用方法**:
```powershell
.\scripts\retention\verify-retention.ps1
```

**功能**:
- 检查过期数据是否被正确清理
- 验证保留天数配置
- 生成清理报告

---

## 模板文件

### templates/README-HANDOVER.zh-CN.txt

交接文档模板，用于生成项目交接说明。

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

6. **Windows 脚本**: `.ps1` 脚本需要 PowerShell 执行权限，`.bat` 脚本可直接运行
