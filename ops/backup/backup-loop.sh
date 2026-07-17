#!/usr/bin/env bash
# Entrypoint of the `backup` compose service: runs backup.sh once a day at
# BACKUP_HOUR_UTC (default 03:00 UTC), and once at startup when the newest
# mongo dump is missing or older than a day — so a fresh install or a container
# that was down over the schedule still gets covered.
set -u

HOUR="${BACKUP_HOUR_UTC:-3}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

recent="$(find "$BACKUP_DIR/mongo" -name 'db-*.archive.gz' -mtime -1 -print -quit 2>/dev/null || true)"
if [ -z "$recent" ]; then
  echo "[backup-loop] no dump from the last 24h — running startup backup"
  bash /ops/backup.sh || echo "[backup-loop] WARNING: startup backup failed"
fi

while true; do
  now="$(date -u +%s)"
  next="$(date -u -d "today ${HOUR}:00" +%s)"
  if [ "$next" -le "$now" ]; then
    next="$(date -u -d "tomorrow ${HOUR}:00" +%s)"
  fi
  echo "[backup-loop] next backup at $(date -u -d "@$next" '+%F %T') UTC"
  sleep $(( next - now ))
  bash /ops/backup.sh || echo "[backup-loop] WARNING: scheduled backup failed"
done
