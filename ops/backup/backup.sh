#!/usr/bin/env bash
# One backup run. Executed inside the `backup` compose service (image mongo:7,
# which ships mongodump + bash) — scheduled by backup-loop.sh, or manually:
#
#   docker compose -f docker-compose.prod.yml run --rm backup bash /ops/backup.sh
#
# Produces:
#   /backups/mongo/db-<UTC stamp>.archive.gz        every run  (mongodump, gzip)
#   /backups/uploads/uploads-<UTC stamp>.tar.gz     Sundays, or if none exists
#
# /backups is bind-mounted to ./backups on the host. Retention via env:
#   BACKUP_RETENTION_DAYS (default 14)  — days of mongo dumps to keep
#   UPLOADS_KEEP          (default 4)   — uploads tars to keep
#   BACKUP_UPLOADS        (default 1)   — set 0 to skip the uploads tar
set -euo pipefail

MONGO_URI="${MONGO_URI:-mongodb://mongo:27017/photovideo360}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_UPLOADS="${BACKUP_UPLOADS:-1}"
UPLOADS_KEEP="${UPLOADS_KEEP:-4}"

stamp="$(date -u +%Y-%m-%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/mongo" "$BACKUP_DIR/uploads"

# Dump to a .part file first so an interrupted dump never looks like a backup.
db_out="$BACKUP_DIR/mongo/db-$stamp.archive.gz"
echo "[backup] mongodump -> $db_out"
mongodump --uri="$MONGO_URI" --gzip --archive="$db_out.part" --quiet
mv "$db_out.part" "$db_out"
echo "[backup] mongo dump done ($(du -h "$db_out" | cut -f1))"

# Prune old dumps and any stale partials.
find "$BACKUP_DIR/mongo" -name 'db-*.archive.gz' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/mongo" -name '*.part' -mmin +180 -delete

if [ "$BACKUP_UPLOADS" = "1" ]; then
  have_tar="$(find "$BACKUP_DIR/uploads" -name 'uploads-*.tar.gz' -print -quit 2>/dev/null || true)"
  # Weekly (Sunday), plus a first run so a fresh install is covered immediately.
  if [ "$(date -u +%u)" = "7" ] || [ -z "$have_tar" ]; then
    up_out="$BACKUP_DIR/uploads/uploads-$stamp.tar.gz"
    echo "[backup] uploads tar -> $up_out"
    tar -czf "$up_out.part" -C "$UPLOADS_DIR" .
    mv "$up_out.part" "$up_out"
    echo "[backup] uploads tar done ($(du -h "$up_out" | cut -f1))"
    # Keep the newest $UPLOADS_KEEP tars.
    ls -1t "$BACKUP_DIR/uploads"/uploads-*.tar.gz 2>/dev/null | tail -n +"$((UPLOADS_KEEP + 1))" | xargs -r rm -f
    find "$BACKUP_DIR/uploads" -name '*.part' -mmin +360 -delete
  fi
fi

echo "[backup] complete: $stamp"
