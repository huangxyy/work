# 部署指南

## 生产环境部署

### 自动化部署

使用提供的自动化脚本：

```bash
cd deploy
bash install-host.sh
```

该脚本会自动：
1. 安装 Node.js 20
2. 安装并配置 Redis
3. 安装并配置 MinIO
4. 安装并配置 MySQL
5. 配置 Nginx 反向代理
6. 创建 systemd 服务
7. 部署应用到 `/www/homework-ai`

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
