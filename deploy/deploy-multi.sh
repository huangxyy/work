#!/usr/bin/env bash
# =============================================================================
# Multi-Server Deployment Script
# Deploys Homework AI to multiple servers defined in deploy/servers inventory
#
# Usage:
#   bash deploy/deploy-multi.sh                    # Deploy to all servers
#   bash deploy/deploy-multi.sh --parallel         # Deploy in parallel
#   bash deploy/deploy-multi.sh --rolling          # Rolling deploy (one at a time)
#   bash deploy/deploy-multi.sh --only api,worker  # Deploy only api and worker roles
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INVENTORY="$SCRIPT_DIR/servers"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"
PARALLEL=false
ROLLING=false
ONLY_ROLES=""
APP_DIR="${APP_DIR:-/opt/homework-ai}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --parallel)  PARALLEL=true; shift ;;
    --rolling)   ROLLING=true; shift ;;
    --only)      ONLY_ROLES="$2"; shift 2 ;;
    --inventory) INVENTORY="$2"; shift 2 ;;
    *)           echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ ! -f "$INVENTORY" ]]; then
  echo -e "${RED}Inventory file not found: $INVENTORY${NC}"
  echo "Create it: cp deploy/servers.example deploy/servers"
  exit 1
fi

# Parse inventory
declare -a SERVERS=()
declare -A SERVER_ROLES=()

while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue

  server="${line%% *}"
  roles="${line#* }"
  [[ "$roles" == "$server" ]] && roles="all"

  SERVERS+=("$server")
  SERVER_ROLES["$server"]="$roles"
done < "$INVENTORY"

if [[ ${#SERVERS[@]} -eq 0 ]]; then
  echo -e "${RED}No servers found in inventory${NC}"
  exit 1
fi

echo -e "${CYAN}━━━ Homework AI Multi-Server Deploy ━━━${NC}"
echo -e "Servers: ${#SERVERS[@]}"
echo -e "Mode: $(if $PARALLEL; then echo 'parallel'; elif $ROLLING; then echo 'rolling'; else echo 'sequential'; fi)"
echo ""

# Function to deploy to a single server
deploy_server() {
  local server="$1"
  local roles="${SERVER_ROLES[$server]}"
  local host="${server%%:*}"
  local port="${server##*:}"
  [[ "$port" == "$server" ]] && port=22

  # Filter by role if --only is specified
  if [[ -n "$ONLY_ROLES" ]]; then
    local match=false
    IFS=',' read -ra ROLE_FILTER <<< "$ONLY_ROLES"
    IFS=',' read -ra SERVER_ROLE_LIST <<< "$roles"
    for fr in "${ROLE_FILTER[@]}"; do
      for sr in "${SERVER_ROLE_LIST[@]}"; do
        [[ "$fr" == "$sr" || "$sr" == "all" ]] && match=true
      done
    done
    if ! $match; then
      echo -e "${YELLOW}[SKIP]${NC} $server (roles: $roles, filter: $ONLY_ROLES)"
      return 0
    fi
  fi

  echo -e "${GREEN}[DEPLOY]${NC} $server (roles: $roles)"

  # Sync project files
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='deploy/.env.prod' \
    --exclude='deploy/servers' \
    -e "ssh $SSH_OPTS -p $port" \
    "$PROJECT_DIR/" "$host:$APP_DIR/"

  # Copy env file if not exists on remote
  ssh $SSH_OPTS -p "$port" "$host" "
    cd $APP_DIR
    if [[ ! -f deploy/.env.prod ]]; then
      echo 'No .env.prod found on remote. Copying template...'
      cp deploy/.env.prod.example deploy/.env.prod
      echo 'WARNING: Edit deploy/.env.prod on $host before running!'
    fi
  "

  # Run deploy
  ssh $SSH_OPTS -p "$port" "$host" "
    cd $APP_DIR
    bash deploy/quick-deploy.sh
  "

  echo -e "${GREEN}[DONE]${NC} $server"
}

# Execute
FAILED=()

if $PARALLEL; then
  pids=()
  for server in "${SERVERS[@]}"; do
    deploy_server "$server" &
    pids+=($!)
  done
  for i in "${!pids[@]}"; do
    if ! wait "${pids[$i]}"; then
      FAILED+=("${SERVERS[$i]}")
    fi
  done
elif $ROLLING; then
  for server in "${SERVERS[@]}"; do
    if ! deploy_server "$server"; then
      FAILED+=("$server")
      echo -e "${RED}Rolling deploy stopped at $server${NC}"
      break
    fi
    echo -e "${YELLOW}Waiting 10s before next server...${NC}"
    sleep 10
  done
else
  for server in "${SERVERS[@]}"; do
    if ! deploy_server "$server"; then
      FAILED+=("$server")
    fi
  done
fi

# Summary
echo ""
echo -e "${CYAN}━━━ Deploy Summary ━━━${NC}"
echo -e "Total: ${#SERVERS[@]}, Failed: ${#FAILED[@]}"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo -e "${RED}Failed servers:${NC}"
  for s in "${FAILED[@]}"; do
    echo -e "  ${RED}✗${NC} $s"
  done
  exit 1
else
  echo -e "${GREEN}All servers deployed successfully${NC}"
fi
