#!/usr/bin/env bash
# =============================================================================
# Homework AI Management Script
# Simplifies common Docker Compose operations
#
# Usage:
#   bash deploy/manage.sh status       # Show service status
#   bash deploy/manage.sh logs [svc]   # Tail logs (optionally for one service)
#   bash deploy/manage.sh restart      # Restart API and Worker
#   bash deploy/manage.sh stop         # Stop all services
#   bash deploy/manage.sh start        # Start all services
#   bash deploy/manage.sh update       # Pull latest code, rebuild, restart
#   bash deploy/manage.sh migrate      # Run database migrations
#   bash deploy/manage.sh backup       # Backup database
#   bash deploy/manage.sh shell        # Open bash in API container
#   bash deploy/manage.sh scale api=2  # Scale API to 2 replicas
#   bash deploy/manage.sh health       # Check API health
#   bash deploy/manage.sh cleanup      # Remove old images and volumes
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env.prod"

DC="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Run: bash deploy/setup-env.sh"
  exit 1
fi

cmd="${1:-help}"
shift || true

case "$cmd" in
  status|ps)
    $DC ps
    ;;

  logs)
    svc="${1:-}"
    if [[ -n "$svc" ]]; then
      $DC logs -f --tail=100 "$svc"
    else
      $DC logs -f --tail=50
    fi
    ;;

  restart)
    echo "Restarting API and Worker..."
    $DC restart api worker
    echo "Done. Checking health..."
    sleep 5
    $DC ps api worker
    ;;

  stop)
    echo "Stopping all services..."
    $DC down
    echo "Done."
    ;;

  start)
    echo "Starting all services..."
    $DC up -d
    echo "Done."
    $DC ps
    ;;

  update)
    echo "Pulling latest code..."
    cd "$PROJECT_DIR"
    git pull --ff-only

    echo "Rebuilding images..."
    $DC build --parallel api worker web

    echo "Running migrations..."
    $DC run --rm migrate

    echo "Restarting services..."
    $DC up -d api worker web

    echo "Waiting for health..."
    sleep 10
    $DC ps
    ;;

  migrate)
    echo "Running database migrations..."
    $DC run --rm migrate
    echo "Done."
    ;;

  backup)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p "$BACKUP_DIR"

    echo "Backing up database..."
    $DC exec -T mysql mysqldump -u root -p"$($DC exec -T mysql printenv MYSQL_ROOT_PASSWORD 2>/dev/null || echo root)" \
      homework_ai --single-transaction --routines --triggers \
      | gzip > "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

    echo "Backup saved: $BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
    ls -lh "$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
    ;;

  shell)
    echo "Opening shell in API container..."
    $DC exec api sh
    ;;

  scale)
    if [[ $# -eq 0 ]]; then
      echo "Usage: manage.sh scale api=2 worker=3"
      exit 1
    fi
    echo "Scaling: $*"
    $DC up -d --scale "$@"
    $DC ps
    ;;

  health)
    echo "Checking API health..."
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps api | grep -q "healthy"; then
      echo "API: healthy"
    else
      echo "API: not healthy"
      $DC logs --tail=20 api
    fi
    ;;

  cleanup)
    echo "Cleaning up unused Docker resources..."
    docker image prune -f
    docker volume prune -f
    docker system df
    ;;

  help|*)
    echo "Homework AI Management"
    echo ""
    echo "Usage: bash deploy/manage.sh <command>"
    echo ""
    echo "Commands:"
    echo "  status     Show service status"
    echo "  logs       Tail logs (optionally: logs api)"
    echo "  restart    Restart API and Worker"
    echo "  stop       Stop all services"
    echo "  start      Start all services"
    echo "  update     Pull, rebuild, migrate, restart"
    echo "  migrate    Run database migrations only"
    echo "  backup     Backup database to backups/"
    echo "  shell      Open shell in API container"
    echo "  scale      Scale services (e.g., scale api=2)"
    echo "  health     Check API health"
    echo "  cleanup    Remove unused Docker resources"
    ;;
esac
