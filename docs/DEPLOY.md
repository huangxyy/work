# 部署指南（Debian 12 + 宝塔，API/Worker 使用 systemd）

本文档是当前项目在生产环境的推荐部署方式，专门适配以下场景：

- 系统：Debian 12
- 面板：宝塔（BT）
- 前端：静态文件由 Nginx 托管
- 后端：NestJS API + Worker 由 `systemd` 托管
- 基础服务：MySQL / Redis（本机服务），MinIO（可本机或 Docker）

不推荐将后端 `dist` 目录作为宝塔“静态站点”根目录运行。

---

## 1. 目标架构

请求路径约定：

- `https://your-domain/` -> 前端静态文件
- `https://your-domain/api/*` -> 反向代理到 `http://127.0.0.1:3008`

后端进程：

- API：`apps/backend/dist/main.js`
- Worker：`apps/backend/dist/worker/main.js`

关键原则：

1. API 和 Worker 必须同时运行。
2. 前端 `VITE_API_BASE_URL` 生产环境固定为 `/api`。
3. Nginx `proxy_pass` 必须写成 `http://127.0.0.1:3008`（不要尾部 `/`）。

---

## 2. 目录约定

示例目录：

- 项目根目录：`/www/wwwroot/source-code`
- 后端目录：`/www/wwwroot/source-code/apps/backend`
- 前端目录：`/www/wwwroot/source-code/apps/frontend`

如你的目录不同，替换本文中的路径即可。

---

## 3. 前置条件

```bash
node -v
pnpm -v
mysql --version
redis-server --version
```

建议版本：

- Node.js 20.x
- pnpm 8.x
- MySQL 8.x
- Redis 7.x

如果 `pnpm` 不可用：

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm -v
```

---

## 4. 获取代码与安装依赖

```bash
cd /www/wwwroot
git clone <YOUR_REPO_URL> source-code
cd /www/wwwroot/source-code
pnpm install
```

后续更新：

```bash
cd /www/wwwroot/source-code
git pull --ff-only
pnpm install
```

---

## 5. 配置环境变量

### 5.1 后端：`apps/backend/.env`

先复制模板：

```bash
cd /www/wwwroot/source-code
cp apps/backend/.env.example apps/backend/.env
```

至少确认以下关键项：

```env
PORT=3008

DATABASE_URL=mysql://homework_ai:YOUR_DB_PASS@127.0.0.1:3306/homework_ai?connection_limit=20&pool_timeout=10
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=YOUR_LONG_RANDOM_SECRET

STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=YOUR_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=YOUR_MINIO_SECRET_KEY
MINIO_BUCKET=submissions
MINIO_REGION=us-east-1

BAIDU_OCR_API_KEY=YOUR_BAIDU_KEY
BAIDU_OCR_SECRET_KEY=YOUR_BAIDU_SECRET

LLM_API_KEY=YOUR_LLM_KEY
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_MAX_TOKENS=2000

CORS_ORIGIN=https://your-domain,http://your-domain
```

注意：

- `MINIO_ENDPOINT` 必须是 `9000`（API 端口），`9001` 是控制台端口。
- 缺少 `JWT_SECRET` 会导致认证模块无法正常启动。
- 缺少 `LLM_BASE_URL` 会导致批改相关功能失败。

### 5.2 前端：`apps/frontend/.env`

```env
VITE_API_BASE_URL=/api
```

不要在生产环境写成 `http://IP:3000/api`，否则容易出现跨域或混合内容问题。

---

## 6. 构建（会生成 dist）

`dist` 是构建产物，不会长期保存在仓库。必须构建后才会出现。

```bash
cd /www/wwwroot/source-code

pnpm --filter backend prisma:generate
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend build

VITE_API_BASE_URL=/api pnpm --filter frontend build
```

验证构建产物：

```bash
ls -lah /www/wwwroot/source-code/apps/backend/dist
ls -lah /www/wwwroot/source-code/apps/backend/dist/worker
ls -lah /www/wwwroot/source-code/apps/frontend/dist
```

若无 `dist`，先看构建是否失败：

```bash
cd /www/wwwroot/source-code/apps/backend
pnpm build
# 如需 pnpm 简洁日志，可使用：
# pnpm --reporter append-only build
echo "BUILD_EXIT=$?"
```

---

## 7. 使用 systemd 托管 API 和 Worker

先确认 Node 绝对路径：

```bash
which node
```

下面示例默认是 `/usr/bin/node`，如不同请替换。

### 7.1 API 服务

创建 `/etc/systemd/system/homework-ai-api.service`：

