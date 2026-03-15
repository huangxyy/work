# 系统监控指南

本文档介绍 Homework AI 系统的监控指标、日志分析和性能监控工具。

---

## 目录

- [监控指标](#监控指标)
- [日志管理](#日志管理)
- [性能监控](#性能监控)
- [健康检查](#健康检查)
- [告警配置](#告警配置)
- [监控仪表板](#监控仪表板)

---

## 监控指标

### 系统级指标

| 指标类别 | 指标名称 | 正常范围 | 告警阈值 |
|---------|---------|---------|---------|
| **CPU** | 后端 API CPU 使用率 | < 70% | > 90% |
| **CPU** | Worker CPU 使用率 | < 80% | > 95% |
| **内存** | 后端 API 内存使用率 | < 70% | > 85% |
| **内存** | Worker 内存使用率 | < 80% | > 90% |
| **磁盘** | 数据库磁盘使用率 | < 70% | > 85% |
| **磁盘** | MinIO 磁盘使用率 | < 70% | > 85% |

### 应用级指标

| 指标类别 | 指标名称 | 说明 |
|---------|---------|------|
| **API** | 请求量 (QPS) | 每秒请求数 |
| **API** | 响应时间 (P50/P95/P99) | 请求响应延迟分布 |
| **API** | 错误率 | HTTP 4xx/5xx 错误比例 |
| **API** | 可用性 | 服务正常运行时间 |
| **队列** | 等待任务数 (waiting) | 待处理的批改任务 |
| **队列** | 活跃任务数 (active) | 正在处理的任务 |
| **队列** | 失败任务数 (failed) | 处理失败的任务 |
| **队列** | 队列深度 (waiting + active) | 总队列长度 |
| **LLM** | API 调用次数 | DeepSeek API 调用统计 |
| **LLM** | Token 消耗量 | 输入/输出 Token 总数 |
| **LLM** | API 调用成功率 | LLM 服务可用性 |
| **OCR** | 调用次数 | 百度 OCR 调用统计 |
| **OCR** | 识别成功率 | OCR 服务可用性 |
| **数据库** | 连接池使用率 | 活跃连接/最大连接 |
| **数据库** | 慢查询数量 | 执行时间超过阈值的查询 |
| **Redis** | 命中率 | 缓存效率 |
| **Redis** | 连接数 | 当前客户端连接数 |

### 业务指标

| 指标名称 | 说明 | 监控目的 |
|---------|------|---------|
| 日提交量 | 每日作业提交数 | 了解系统负载趋势 |
| 批改完成率 | 成功批改/总提交 | 衡量批改质量 |
| 平均批改时长 | 提交到完成的平均时间 | 用户体验指标 |
| 队列积压时长 | 任务在队列中的等待时间 | 识别性能瓶颈 |

---

## 日志管理

### 日志级别

| 级别 | 用途 | 示例场景 |
|-----|------|---------|
| **ERROR** | 错误事件，需要立即关注 | API 调用失败、数据库连接错误 |
| **WARN** | 警告事件，需要关注但不影响运行 | 重试操作、降级服务 |
| **INFO** | 重要信息事件 | 用户登录、任务完成 |
| **DEBUG** | 调试信息 | 详细的执行流程 |
| **LOG** | 常规日志输出 | 系统状态快照 |

### 日志位置

```bash
# Docker 环境
docker-compose logs -f backend-api    # 后端 API 日志
docker-compose logs -f worker         # Worker 日志
docker-compose logs -f mysql          # MySQL 日志
docker-compose logs -f redis          # Redis 日志
docker-compose logs -f minio          # MinIO 日志

# 本地开发环境
tail -f apps/backend/logs/combined.log    # 组合日志
tail -f apps/backend/logs/error.log       # 错误日志
```

### 日志格式

后端日志结构化输出（JSON 格式）：

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "context": "GradingService",
  "message": "Grading completed successfully",
  "meta": {
    "submissionId": "abc123",
    "userId": "user456",
    "duration": 3521,
    "tokensUsed": 1250
  }
}
```

### 日志查询

```bash
# 查看错误日志
docker-compose logs backend-api | grep ERROR

# 查看特定时间的日志
docker-compose logs --since="2024-01-15T10:00:00" --until="2024-01-15T11:00:00" backend-api

# 查看特定用户的操作
docker-compose logs backend-api | grep "userId=user456"

# 实时跟踪日志
docker-compose logs -f --tail=100 backend-api
```

### 日志轮转

Docker 日志轮转配置（已在 docker-compose.yml 中配置）：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # 单个日志文件最大 10MB
    max-file: "3"      # 保留最近 3 个日志文件
```

---

## 性能监控

### 监控工具推荐

#### 1. Prometheus + Grafana（推荐）

```bash
# 启动监控栈
cd deploy/monitoring
docker-compose up -d
```

访问：http://localhost:3000 (默认用户名/密码: admin/admin)

#### 2. 简易监控 - 健康检查端点

```bash
# 系统健康状态
curl http://localhost:3000/api/health

# 返回示例
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "storage": {
      "status": "healthy",
      "responseTime": 15
    }
  },
  "queue": {
    "waiting": 5,
    "active": 2,
    "failed": 0,
    "paused": false
  },
  "uptime": 86400000
}
```

### 性能分析

#### API 响应时间分析

```bash
# 使用 Apache Bench 进行压力测试
ab -n 1000 -c 10 http://localhost:3000/api/health

# 使用 wrk 进行更高级的测试
wrk -t4 -c100 -d30s http://localhost:3000/api/submissions
```

#### 数据库性能分析

```sql
-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';

-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- 查看连接状态
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';
```

#### Redis 性能分析

```bash
# 连接到 Redis
redis-cli

# 查看信息
INFO stats        # 统计信息
INFO memory       # 内存使用
INFO clients      # 客户端连接

# 监控命令
MONITOR           # 实时监控所有命令（谨慎使用）
```

---

## 健康检查

### 健康检查端点

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/health` | GET | 系统整体健康状态 |
| `/api/health/live` | GET | 存活探针（Liveness） |
| `/api/health/ready` | GET | 就绪探针（Readiness） |

### 健康检查脚本

```bash
#!/bin/bash
# health-check.sh

# 检查 API 服务
curl -f http://localhost:3000/api/health || exit 1

# 检查队列状态
HEALTH=$(curl -s http://localhost:3000/api/health)
QUEUE_WAITING=$(echo $HEALTH | jq -r '.queue.waiting // 0')

if [ "$QUEUE_WAITING" -gt 100 ]; then
    echo "WARNING: Queue depth is high: $QUEUE_WAITING"
fi

# 检查数据库
docker exec mysql mysqladmin ping -h localhost || exit 1

# 检查 Redis
docker exec redis redis-cli ping || exit 1

# 检查 MinIO
curl -f http://localhost:9000/minio/health/live || exit 1

echo "All health checks passed!"
```

---

## 告警配置

### 告警规则

| 告警名称 | 条件 | 级别 | 建议操作 |
|---------|------|------|---------|
| 队列积压 | waiting > 100 | Warning | 检查 Worker 状态，考虑扩容 |
| LLM 调用失败率 | 失败率 > 20% | Critical | 检查 API 密钥和额度 |
| 数据库连接失败 | 无法连接 | Critical | 检查数据库服务状态 |
| 磁盘空间不足 | 使用率 > 85% | Critical | 清理日志或扩容 |
| API 错误率 | 5xx 错误率 > 5% | Warning | 检查应用日志 |
| Worker 崩溃 | 无活跃 Worker | Critical | 重启 Worker 服务 |

### 通知渠道

- **邮件**: 配置 SMTP 服务器发送告警邮件
- **钉钉/企业微信**: 通过 Webhook 发送消息
- **短信**: 集成短信服务（用于紧急告警）

---

## 监控仪表板

### 推荐的 Grafana 面板

1. **系统概览**
   - CPU/内存/磁盘使用率
   - 服务运行状态
   - 网络流量

2. **API 性能**
   - QPS 趋势图
   - 响应时间分布
   - 错误率统计

3. **队列监控**
   - 任务积压趋势
   - 处理速度
   - 失败重试次数

4. **业务指标**
   - 日提交量趋势
   - 批改完成率
   - 平均处理时长

---

## 监控最佳实践

1. **分层监控**: 从基础设施到应用层全方位监控
2. **基线建立**: 在正常运行时建立性能基线
3. **趋势分析**: 关注指标变化趋势而非仅关注瞬时值
4. **告警收敛**: 合理设置告警阈值，避免告警疲劳
5. **定期审查**: 定期审查和优化监控配置
