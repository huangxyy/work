# 交接与二次部署指南

这份文档用于把项目打包给下一位维护者，并让对方可以独立部署、回滚和运维。

## 1. 先做决策：是否需要业务数据

| 场景 | 需要数据库数据 | 需要对象存储数据（MinIO） |
| --- | --- | --- |
| 仅继续开发（本地调试） | 否 | 否 |
| 新环境从零上线（空系统） | 否（用迁移初始化） | 否 |
| 接手现有业务（保留历史提交、报告） | 是 | 是 |

结论：

- 如果只是让对方“能跑起来”，只交付代码即可。
- 如果要保留历史作业和报告，必须同时交付 **MySQL + MinIO** 备份。
- Redis 队列数据通常不需要迁移（重新启动后可重新入队）。

如果你只打算迁移服务账号（不迁移历史业务数据），直接按下面做：

1. 代码包：`pnpm handover:package`
2. 账号模板：复制 `deploy/account-only.env.example` 为 `deploy/account-only.env` 并填写
3. 把 `deploy/account-only.env` 通过安全渠道单独发送给接收方
4. 接收方把账号填回 `deploy/host.env` / `apps/backend/.env` 后部署

## 2. 交付物清单（建议）

最小交付（开发/空部署）：

1. 代码包（不含密钥）
2. 部署文档：`docs/DEPLOY.md`
3. 交接文档：`docs/HANDOVER.md`
4. 配置模板：`deploy/host.env.example`

完整交付（业务迁移）：

1. 上面的最小交付
2. 数据库备份（`*.sql` 或 `*.sql.gz`）
3. MinIO 桶备份（`submissions` 对象）
4. 密钥与账号清单（通过安全渠道单独发送）

仅账号交付（你当前场景）：

1. 上面的最小交付
2. `deploy/account-only.env`（只含 MySQL/Redis/MinIO 账号）

## 3. 你这边的交付前计划（推荐顺序）

1. 执行质量检查：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. 按需导出数据：
   - 数据库：`bash deploy/backup-db.sh`
   - MinIO：`bash deploy/backup-storage.sh`
3. 生成交付包：
   - `pnpm handover:package`
   - 只迁移账号时可用：`pnpm handover:package:with-accounts`
   - 或 `powershell -ExecutionPolicy Bypass -File scripts/create-handover-package.ps1`
   - 如需自动打入最近一次备份：
     `powershell -ExecutionPolicy Bypass -File scripts/create-handover-package.ps1 -IncludeDatabaseDump -DatabaseDumpPath backup/db -IncludeStorageBackup -StorageBackupPath backup/storage`
   - 如需带数据：追加 `-IncludeDatabaseDump` / `-IncludeStorageBackup`
4. 发包前自检：确保不包含 `deploy/host.env`、`apps/backend/.env`、任何 API Key

## 4. 接收方部署路径（Linux 服务器）

### A. 空部署（推荐）

1. 将代码导入其 Git 仓库（或解压后自行建仓）
2. 复制配置模板：`cp deploy/host.env.example deploy/host.env`
3. 填写 `deploy/host.env`（域名、DB 密码、JWT、OCR/LLM 密钥等）
4. 首次安装：`bash deploy/install-host.sh`
5. 后续发布：`bash deploy/update-host.sh`
6. 验证：`bash deploy/healthcheck.sh --url http://127.0.0.1:3008/api/health`

### B. 业务数据迁移部署

1. 先按“空部署”跑通系统
2. 导入数据库：
   - `gunzip -c homework_ai_xxx.sql.gz | mysql -u<user> -p <db>`
   - 或 `mysql -u<user> -p <db> < homework_ai.sql`
3. 恢复 MinIO：
   - `bash deploy/restore-storage.sh --source <storage_backup_dir_or_tar.gz>`
4. 重启服务：
   - `systemctl restart homework-ai-api homework-ai-worker`
5. 健康检查与业务抽样验证

## 5. 密钥与安全传递建议

- 代码包里不要放明文密钥。
- 密钥通过单独渠道传递（密码管理器、加密文档、一次性链接）。
- 最低需要传递：
  - MySQL 账号/密码
  - JWT_SECRET
  - Baidu OCR Key/Secret
  - LLM API Key/Base URL/Model
  - MinIO Access Key/Secret Key

## 6. 验收清单（接收方）

1. `systemctl status homework-ai-api` 为 active
2. `systemctl status homework-ai-worker` 为 active
3. `/api/health` 返回 healthy 或 degraded
4. 能正常登录（至少一个管理员）
5. 提交一份作业后，状态可从 `QUEUED` 进入 `DONE`
6. （如迁移数据）历史提交、图片、报表可正常查看

## 7. 常见交接误区

- 只迁移数据库，不迁移 MinIO，导致图片/报告丢失。
- 把 `host.env`/`.env` 直接打包给第三方，造成密钥泄漏。
- 接收方没启动 worker，结果任务卡在 `QUEUED`。
