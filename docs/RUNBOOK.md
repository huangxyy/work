# 运维手册 (Runbook)

本文档描述 Homework AI 系统的日常运维操作。

## 目录

- [服务启动](#服务启动)
- [数据保留清理](#数据保留清理)
- [健康检查](#健康检查)
- [故障排查](#故障排查)
- [数据备份](#数据备份)

---

## 服务启动

### 开发环境

**重要：系统采用分离式架构，需要同时运行API服务器和Worker进程**

1. 启动Docker依赖服务：
```bash
cd deploy
docker-compose up -d mysql redis minio nginx
```

2. 启动后端API服务器（终端1）：
```bash
cd apps/backend
npm run start:dev
```
或执行 `start-api.bat`

3. 启动Worker进程（终端2）：
```bash
cd apps/backend
npm run start:worker:dev
```
或执行 `start-worker.bat`

4. 启动前端：
```bash
cd apps/frontend
npm run dev
```

### 验证服务状态

```bash
# 检查端口占用
netstat -ano | findstr "3001"  # 前端
netstat -ano | findstr "3008"  # 后端API

# 检查Docker服务
cd deploy
docker-compose ps

# 测试API健康
curl http://localhost:3008/api/health

# 测试Nginx代理
curl http://localhost/api/health
```

---

## 数据保留清理

系统自动清理超过指定天数的提交数据（默认7天）。

### 配置参数

在 `apps/backend/.env` 中配置：

```bash
RETENTION_DAYS=7              # 保留天数
RETENTION_BATCH_SIZE=200      # 每批处理数量
RETENTION_DRY_RUN=false       # 是否模拟运行
RETENTION_CRON="30 3 * * *"  # 执行时间（每天3:30）
RUN_RETENTION=true            # 是否启用定时任务（仅API服务器启用）
```

### 手动执行

**模拟运行（不删除数据）**：
```bash
curl -X POST "http://localhost:3008/api/admin/retention/run" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"days":7,"batchSize":200}'
```

**实际执行**：
```bash
curl -X POST "http://localhost:3008/api/admin/retention/run" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"days":7,"batchSize":200}'
```

---

## 健康检查

### 端点检查

```bash
# 后端API健康检查
curl http://localhost:3008/api/health

# 返回示例
# {"status":"ok","timestamp":"2026-02-04T14:00:00.000Z"}
```

### 服务状态检查

```bash
# Docker服务
docker-compose ps

# 应该看到以下服务都在运行：
# - mysql (Up)
# - redis (Up)
# - minio (Up)
# - nginx (Up)
```

### 队列状态检查

访问管理员的"队列管理"页面查看：
- 等待处理的任务数
- 正在处理的任务数
- 失败的任务数

---

## 故障排查

### 问题1: 提交后状态一直是QUEUED

**症状**: 学生提交作业后，状态长时间停留在QUEUED

**原因**: Worker进程没有运行

**解决步骤**:
1. 检查Worker进程是否存在：
   ```bash
   tasklist | findstr node
   ```
2. 如果没有运行，启动Worker：
   ```bash
   cd apps/backend
   npm run start:worker:dev
   ```

### 问题2: 批改失败，显示MAX_RETRIES_EXCEEDED

**症状**: 提交处理后显示失败，错误码为MAX_RETRIES_EXCEEDED

**原因**: `LLM_MAX_TOKENS` 设置太小，导致AI响应的JSON被截断

**解决步骤**:
1. 编辑 `apps/backend/.env`
2. 修改 `LLM_MAX_TOKENS=2000`
3. 重启Worker进程

### 问题3: 前端显示502 Bad Gateway

**症状**: 访问页面时显示502错误

**原因**: 后端API或前端开发服务器没有运行

**解决步骤**:
1. 检查后端API是否运行（端口3008）
2. 检查前端开发服务器是否运行（端口3001）
3. 检查Nginx配置和状态

### 问题4: OCR识别失败

**症状**: 提交后显示OCR错误

**检查项**:
1. 百度OCR API密钥是否正确配置
2. API密钥是否已过期
3. 网络连接是否正常

### 问题5: AI批改失败

**症状**: OCR成功但AI批改失败

**检查项**:
1. DeepSeek API密钥是否正确
2. API额度是否充足
3. `LLM_MAX_TOKENS` 设置是否足够（建议2000）

---

## 数据备份

### MySQL备份

```bash
# 导出数据库
docker exec deploy-mysql-1 mysqldump -u root -proot homework_ai > backup.sql

# 恢复数据库
docker exec -i deploy-mysql-1 mysql -u root -proot homework_ai < backup.sql
```

### MinIO备份

MinIO数据存储在Docker volume中，备份方式：

```bash
# 备份MinIO数据卷
docker run --rm -v deploy_minio-data:/data -v %cd%:/backup \
  alpine tar czf /backup/minio-backup.tar.gz -C /data .

# 恢复MinIO数据卷
docker run --rm -v deploy_minio-data:/data -v %cd%:/backup \
  alpine tar xzf /backup/minio-backup.tar.gz -C /data
```

---

## 环境变量参考

### 关键配置项

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3008 | 后端API端口 |
| `LLM_MAX_TOKENS` | 2000 | LLM最大输出token数 |
| `LLM_MAX_INPUT_CHARS` | 6000 | LLM最大输入字符数 |
| `LLM_DAILY_CALL_LIMIT` | 400 | 每日LLM调用限制 |
| `WORKER_CONCURRENCY` | 5 | Worker并发数 |
| `RETENTION_DAYS` | 7 | 数据保留天数 |

---

## 监控建议

1. **队列监控**: 定期检查BullMQ队列状态
2. **API监控**: 监控API响应时间和错误率
3. **资源监控**: 监控CPU、内存使用情况
4. **LLM配额**: 监控每日LLM调用次数和token消耗
