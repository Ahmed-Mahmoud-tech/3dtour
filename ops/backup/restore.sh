#!/usr/bin/env bash
# Restore a backup produced by backup.sh. Run inside the backup service:
#
#   # database (DROPS and replaces existing collections):
#   docker compose -f docker-compose.prod.yml run --rm backup \
#     bash /ops/restore.sh /backups/mongo/db-2026-07-17_030000.archive.gz
#
#   # uploaded media (extracts over /uploads; existing files are overwritten):
#   docker compose -f docker-compose.prod.yml run --rm backup \
#     bash /ops/restore.sh --uploads /backups/uploads/uploads-2026-07-13_030000.tar.gz
#
# List what's available first:  ls backups/mongo backups/uploads  (on the host)
set -euo pipefail

MONGO_URI="${MONGO_URI:-mongodb://mongo:27017/photovideo360}"
UPLOADS_DIR="${UPLOADS_DIR:-/uploads}"

usage() {
  echo "usage: restore.sh <mongo .archive.gz>" >&2
  echo "       restore.sh --uploads <uploads .tar.gz>" >&2
  exit 1
}

[ $# -ge 1 ] || usage

if [ "$1" = "--uploads" ]; then
  [ $# -eq 2 ] || usage
  archive="$2"
  [ -f "$archive" ] || { echo "ERROR: $archive not found" >&2; exit 1; }
  echo "[restore] extracting $archive over $UPLOADS_DIR"
  tar -xzf "$archive" -C "$UPLOADS_DIR"
  echo "[restore] uploads restored"
else
  archive="$1"
  [ -f "$archive" ] || { echo "ERROR: $archive not found" >&2; exit 1; }
  echo "[restore] mongorestore --drop from $archive"
  mongorestore --uri="$MONGO_URI" --gzip --archive="$archive" --drop --quiet
  echo "[restore] database restored"
fi
