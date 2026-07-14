#!/usr/bin/env bash
# deploy.sh — health-gated deploy with automatic rollback.
# Run from /home/github-runner/pointage (or wherever docker-compose.yml lives).
set -euo pipefail

SERVICES=(fastapi django-hr django-auth react)
TIMEOUT=60          # seconds to wait for each service to become healthy
INTERVAL=3

log() { echo "[deploy] $*"; }

# ── 0. Snapshot current image IDs so we can roll back to exactly this state ──
log "Snapshotting current image IDs for rollback..."
declare -A PREV_IMAGE
for svc in "${SERVICES[@]}"; do
  PREV_IMAGE[$svc]=$(docker compose images -q "$svc" || true)
done

rollback() {
  log "!! Deploy failed — rolling back to previous images !!"
  for svc in "${SERVICES[@]}"; do
    if [ -n "${PREV_IMAGE[$svc]:-}" ]; then
      docker tag "${PREV_IMAGE[$svc]}" "pointage-${svc}:rollback" 2>/dev/null || true
    fi
  done
  # Re-run migrate-safe restart of previous containers.
  docker compose up -d "${SERVICES[@]}"
  docker compose restart nginx
  log "Rollback complete. Previous version restored."
  exit 1
}
trap rollback ERR

# ── 1. Build new images (does not touch running containers yet) ─────────────
log "Building new images..."
docker compose build "${SERVICES[@]}"

# ── 2. Start new containers (compose replaces old ones here) ────────────────
log "Starting new containers..."
docker compose up -d "${SERVICES[@]}"

# ── 3. Run migrations before serving real traffic ────────────────────────────
log "Running migrations..."
docker exec django_auth python manage.py migrate --noinput
docker exec django_hr python manage.py migrate --noinput

# ── 4. Health-check each service INTERNALLY (bypassing nginx) ───────────────
check_health() {
  local name=$1 url=$2
  local waited=0
  while (( waited < TIMEOUT )); do
    if docker exec "$name" python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('$url',timeout=2).status==200 else 1)" 2>/dev/null; then
      log "  $name: healthy"
      return 0
    fi
    sleep "$INTERVAL"
    waited=$((waited + INTERVAL))
  done
  log "  $name: FAILED health check after ${TIMEOUT}s"
  return 1
}

log "Health-checking new containers before exposing them..."
check_health fastapi    "http://localhost:8080/health"
check_health django_auth "http://localhost:8000/health/"
check_health django_hr   "http://localhost:8002/health/"

# ── 5. Verify JWT secrets match across services (your known failure mode) ───
log "Verifying JWT secret consistency..."
AUTH_SECRET=$(docker exec django_auth printenv JWT_SECRET_KEY)
HR_SECRET=$(docker exec django_hr printenv JWT_SECRET_KEY)
FASTAPI_SECRET=$(docker exec fastapi printenv DJANGO_SECRET_KEY 2>/dev/null || echo "")
if [ "$AUTH_SECRET" != "$HR_SECRET" ]; then
  log "JWT_SECRET_KEY mismatch between django_auth and django_hr!"
  exit 1
fi

# ── 6. Only now flip nginx — all upstreams are already confirmed healthy ────
log "All services healthy. Restarting nginx to pick up new upstreams..."
docker compose restart nginx

sleep 3
if ! curl -ksf https://localhost/api/fastapi/health >/dev/null; then
  log "Post-nginx-restart check failed!"
  exit 1
fi

trap - ERR
log "Deploy successful."
