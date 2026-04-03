# Docker Deployment Guide

Complete guide for deploying Homework AI using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Service URLs](#service-urls)
- [Default Accounts](#default-accounts)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Performance Tuning](#performance-tuning)
- [Monitoring](#monitoring)

---

## Prerequisites

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Docker Engine | 24.0+ | 26.0+ |
| Docker Compose | 2.20+ | 2.25+ |
| RAM | 4 GB | 8 GB |
| Disk Space | 20 GB | 50 GB |
| CPU | 2 cores | 4+ cores |

### Verify Docker Installation

```bash
docker --version
docker compose version
```

### Install Docker (if needed)

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone <YOUR_REPO_URL> homework-ai
cd homework-ai
```

### 2. Configure Environment

Copy the example environment file and edit with your values:

```bash
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

**Required configurations (must change):**

```bash
# Generate secure passwords with: openssl rand -base64 24
DB_ROOT_PASSWORD=your_secure_mysql_root_password_min_24_chars
DB_PASS=your_secure_database_password_min_24_chars
JWT_SECRET=your_jwt_secret_min_64_chars_use_openssl_rand_base64_64
MINIO_ROOT_PASSWORD=your_secure_minio_password_min_24_chars

# Database
DB_NAME=homework_ai
DB_USER=homework_ai

# CORS - Set your actual domain in production
CORS_ORIGIN=https://your-domain.com

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_BUCKET=submissions

# AI Services (configure via admin panel or here)
BAIDU_OCR_API_KEY=your_baidu_api_key
BAIDU_OCR_SECRET_KEY=your_baidu_secret_key
LLM_API_KEY=your_llm_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Scaling (optional)
API_REPLICAS=1
WORKER_REPLICAS=1
WORKER_CONCURRENCY=5
```

### 3. Start Services

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

### 4. Run Database Migrations

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod run --rm migrate
```

### 5. Verify Deployment

```bash
# Check all services are running
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps

# Check API health
curl http://localhost/api/health

# View logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f
```

---

## Service URLs

After deployment, services are available at:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost` | Main application |
| API | `http://localhost/api` | Backend API |
| API Docs | `http://localhost/api/docs` | Swagger documentation |
| MinIO Console | `http://localhost:9001` | Object storage management |
| Health Check | `http://localhost/api/health` | Service health status |

**Internal Services** (not exposed externally):
- MySQL: `mysql:3306` (internal network)
- Redis: `redis:6379` (internal network)
- MinIO API: `minio:9000` (internal network)

---

## Default Accounts

**Password:** `123456` (for development - MUST change for production)

| Role | Account | Purpose |
|------|---------|---------|
| Admin | `admin` | System administration |
| Teacher | `teacher01` | Teacher dashboard |
| Student | `student01` | Student submissions |

### Change Default Passwords

1. Login to Admin dashboard
2. Navigate to User Management
3. Change passwords for all default accounts
4. Or use the API to update:

```bash
curl -X POST http://localhost/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"123456","newPassword":"YourNewSecurePassword123"}'
```

---

## Common Operations

### View Logs

```bash
# All services
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f

# Specific service
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f api
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f worker
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f mysql

# Last 100 lines
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs --tail=100
```

### Restart Services

```bash
# All services
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart

# Specific service
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart api
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart worker
```

### Update Application

```bash
cd /path/to/homework-ai
git pull

# Rebuild and restart
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build

# Run migrations if needed
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod run --rm migrate
```

### Backup Database

```bash
# Create backup directory
mkdir -p backups

# Backup MySQL
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec -T mysql \
  mysqladmin -uroot -p"${DB_ROOT_PASSWORD}" shutdown || true

docker run --rm --volumes-from $(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps -q mysql) \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/mysql-backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/lib/mysql
```

### Backup MinIO Data

```bash
docker run --rm --volumes-from $(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps -q minio) \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d-%H%M%S).tar.gz /data
```

### Restore Database

```bash
# Stop services
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod down

# Restore MySQL
docker run --rm --volumes-from $(docker create -v /var/lib/mysql --name mysql-data alpine) \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/mysql-backup-YYYYMMDD-HHMMSS.tar.gz -C /

# Start services
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

### Scale Services

```bash
# Scale API (after updating API_REPLICAS in .env.prod)
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --scale api=2

# Scale Workers (after updating WORKER_REPLICAS in .env.prod)
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --scale worker=2
```

### Stop All Services

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod down
```

### Stop and Remove Volumes (WARNING: deletes data)

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod down -v
```

---

## Troubleshooting

### Submissions Stuck in QUEUED Status

**Symptom:** Student submissions remain in QUEUED status indefinitely.

**Cause:** Worker service is not running or has crashed.

**Solution:**

```bash
# Check worker status
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps worker

# Check worker logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs worker

# Restart worker
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart worker
```

### API Returns 502 Bad Gateway

**Symptom:** Frontend loads but API requests fail with 502.

**Cause:** API service not responding.

**Solution:**

```bash
# Check API health
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps api

# Check API logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs api

# Check API service directly
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec api curl http://localhost:3000/api/health

# Restart API
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart api
```

### Database Connection Failed

**Symptom:** Services cannot connect to MySQL.

**Solution:**

```bash
# Check MySQL is healthy
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps mysql

# Check MySQL logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs mysql

# Verify DATABASE_URL in .env.prod matches MySQL credentials
grep DATABASE_URL deploy/.env.prod

# Restart MySQL
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod restart mysql
```

### Out of Memory Errors

**Symptom:** Services restart frequently with OOM errors.

**Solution:**

1. Check current resource usage:
```bash
docker stats
```

2. Adjust memory limits in `deploy/docker-compose.prod.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 1G  # Increase as needed
```

3. Restart with new limits:
```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d
```

### OCR/Grading Failures

**Symptom:** Submissions fail with OCR or LLM errors.

**Solution:**

```bash
# Check API keys are configured
grep -E "BAIDU_OCR|LLM_API" deploy/.env.prod

# Test API connectivity
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec worker curl -I ${LLM_BASE_URL}

# Check worker logs for specific errors
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs worker | grep -i error
```

### MinIO Upload Failures

**Symptom:** Image uploads fail or storage errors.

**Solution:**

```bash
# Check MinIO is running
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps minio

# Check MinIO logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs minio

# Verify MinIO credentials
grep -E "MINIO_ROOT_USER|MINIO_ROOT_PASSWORD" deploy/.env.prod

# Access MinIO console at http://localhost:9001
# Verify bucket exists and permissions are correct
```

### Container Startup Failures

**Symptom:** Containers fail to start or crash immediately.

**Solution:**

```bash
# Check detailed logs
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs

# Check for resource constraints
docker system df

# Clean up unused resources
docker system prune -a

# Verify environment file is valid
cat deploy/.env.prod
```

---

## Production Checklist

Before deploying to production, ensure:

### Security

- [ ] All default passwords changed (`DB_ROOT_PASSWORD`, `DB_PASS`, `JWT_SECRET`, `MINIO_ROOT_PASSWORD`)
- [ ] Strong password policy enforced (minimum 16 characters, mixed case, numbers, symbols)
- [ ] `CORS_ORIGIN` set to specific domain, not `*`
- [ ] API keys for external services (OCR, LLM) configured
- [ ] Firewall rules configured (only expose ports 80/443)
- [ ] SSL/HTTPS enabled (see [SSL/HTTPS Setup](#sslhttps-setup))
- [ ] Security headers enabled (default in nginx.prod.conf)

### Database

- [ ] MySQL data volume persisted (named volume `mysql-data`)
- [ ] Database backups configured/scheduled
- [ ] Connection pooling configured in `DATABASE_URL`
- [ ] Migration run successfully

### Application

- [ ] Environment variables reviewed and set
- [ ] API and Worker services both running
- [ ] Health check endpoint returns healthy status
- [ ] Default user passwords changed
- [ ] Email/SMTP configured for notifications (optional)

### Monitoring

- [ ] Container health checks enabled
- [ ] Log rotation configured
- [ ] Error tracking enabled (optional)
- [ ] Performance monitoring setup (optional)

### Performance

- [ ] Appropriate replica counts set (`API_REPLICAS`, `WORKER_REPLICAS`)
- [ ] Worker concurrency tuned (`WORKER_CONCURRENCY`)
- [ ] Resource limits appropriate for server size
- [ ] CDN configured for static assets (optional)

---

## SSL/HTTPS Setup

### Option 1: Using Caddy (Recommended)

Create `deploy/Caddyfile`:

```
your-domain.com {
    reverse_proxy web:80
}

api.your-domain.com {
    reverse_proxy api:3000
}
```

Add Caddy service to `docker-compose.prod.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - internal

volumes:
  caddy-data:
  caddy-config:
```

### Option 2: Using Certbot + Nginx

1. Map additional ports to web service:
```yaml
  web:
    ports:
      - "127.0.0.1:8080:80"  # Internal only
```

2. Install certbot on host:
```bash
sudo apt install certbot python3-certbot-nginx
```

3. Generate certificate:
```bash
sudo certbot certonly --nginx -d your-domain.com
```

4. Create SSL configuration for host nginx:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8080;
        # ... other proxy settings
    }
}
```

### Option 3: Cloudflare (Easy)

1. Point DNS to Cloudflare
2. Enable "Flexible SSL" in Cloudflare dashboard
3. No server configuration needed

---

## Performance Tuning

### Database Optimization

Adjust MySQL resource limits in `docker-compose.prod.yml`:

```yaml
  mysql:
    deploy:
      resources:
        limits:
          memory: 2G  # Increase for large datasets
```

### Worker Concurrency

Adjust for your workload in `.env.prod`:

```bash
# For high-volume batch processing
WORKER_CONCURRENCY=10
WORKER_REPLICAS=2

# For low-volume, quality-focused processing
WORKER_CONCURRENCY=3
WORKER_REPLICAS=1
```

### API Scaling

For high traffic, scale API replicas:

```bash
# In .env.prod
API_REPLICAS=3

# Then restart
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --scale api=3
```

Add a load balancer (nginx) for multiple API instances:

```yaml
  lb:
    image: nginx:1.27-alpine
    ports:
      - "127.0.0.1:8080:80"
    volumes:
      - ./deploy/nginx/nginx.lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - api
    networks:
      - internal
```

### Redis Optimization

Increase Redis memory limit for large queues:

```yaml
  redis:
    command: redis-server --maxmemory 512mb --maxmemory-policy noeviction --appendonly yes
```

### Nginx Optimization

The default `nginx.prod.conf` includes:
- Gzip compression
- Client body size limit: 120MB
- Keep-alive connections
- Static asset caching

Adjust for your needs.

---

## Monitoring

### Container Health

```bash
# Check all container health
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps

# Detailed health inspection
docker inspect $(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps -q api) | jq '.[0].State.Health'
```

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific service
docker stats $(docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps -q api)
```

### Log Analysis

```bash
# Error counts
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs | grep -i error | wc -l

# Recent errors
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs --since=1h | grep -i error

# Worker processing stats
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs worker | grep -i "processing\|done\|failed"
```

### Database Metrics

```bash
# Connect to MySQL
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec mysql mysql -uroot -p"${DB_ROOT_PASSWORD}" homework_ai

# Run queries
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Questions';
```

### Queue Metrics (via Redis)

```bash
# Connect to Redis
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod exec redis redis-cli

# Check queue size
LLEN bull:grading:waiting

# Check active jobs
LLEN bull:grading:active

# Check failed jobs
LLEN bull:grading:failed
```

### Health Check Endpoint

```bash
curl http://localhost/api/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "connected"
  }
}
```

---

## Appendix

### File Structure

```
homework-ai/
├── deploy/
│   ├── docker-compose.prod.yml    # Production compose file
│   ├── .env.prod.example          # Environment template
│   ├── .env.prod                  # Your environment (not in git)
│   └── nginx/
│       └── nginx.prod.conf        # Frontend nginx config
├── apps/
│   ├── backend/
│   │   ├── dist/                  # Built backend
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema
│   │   └── src/
│   │       └── worker/            # Worker code
│   └── frontend/
│       └── dist/                  # Built frontend
├── Dockerfile                     # Multi-stage build
└── docker-compose.prod.yml        # Link to deploy/
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_ROOT_PASSWORD` | Yes | - | MySQL root password |
| `DB_PASS` | Yes | - | MySQL application password |
| `DB_NAME` | No | `homework_ai` | Database name |
| `DB_USER` | No | `homework_ai` | Database user |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `MINIO_ROOT_USER` | No | `minioadmin` | MinIO username |
| `MINIO_ROOT_PASSWORD` | Yes | - | MinIO password |
| `MINIO_BUCKET` | No | `submissions` | MinIO bucket name |
| `BAIDU_OCR_API_KEY` | No | - | Baidu OCR API key |
| `BAIDU_OCR_SECRET_KEY` | No | - | Baidu OCR secret |
| `LLM_API_KEY` | No | - | LLM provider API key |
| `LLM_BASE_URL` | No | - | LLM API endpoint |
| `LLM_MODEL` | No | - | LLM model name |
| `WORKER_CONCURRENCY` | No | `5` | Jobs processed per worker |
| `API_REPLICAS` | No | `1` | Number of API containers |
| `WORKER_REPLICAS` | No | `1` | Number of worker containers |
| `WEB_PORT` | No | `80` | Frontend web port |

### Support

For issues and questions:
- Check logs: `docker compose logs`
- Review this guide's troubleshooting section
- Consult the main documentation in `docs/`
- Open an issue on GitHub (if applicable)
