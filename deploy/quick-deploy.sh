#!/usr/bin/env bash
# =============================================================================
# Quick Deploy - Deploy Homework AI on any fresh Linux server with Docker
# 
# Usage (on a fresh server):
#   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/quick-deploy.sh | bash
#
# Or clone and run:
#   git clone YOUR_REPO homework-ai && cd homework-ai
#   bash deploy/quick-deploy.sh
#
# Prerequisites: Linux with root/sudo access. Script installs Docker if needed.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

# --- Detect project root ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../package.json" ]]; then
  PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [[ -f "./package.json" ]]; then
  PROJECT_DIR="$(pwd)"
else
  err "Cannot find project root. Run from project directory or deploy/ directory."
  exit 1
fi

cd "$PROJECT_DIR"
log "Project root: $PROJECT_DIR"

# --- Step 1: Install Docker if not present ---
step "Step 1/6: Checking Docker"

if command -v docker &>/dev/null; then
  log "Docker already installed: $(docker --version)"
else
  log "Installing Docker..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v yum &>/dev/null; then
    sudo yum install -y yum-utils
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    err "Unsupported package manager. Install Docker manually: https://docs.docker.com/engine/install/"
    exit 1
  fi
  sudo systemctl enable docker
  sudo systemctl start docker
  log "Docker installed: $(docker --version)"
fi

# Ensure docker compose v2 is available
if ! docker compose version &>/dev/null; then
  err "docker compose v2 not found. Install: https://docs.docker.com/compose/install/"
  exit 1
fi

# --- Step 2: Environment file ---
step "Step 2/6: Environment Configuration"

ENV_FILE="deploy/.env.prod"
if [[ -f "$ENV_FILE" ]]; then
  log "Using existing $ENV_FILE"
else
  log "Creating $ENV_FILE from template..."
  cp deploy/.env.prod.example "$ENV_FILE"

  # Generate random passwords if not set
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
  MINIO_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  DB_ROOT_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

  sed -i "s|DB_PASS=.*|DB_PASS=$DB_PASS|" "$ENV_FILE"
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
  sed -i "s|MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_PASS|" "$ENV_FILE"
  sed -i "s|DB_ROOT_PASSWORD=.*|DB_ROOT_PASSWORD=$DB_ROOT_PASS|" "$ENV_FILE"

  log "Generated random passwords in $ENV_FILE"
  warn "Review and edit $ENV_FILE before production use!"
  warn "Especially: CORS_ORIGIN, LLM_API_KEY, BAIDU_OCR keys"
fi

# --- Step 3: Build images ---
step "Step 3/6: Building Docker Images"

log "Building backend and frontend images (this may take a few minutes)..."
docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" build --parallel 2>&1 | tail -5

# --- Step 4: Start infrastructure ---
step "Step 4/6: Starting Infrastructure (MySQL, Redis, MinIO)"

docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" up -d mysql redis minio
log "Waiting for services to be healthy..."

for svc in mysql redis minio; do
  retries=0
  while [[ $retries -lt 30 ]]; do
    if docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" ps "$svc" 2>/dev/null | grep -q "healthy"; then
      log "$svc is healthy"
      break
    fi
    retries=$((retries + 1))
    sleep 2
  done
  if [[ $retries -ge 30 ]]; then
    warn "$svc did not become healthy in time"
  fi
done

# --- Step 5: Run migrations ---
step "Step 5/6: Running Database Migrations"

docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" run --rm migrate
log "Migrations complete"

# --- Step 6: Start application ---
step "Step 6/6: Starting Application"

docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" up -d api worker web
log "Waiting for API to be ready..."

API_HEALTHY=false
for i in $(seq 1 30); do
  if docker compose -f deploy/docker-compose.prod.yml --env-file "$ENV_FILE" ps api 2>/dev/null | grep -q "healthy"; then
    API_HEALTHY=true
    break
  fi
  sleep 3
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [[ "$API_HEALTHY" == "true" ]]; then
  echo -e "${GREEN}  ✓ Homework AI deployed successfully!${NC}"
else
  echo -e "${YELLOW}  ⚠ Deployment complete but API health check pending${NC}"
fi
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Web:     ${CYAN}http://$(hostname -I | awk '{print $1}'):80${NC}"
echo -e "  API:     ${CYAN}http://$(hostname -I | awk '{print $1}'):80/api${NC}"
echo -e "  Swagger: ${CYAN}http://$(hostname -I | awk '{print $1}'):80/api/docs${NC}"
echo -e "  MinIO:   ${CYAN}http://$(hostname -I | awk '{print $1}'):9001${NC}"
echo ""
echo -e "  Default accounts: admin/Test1234, teacher01/Test1234, student01/Test1234"
echo ""
echo -e "  Manage: ${CYAN}docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod [logs|ps|down]${NC}"
echo ""
