# 故障排查指南

本文档介绍 Homework AI 系统的常见问题和排查方法。

---

## 目录

- [快速诊断流程](#快速诊断流程)
- [常见问题](#常见问题)
- [日志分析技巧](#日志分析技巧)
- [性能问题排查](#性能问题排查)
- [网络问题排查](#网络问题排查)
- [数据问题排查](#数据问题排查)

---

## 快速诊断流程

### 诊断命令

```bash
# 1. 检查所有服务状态
docker-compose ps

# 2. 检查服务健康状态
curl http://localhost:3000/api/health

# 3. 检查日志（最近 100 行）
docker-compose logs --tail=100

# 4. 检查资源使用
docker stats

# 5. 检查端口占用
netstat -tulpn | grep -E ':(3000|3001|3306|6379|9000|80)'
```

### 健康检查流程图

```
开始故障排查
    │
    ▼
服务无法访问？
    │
    ├── 是 → 检查 Docker 容器状态 (docker-compose ps)
    │         │
    │         ├── 容器未运行 → 查看启动日志 (docker-compose logs)
    │         └── 容器运行中 → 检查网络/端口配置
    │
    └── 否 → 功能异常
              │
              ▼
         API 返回错误？
              │
              ├── 是 → 查看后端日志
              └── 否 → 检查前端控制台
```

---

## 常见问题

### 1. 提交一直停留在 QUEUED 状态

**症状**: 学生上传作业后，提交状态一直显示 "等待处理"

**原因**: Worker 进程未运行或队列服务异常

**排查步骤**:

```bash
# 1. 检查 Worker 进程是否运行
docker-compose ps | grep worker

# 2. 检查队列状态
curl http://localhost:3000/api/health | jq '.queue'

# 3. 查看 Worker 日志
docker-compose logs worker
```

**解决方案**:

```bash
# 启动 Worker 进程
pnpm start:worker:dev

# 或使用 Docker
docker-compose up -d worker
```

---

### 2. MAX_RETRIES_EXCEEDED 错误

**症状**: 批改失败，日志显示 `MAX_RETRIES_EXCEEDED`

**原因**: LLM 输出被截断，`LLM_MAX_TOKENS` 设置过小

**排查步骤**:

```bash
# 检查环境变量配置
grep LLM_MAX_TOKENS apps/backend/.env
```

**解决方案**:

```bash
# 修改 .env 文件
LLM_MAX_TOKENS=2000  # 或更高，如 3000

# 重启服务
docker-compose restart backend-api worker
```

---

### 3. 502 Bad Gateway 错误

**症状**: 访问前端时返回 502 错误

**原因**: 后端 API 服务未运行或 Nginx 配置错误

**排查步骤**:

```bash
# 1. 检查后端服务
curl http://localhost:3000/api/health

# 2. 检查 Nginx 配置
docker-compose logs nginx

# 3. 检查 Nginx 配置文件
cat deploy/nginx/nginx.conf
```

**解决方案**:

```bash
# 启动后端服务
pnpm start:dev

# 或重启 Nginx
docker-compose restart nginx
```

---

### 4. OCR 识别失败

**症状**: 图片上传后无法识别文字

**原因**: 百度 OCR 密钥无效或额度耗尽

**排查步骤**:

```bash
# 查看 Worker 日志中的 OCR 错误
docker-compose logs worker | grep -i ocr

# 测试 OCR 密钥
curl -X POST "https://aip.baidubce.com/oauth/2.0/token" \
  -d "grant_type=client_credentials&client_id=YOUR_API_KEY&client_secret=YOUR_SECRET_KEY"
```

**解决方案**:

```bash
# 1. 检查密钥配置
grep BAIDU_OCR apps/backend/.env

# 2. 更新有效密钥
BAIDU_OCR_API_KEY=your_valid_api_key
BAIDU_OCR_SECRET_KEY=your_valid_secret_key

# 3. 重启服务
docker-compose restart worker
```

---

### 5. LLM 批改失败

**症状**: 批改任务失败，日志显示 LLM 调用错误

**原因**: DeepSeek API 密钥无效、额度耗尽或网络问题

**排查步骤**:

```bash
# 查看 Worker 日志中的 LLM 错误
docker-compose logs worker | grep -i "llm\|deepseek"

# 测试 API 连接
curl -X POST "https://api.deepseek.com/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

**解决方案**:

```bash
# 1. 检查密钥配置
grep LLM_API_KEY apps/backend/.env

# 2. 检查 API 额度
# 登录 https://platform.deepseek.com

# 3. 更新密钥或充值
LLM_API_KEY=your_new_api_key

# 4. 重启服务
docker-compose restart worker
```

---

### 6. 数据库连接失败

**症状**: 服务无法连接数据库

**原因**: MySQL 服务未运行、密码错误或连接数过多

**排查步骤**:

```bash
# 1. 检查 MySQL 状态
docker-compose ps mysql

# 2. 测试数据库连接
docker exec -it mysql mysql -u root -p

# 3. 查看连接数
docker exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"
docker exec mysql mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# 4. 查看错误日志
docker-compose logs mysql | tail -50
```

**解决方案**:

```bash
# 1. 启动 MySQL 服务
docker-compose up -d mysql

# 2. 增加最大连接数（如需要）
# 编辑 my.cnf 添加: max_connections=500

# 3. 清理空闲连接
docker exec mysql mysql -u root -p -e "KILL <process_id>;"
```

---

### 7. MinIO 上传失败

**症状**: 图片上传失败

**原因**: MinIO 服务异常、凭证错误或存储空间不足

**排查步骤**:

```bash
# 1. 检查 MinIO 状态
docker-compose ps minio

# 2. 检查磁盘空间
df -h

# 3. 测试 MinIO 连接
curl http://localhost:9000/minio/health/live

# 4. 查看 MinIO 日志
docker-compose logs minio | tail -50
```

**解决方案**:

```bash
# 1. 启动 MinIO 服务
docker-compose up -d minio

# 2. 清理旧数据释放空间
# 登录 MinIO 控制台: http://localhost:9001

# 3. 扩容存储卷
```

---

### 8. 队列积压严重

**症状**: 队列中等待任务过多

**原因**: Worker 并发不足或处理速度慢

**排查步骤**:

```bash
# 查看队列状态
curl http://localhost:3000/api/health | jq '.queue'

# 查看 Worker 性能
docker stats worker
```

**解决方案**:

```bash
# 1. 增加 Worker 并发数
WORKER_CONCURRENCY=10  # 默认 5

# 2. 启动更多 Worker 实例
docker-compose up -d --scale worker=3

# 3. 优化 LLM 配置使用更快模式
LLM_PROVIDER=cheap
```

---

### 9. PDF 导出失败或乱码

**症状**: 导出的 PDF 文件乱码或损坏

**原因**: 中文字体未正确加载

**排查步骤**:

```bash
# 检查字体配置
grep PDF_FONT_PATH apps/backend/.env

# 测试字体文件
ls -la /path/to/simhei.ttf
```

**解决方案**:

```bash
# 1. 安装中文字体
# Linux:
apt-get install fonts-wqy-microhei

# 2. 配置字体路径
PDF_FONT_PATH=/usr/share/fonts/truetype/wqy/wqy-microhei.ttc
CHART_FONT_PATH=/usr/share/fonts/truetype/wqy/wqy-microhei.ttc

# 3. 重启服务
docker-compose restart backend-api
```

---

### 10. CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

**原因**: 前后端域名不匹配或 CORS 配置错误

**排查步骤**:

```bash
# 1. 检查 CORS 配置
grep CORS_ORIGIN apps/backend/.env

# 2. 查看后端日志
docker-compose logs backend-api | grep -i cors
```

**解决方案**:

```bash
# 开发环境
CORS_ORIGIN=http://localhost:3001,http://localhost:5173

# 生产环境（替换为实际域名）
CORS_ORIGIN=https://your-domain.com

# 重启服务
docker-compose restart backend-api
```

---

## 日志分析技巧

### 按级别过滤

```bash
# 查看错误日志
docker-compose logs backend-api | grep ERROR

# 查看警告日志
docker-compose logs backend-api | grep WARN

# 查看特定服务日志
docker-compose logs -f worker
```

### 按时间过滤

```bash
# 查看最近 1 小时的日志
docker-compose logs --since=1h backend-api

# 查看特定时间范围的日志
docker-compose logs --since="2024-01-15T10:00:00" --until="2024-01-15T11:00:00" backend-api
```

### 关键词搜索

```bash
# 搜索特定提交的日志
docker-compose logs worker | grep "submissionId=abc123"

# 搜索特定用户的操作
docker-compose logs backend-api | grep "userId=user456"
```

### 日志统计

```bash
# 统计错误数量
docker-compose logs backend-api | grep -c ERROR

# 统计各类型日志数量
docker-compose logs backend-api | grep -oE 'ERROR|WARN|INFO' | sort | uniq -c
```

---

## 性能问题排查

### API 响应慢

```bash
# 1. 查看数据库慢查询
docker exec mysql mysql -u root -p -e "SHOW VARIABLES LIKE 'slow_query_log%';"

# 2. 启用慢查询日志
docker exec mysql mysql -u root -p -e "SET GLOBAL slow_query_log = 'ON';"
docker exec mysql mysql -u root -p -e "SET GLOBAL long_query_time = 1;"

# 3. 查看慢查询
docker exec mysql tail -f /var/log/mysql/slow-query.log

# 4. 分析数据库连接
docker exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"
```

### Worker 处理慢

```bash
# 1. 查看 Worker 资源使用
docker stats worker

# 2. 增加并发数
WORKER_CONCURRENCY=10

# 3. 使用更快的 LLM 模式
LLM_PROVIDER=cheap
```

### 内存占用高

```bash
# 1. 查看容器资源使用
docker stats --no-stream

# 2. 限制容器内存
# 在 docker-compose.yml 中添加:
services:
  backend-api:
    deploy:
      resources:
        limits:
          memory: 1G
```

---

## 网络问题排查

### 端口冲突

```bash
# 查看端口占用
netstat -tulpn | grep :3000
lsof -i :3000

# 更改端口配置
PORT=3001  # 在 .env 中修改
```

### 容器间通信

```bash
# 查看容器网络
docker network ls
docker network inspect work_default

# 测试容器间连接
docker exec backend-api ping mysql
docker exec backend-api curl http://minio:9000
```

---

## 数据问题排查

### 数据不一致

```bash
# 1. 检查数据库状态
docker exec mysql mysql -u root -p -e "CHECK TABLE homework_ai.Submission;"

# 2. 修复表
docker exec mysql mysql -u root -p -e "REPAIR TABLE homework_ai.Submission;"

# 3. 优化表
docker exec mysql mysql -u root -p -e "OPTIMIZE TABLE homework_ai.Submission;"
```

### 数据迁移问题

```bash
# 重新运行迁移
cd apps/backend
pnpm prisma:migrate reset

# 生成 Prisma Client
pnpm prisma:generate
```

---

## 获取帮助

如果以上方法无法解决问题：

1. 收集诊断信息：
   ```bash
   ./scripts/collect-diag-info.sh
   ```

2. 查看完整文档：
   - [DEVELOPMENT.md](DEVELOPMENT.md) - 开发指南
   - [API.md](API.md) - API 文档
   - [RUNBOOK.md](RUNBOOK.md) - 运维手册

3. 联系技术支持并提供：
   - 错误日志
   - 系统环境信息
   - 复现步骤
