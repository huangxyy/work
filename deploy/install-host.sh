#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/www/homework-ai"
WEB_ROOT="/www/wwwroot/aigzy.cn"
DOMAIN="aigzy.cn"
API_PORT="3008"
REPO_URL="CHANGE_ME"

DB_NAME="homework_ai"
DB_USER="homework_ai"
DB_PASS="CHANGE_ME"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_ROOT_PASSWORD=""
SKIP_MYSQL_SETUP="0"

JWT_SECRET="CHANGE_ME"
CORS_ORIGIN="https://${DOMAIN},http://${DOMAIN}"

MINIO_DATA="/www/minio-data"
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin"

BAIDU_OCR_API_KEY=""
BAIDU_OCR_SECRET_KEY=""
LLM_PROVIDER=""
LLM_API_KEY=""
LLM_BASE_URL=""
LLM_MODEL=""
LLM_MODEL_CHEAPER=""
LLM_MODEL_QUALITY=""

require_root() {
  if [ "${EUID}" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
  fi
}

require_value() {
  local name="$1"
  local value="$2"
  if [ "${value}" = "CHANGE_ME" ] || [ -z "${value}" ]; then
    echo "Set ${name} in deploy/install-host.sh before running."
    exit 1
  fi
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    return
  fi
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

install_tools() {
  apt-get update
  apt-get install -y git redis-server
  systemctl enable --now redis-server
}

setup_minio() {
  if ! id -u minio >/dev/null 2>&1; then
    useradd -r -s /usr/sbin/nologin minio
  fi

  mkdir -p "${MINIO_DATA}"
  chown -R minio:minio "${MINIO_DATA}"

  if [ ! -f /usr/local/bin/minio ]; then
    curl -fsSL -o /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio
    chmod +x /usr/local/bin/minio
  fi

  mkdir -p /etc/minio
  cat > /etc/minio/minio.env <<EOF
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_VOLUMES=${MINIO_DATA}
MINIO_OPTS=--address 127.0.0.1:9000 --console-address 127.0.0.1:9001
EOF

  cat > /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO
After=network.target

[Service]
User=minio
Group=minio
EnvironmentFile=/etc/minio/minio.env
ExecStart=/usr/local/bin/minio server \$MINIO_VOLUMES \$MINIO_OPTS
Restart=always
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now minio
}

setup_mysql() {
  if [ "${SKIP_MYSQL_SETUP}" = "1" ]; then
    echo "Skipping MySQL setup (SKIP_MYSQL_SETUP=1)."
    return
  fi
  if ! command -v mysql >/dev/null 2>&1; then
    echo "mysql client not found. Please install MySQL/MariaDB first."
    exit 1
  fi

  local mysql_cmd=("mysql")
  if [ -n "${MYSQL_ROOT_PASSWORD}" ]; then
    mysql_cmd=("mysql" "-uroot" "-p${MYSQL_ROOT_PASSWORD}" "-h" "${MYSQL_HOST}" "-P" "${MYSQL_PORT}")
  elif [ "${MYSQL_HOST}" != "127.0.0.1" ] || [ "${MYSQL_PORT}" != "3306" ]; then
    mysql_cmd=("mysql" "-h" "${MYSQL_HOST}" "-P" "${MYSQL_PORT}")
  fi

  "${mysql_cmd[@]}" <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} DEFAULT CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
}

clone_repo() {
  if [ -d "${APP_DIR}/.git" ]; then
    git -C "${APP_DIR}" pull --rebase
  else
    mkdir -p "${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
}

setup_env() {
  local env_file="${APP_DIR}/apps/backend/.env"
  cat > "${env_file}" <<EOF
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${DB_NAME}?connection_limit=20&pool_timeout=10
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=${CORS_ORIGIN}
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=${MINIO_ROOT_USER}
MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}
MINIO_BUCKET=submissions
MINIO_REGION=us-east-1
BAIDU_OCR_API_KEY=${BAIDU_OCR_API_KEY}
BAIDU_OCR_SECRET_KEY=${BAIDU_OCR_SECRET_KEY}
LLM_PROVIDER=${LLM_PROVIDER}
LLM_PROVIDER_NAME=
LLM_API_KEY=${LLM_API_KEY}
LLM_BASE_URL=${LLM_BASE_URL}
LLM_MODEL=${LLM_MODEL}
LLM_MODEL_CHEAPER=${LLM_MODEL_CHEAPER}
LLM_MODEL_QUALITY=${LLM_MODEL_QUALITY}
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_MS=20000
LLM_MAX_INPUT_CHARS=6000
LLM_DAILY_CALL_LIMIT=400
BUDGET_MODE=soft
WORKER_CONCURRENCY=5
RETENTION_DAYS=7
RETENTION_DRY_RUN=false
RETENTION_BATCH_SIZE=200
RETENTION_CRON=30 3 * * *
RUN_RETENTION=true
DATA_TTL_DAYS=7
BUDGET_DAILY_LIMIT=100
PORT=${API_PORT}
BATCH_ZIP_MAX_BYTES=104857600
BATCH_ZIP_MAX_UNCOMPRESSED_BYTES=314572800
BATCH_ZIP_MAX_ENTRY_BYTES=15728640
EOF

  cat > "${APP_DIR}/apps/frontend/.env" <<EOF
VITE_API_BASE_URL=/api
EOF
}

build_project() {
  cd "${APP_DIR}"
  corepack enable
  corepack prepare pnpm@8.15.9 --activate
  pnpm install --frozen-lockfile
  pnpm --filter backend prisma:generate
  pnpm --filter backend exec prisma migrate deploy
  pnpm --filter backend build
  VITE_API_BASE_URL=/api pnpm --filter frontend build
}

setup_services() {
  cat > /etc/systemd/system/homework-ai-api.service <<EOF
[Unit]
Description=Homework AI API
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/apps/backend
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/apps/backend/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/homework-ai-worker.service <<EOF
[Unit]
Description=Homework AI Worker
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/apps/backend
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/apps/backend/.env
ExecStart=/usr/bin/node dist/worker/main.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now homework-ai-api homework-ai-worker
}

deploy_frontend() {
  mkdir -p "${WEB_ROOT}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${APP_DIR}/apps/frontend/dist/" "${WEB_ROOT}/"
  else
    rm -rf "${WEB_ROOT:?}"/*
    cp -a "${APP_DIR}/apps/frontend/dist/." "${WEB_ROOT}/"
  fi
}

setup_nginx() {
  local nginx_conf=""
  if [ -d /www/server/panel/vhost/nginx ]; then
    nginx_conf="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
  elif [ -d /etc/nginx/sites-available ]; then
    nginx_conf="/etc/nginx/sites-available/${DOMAIN}"
  else
    nginx_conf="/etc/nginx/conf.d/${DOMAIN}.conf"
  fi

  cat > "${nginx_conf}" <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  client_max_body_size 120m;

  root ${WEB_ROOT};
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 180s;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

  if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
    ln -sf "${nginx_conf}" "/etc/nginx/sites-enabled/${DOMAIN}"
  fi

  nginx -t
  systemctl reload nginx
}

require_root
require_value "REPO_URL" "${REPO_URL}"
require_value "DB_PASS" "${DB_PASS}"
require_value "JWT_SECRET" "${JWT_SECRET}"

install_node
install_tools
setup_mysql
setup_minio
clone_repo
setup_env
build_project
setup_services
deploy_frontend
setup_nginx

echo "Done. API should be on http://127.0.0.1:${API_PORT}/api/health"
