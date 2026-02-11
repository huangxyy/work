# 部署指南

## 生产环境部署

### 自动化部署（首装）

先准备主机参数文件：

```bash
cp deploy/host.env.example deploy/host.env
vi deploy/host.env
```

再执行首装脚本：

```bash
cd deploy
bash install-host.sh
```

`install-host.sh` 会自动完成：
1. 安装 Node.js 20
2. 安装并配置 Redis
3. 安装并配置 MinIO
4. 初始化 MySQL（可通过 `SKIP_MYSQL_SETUP=1` 跳过）
5. 拉取代码并生成后端 `.env`
6. 构建后端与前端
7. 创建并启动 systemd 服务（API + Worker）
8. 发布前端静态资源与 Nginx 配置
9. 执行 `deploy/healthcheck.sh` 进行健康检查

### 自动化更新（持续发布）

首装完成后，后续更新建议使用：

```bash
bash deploy/update-host.sh
```

`update-host.sh` 会执行：
1. `git fetch + git pull --ff-only`
2. 安装依赖、生成 Prisma Client
3. 可选执行 `prisma migrate deploy`（`RUN_MIGRATIONS=1`）
4. 构建后端与前端
5. 同步前端资源到 `WEB_ROOT`
6. 重启 API / Worker 服务
7. 运行健康检查并等待服务就绪

### GitHub Actions 自动发布

仓库已提供 `/.github/workflows/deploy.yml`，支持两种触发方式：

1. `CI` 在 `main` 分支成功后自动触发部署
2. 手动触发 `Deploy`（可指定分支和是否执行迁移）

需要在仓库 Secrets 中配置：

- `DEPLOY_HOST`：目标服务器地址
- `DEPLOY_USER`：SSH 登录用户
- `DEPLOY_SSH_KEY`：私钥内容
- `DEPLOY_PORT`（可选，默认 `22`）
- `DEPLOY_APP_DIR`（可选，默认 `/www/homework-ai`）

### 手动部署

#### 1. 环境准备

```bash
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm@8

# 安装 Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
```

#### 2. 启动基础设施

```bash
cd deploy
docker-compose up -d
```

服务包括：
- MySQL 8 (端口 3306)
- Redis 7 (端口 6379)
- MinIO (端口 9000/9001)
- Nginx (端口 80)

#### 3. 配置环境变量

复制并编辑环境配置：

```bash
cp apps/backend/.env.example apps/backend/.env
vi apps/backend/.env
```

必须配置的变量：
```bash
DATABASE_URL=mysql://user:password@localhost:3306/homework_ai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
BAIDU_OCR_API_KEY=your-api-key
BAIDU_OCR_SECRET_KEY=your-secret-key
LLM_API_KEY=your-deepseek-api-key
```

#### 4. 构建应用

```bash
# 安装依赖
pnpm install

# 构建所有应用
pnpm build
```

#### 5. 配置 Nginx

Nginx 配置位于 `deploy/nginx/nginx.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /www/homework-ai/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 6. 配置 Systemd 服务

创建 API 服务：

```ini
[Unit]
Description=Homework AI API
After=network.target mysql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/www/homework-ai/backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

创建 Worker 服务：

```ini
[Unit]
Description=Homework AI Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/www/homework-ai/backend
ExecStart=/usr/bin/node dist/worker/main.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
systemctl daemon-reload
systemctl enable homework-ai-api
systemctl enable homework-ai-worker
systemctl start homework-ai-api
systemctl start homework-ai-worker
```

## Docker 部署

### 使用 Docker Compose

```bash
cd deploy
docker-compose up -d
```

### 环境变量

参考 `deploy/docker-compose.yml` 配置环境变量。

## 监控与日志

### 查看日志

```bash
# API 服务
journalctl -u homework-ai-api -f

# Worker 服务
journalctl -u homework-ai-worker -f

# Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 检查服务状态

```bash
systemctl status homework-ai-api
systemctl status homework-ai-worker
systemctl status nginx
```

### 发布后健康检查

```bash
bash deploy/healthcheck.sh --url http://127.0.0.1:3008/api/health
```

若希望严格要求总体状态必须为 `healthy`，可追加：

```bash
bash deploy/healthcheck.sh --url http://127.0.0.1:3008/api/health --require-healthy
```

## 故障排查

### 提交一直处于 QUEUED 状态

Worker 进程未运行，启动 Worker：

```bash
systemctl start homework-ai-worker
```

### PDF 导出文件损坏

中文字体加载失败，设置环境变量：

```bash
export PDF_FONT_PATH=/path/to/chinese-font.ttf
```

### 502 错误

后端服务未运行，检查并启动：

```bash
systemctl status homework-ai-api
systemctl start homework-ai-api
```

## 数据备份

### MySQL 备份

```bash
mysqldump -u root -p homework_ai > backup_$(date +%Y%m%d).sql
```

### MinIO 备份

```bash
mc mirror minio/homework-ai /backup/minio-$(date +%Y%m%d)
```
