#!/usr/bin/env bash
# One-shot production health sweep. Run ON the VPS:
#
#   bash ~/photovideo360/ops/health.sh
#
# Checks: compose services running, API /api/health, Mongo ping, root-disk
# usage, newest DB dump age, newest uploads tar age, stale .part files.
# Prints one OK/WARN/FAIL line per check; exit 0 only when nothing FAILed,
# so it can sit in cron with output mailed/logged on non-zero exit.
#
# Tunables (env):
#   STACK_DIR            stack directory        (default ~/photovideo360)
#   DISK_WARN_PCT        disk %% that WARNs      (default 80)
#   DISK_FAIL_PCT        disk %% that FAILs      (default 90)
#   DB_BACKUP_MAX_HOURS  dump age that FAILs    (default 26 — nightly + slack)
#   UPLOADS_MAX_DAYS     tar age that WARNs     (default 8 — weekly + slack)
set -uo pipefail

STACK_DIR="${STACK_DIR:-$HOME/photovideo360}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
DISK_FAIL_PCT="${DISK_FAIL_PCT:-90}"
DB_BACKUP_MAX_HOURS="${DB_BACKUP_MAX_HOURS:-26}"
UPLOADS_MAX_DAYS="${UPLOADS_MAX_DAYS:-8}"

cd "$STACK_DIR" || { echo "FAIL  stack dir $STACK_DIR not found"; exit 1; }

fails=0
warns=0
ok()   { echo "OK    $*"; }
warn() { echo "WARN  $*"; warns=$((warns + 1)); }
fail() { echo "FAIL  $*"; fails=$((fails + 1)); }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

echo "== health check $(date -u '+%Y-%m-%d %H:%M:%S') UTC =="

# 1. Every defined service has a running container.
expected="$(compose config --services 2>/dev/null | sort)"
running="$(compose ps --services --status running 2>/dev/null | sort)"
if [ -z "$expected" ]; then
  fail "could not read compose services (docker down? wrong dir?)"
else
  missing="$(comm -23 <(echo "$expected") <(echo "$running"))"
  if [ -z "$missing" ]; then
    ok "all services running: $(echo "$expected" | tr '\n' ' ')"
  else
    fail "services NOT running: $(echo "$missing" | tr '\n' ' ')"
  fi
fi

# 2. API health endpoint (from inside the container — the port isn't published).
if compose exec -T server wget -qO- http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
  ok "API /api/health responds"
else
  fail "API /api/health not responding"
fi

# 3. Mongo ping.
if [ "$(compose exec -T mongo mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null)" = "1" ]; then
  ok "Mongo ping"
else
  fail "Mongo ping failed"
fi

# 4. Root disk usage.
disk_pct="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [ "$disk_pct" -ge "$DISK_FAIL_PCT" ]; then
  fail "disk ${disk_pct}% used (>= ${DISK_FAIL_PCT}%)"
elif [ "$disk_pct" -ge "$DISK_WARN_PCT" ]; then
  warn "disk ${disk_pct}% used (>= ${DISK_WARN_PCT}%)"
else
  ok "disk ${disk_pct}% used"
fi

# 5. Newest DB dump is fresh.
newest_db="$(find backups/mongo -name 'db-*.archive.gz' -mmin -"$((DB_BACKUP_MAX_HOURS * 60))" -print -quit 2>/dev/null || true)"
any_db="$(find backups/mongo -name 'db-*.archive.gz' -print -quit 2>/dev/null || true)"
if [ -n "$newest_db" ]; then
  ok "DB dump fresh (< ${DB_BACKUP_MAX_HOURS}h): $(ls -1t backups/mongo/db-*.archive.gz | head -1)"
elif [ -n "$any_db" ]; then
  fail "newest DB dump older than ${DB_BACKUP_MAX_HOURS}h: $(ls -1t backups/mongo/db-*.archive.gz | head -1)"
else
  fail "no DB dumps in backups/mongo at all"
fi

# 6. Newest uploads tar is reasonably fresh (weekly schedule).
if [ -n "$(find backups/uploads -name 'uploads-*.tar.gz' -mtime -"$UPLOADS_MAX_DAYS" -print -quit 2>/dev/null || true)" ]; then
  ok "uploads tar fresh (< ${UPLOADS_MAX_DAYS}d)"
elif [ -n "$(find backups/uploads -name 'uploads-*.tar.gz' -print -quit 2>/dev/null || true)" ]; then
  warn "newest uploads tar older than ${UPLOADS_MAX_DAYS}d"
else
  warn "no uploads tars in backups/uploads"
fi

# 7. Crashed/partial backups lying around.
parts="$(find backups -name '*.part' -mmin +180 2>/dev/null || true)"
if [ -n "$parts" ]; then
  warn "stale .part files (crashed backup?): $(echo "$parts" | tr '\n' ' ')"
else
  ok "no stale .part files"
fi

echo "== result: $fails failed, $warns warnings =="
[ "$fails" -eq 0 ]