```ini
[Unit]
Description=Homework AI API
After=network.target

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=/www/wwwroot/source-code/apps/backend
Environment=NODE_ENV=production
EnvironmentFile=/www/wwwroot/source-code/apps/backend/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 7.2 Worker 服务

创建 `/etc/systemd/system/homework-ai-worker.service`：

```ini
[Unit]
Description=Homework AI Worker
After=network.target

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=/www/wwwroot/source-code/apps/backend
Environment=NODE_ENV=production
Environment=RUN_RETENTION=false
EnvironmentFile=/www/wwwroot/source-code/apps/backend/.env
ExecStart=/usr/bin/node dist/worker/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now homework-ai-api homework-ai-worker
```

检查状态：

```bash
sudo systemctl status homework-ai-api --no-pager -l
sudo systemctl status homework-ai-worker --no-pager -l
```

---

## 8. Nginx（宝塔站点配置）

在域名站点（例如 `www.aigzy.cn`）的 `server {}` 内，至少包含：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3008;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

注意：

- `proxy_pass` 后面不要写尾部 `/`。
- 前端根目录应指向 `apps/frontend/dist`（或其同步目录）。

验证并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. 首次联调验证

### 9.1 API 健康检查

```bash
curl -i http://127.0.0.1:3008/api/health
curl -i https://your-domain/api/health
```

### 9.2 登录接口（绕过前端定位问题）

```bash
curl -i -X POST https://your-domain/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"student01","password":"Test1234"}'
```

### 9.3 Worker 验证

```bash
sudo journalctl -u homework-ai-worker -f
```

---

## 10. 常见问题与排查

### 10.1 登录页显示“数据同步中”

含义：`/api/public/overview` 请求失败，不是前端文案 bug。

排查：

```bash
curl -i http://127.0.0.1:3008/api/public/overview?days=7
curl -i https://your-domain/api/public/overview?days=7
sudo journalctl -u homework-ai-api -n 100 --no-pager
```

### 10.2 提交一直是 `QUEUED`

Worker 未运行或异常退出：

```bash
sudo systemctl status homework-ai-worker --no-pager -l
sudo journalctl -u homework-ai-worker -n 200 --no-pager
```

### 10.3 构建后没有 `dist`

通常是执行目录不对或构建失败：

```bash
cd /www/wwwroot/source-code/apps/backend
pnpm build
# 如需 pnpm 简洁日志，可使用：
# pnpm --reporter append-only build
echo "BUILD_EXIT=$?"
```

### 10.4 从 Docker 导库后仍无法登录

先确认后端确实连到了当前库：

```bash
grep -n "^DATABASE_URL" /www/wwwroot/source-code/apps/backend/.env
```

再检查账号状态和哈希：

```sql
SELECT account, role, isActive, LENGTH(passwordHash) AS hash_len, LEFT(passwordHash,4) AS hash_prefix
FROM User
LIMIT 20;
```

`hash_len` 应为 `60`，`isActive` 应为 `1`。

### 10.5 上传/存储异常

重点检查 MinIO 配置：

- `MINIO_ENDPOINT` -> `http://127.0.0.1:9000`
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` 与 MinIO 实际账号一致

---

## 11. 日常运维命令

```bash
# 重启服务
sudo systemctl restart homework-ai-api homework-ai-worker

# 查看最近日志
sudo journalctl -u homework-ai-api -n 100 --no-pager
sudo journalctl -u homework-ai-worker -n 100 --no-pager

# 持续跟踪日志
sudo journalctl -u homework-ai-api -f
sudo journalctl -u homework-ai-worker -f
```

---

## 12. 发布更新流程（推荐）

```bash
cd /www/wwwroot/source-code
git pull --ff-only
pnpm install

pnpm --filter backend prisma:generate
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend build
VITE_API_BASE_URL=/api pnpm --filter frontend build

sudo systemctl restart homework-ai-api homework-ai-worker
sudo nginx -t && sudo systemctl reload nginx

curl -i https://your-domain/api/health
```

---

## 13. 安全建议

1. 不要在文档、截图、聊天中暴露真实密码和密钥。
2. 如果泄露过 `DB_PASS`、`JWT_SECRET`、`MINIO_SECRET_KEY`、`LLM_API_KEY`，请立刻轮换。
3. 后端监听本机地址，外网只暴露 80/443，由 Nginx 统一入口。

---

## 14. GitHub Actions 自动部署（增强版）

仓库已内置 `.github/workflows/deploy.yml`，支持以下能力：

- `main` 分支 CI 成功后自动触发部署
- 手动触发部署（可选分支、是否迁移、是否严格健康检查）
- 可选外部健康检查（例如域名 `/api/health`）
- 部署失败自动回滚（默认开启）
- 在 Workflow Summary 输出部署/健康/回滚结果

### 14.1 需要配置的 Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中配置：

- `DEPLOY_HOST`：部署服务器 IP 或域名
- `DEPLOY_USER`：SSH 用户
- `DEPLOY_SSH_KEY`：私钥（建议专用 deploy key）
- `DEPLOY_PORT`：SSH 端口（可选，默认 22）
- `DEPLOY_APP_DIR`：服务端项目目录（可选，默认 `/www/homework-ai`）
- `DEPLOY_HEALTH_URL`：外部健康检查 URL（可选，例如 `https://your-domain/api/health`）
- `DEPLOY_HEALTH_MAX_ATTEMPTS`：外部健康检查最大重试次数（可选，默认 20）
- `DEPLOY_HEALTH_RETRY_INTERVAL`：外部健康检查重试间隔秒（可选，默认 3）

### 14.2 手动触发参数说明

`Actions -> 自动部署 -> Run workflow` 可配置：

- `branch`：部署分支
- `run_migrations`：是否执行 `prisma migrate deploy`
- `backup_before_migration`：迁移前是否备份
- `require_healthy`：健康检查是否要求 `status=healthy`
- `auto_rollback_on_failure`：失败时是否自动回滚

### 14.3 回滚行为

当“远程部署失败”或“外部健康检查失败”时：

1. 若 `auto_rollback_on_failure=true`，将自动执行 `deploy/rollback-host.sh`
2. 若回滚成功，工作流会标记成功（但摘要会明确显示“部署失败+回滚成功”）
3. 若回滚失败，工作流标记失败，需要人工介入
