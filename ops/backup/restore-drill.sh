#!/usr/bin/env bash
# Prove a DB dump is actually restorable WITHOUT touching production:
# spins up a throwaway mongo:7 container, restores the dump into it, prints
# per-collection document counts, then destroys the container. Run ON the
# VPS host (not inside the backup service — it needs to start a container):
#
#   bash ops/backup/restore-drill.sh                                  # newest dump
#   bash ops/backup/restore-drill.sh backups/mongo/db-<stamp>.archive.gz
#
# Exit 0 = dump restored and contains collections with documents.
# Run it after any change to the backup pipeline, and occasionally on a cron.
set -euo pipefail

STACK_DIR="${STACK_DIR:-$HOME/photovideo360}"
DB_NAME="${DB_NAME:-photovideo360}"

if [ $# -ge 1 ]; then
  archive="$1"
else
  archive="$(ls -1t "$STACK_DIR"/backups/mongo/db-*.archive.gz 2>/dev/null | head -1 || true)"
  [ -n "$archive" ] || { echo "ERROR: no dumps in $STACK_DIR/backups/mongo" >&2; exit 1; }
fi
[ -f "$archive" ] || { echo "ERROR: $archive not found" >&2; exit 1; }
archive_abs="$(realpath "$archive")"

name="restore-drill-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

echo "[drill] dump: $archive_abs ($(du -h "$archive_abs" | cut -f1))"
echo "[drill] starting throwaway mongo container: $name"
docker run -d --name "$name" \
  -v "$archive_abs":/drill.archive.gz:ro \
  mongo:7 >/dev/null

echo "[drill] waiting for mongod"
for _ in $(seq 1 30); do
  if [ "$(docker exec "$name" mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null)" = "1" ]; then
    break
  fi
  sleep 1
done
[ "$(docker exec "$name" mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null)" = "1" ] \
  || { echo "ERROR: throwaway mongod never came up" >&2; exit 1; }

echo "[drill] mongorestore into the throwaway container"
docker exec "$name" mongorestore --gzip --archive=/drill.archive.gz --quiet

echo "[drill] collections in '$DB_NAME':"
counts="$(docker exec "$name" mongosh --quiet --eval "
  const d = db.getSiblingDB('$DB_NAME');
  const names = d.getCollectionNames().sort();
  let total = 0;
  names.forEach(c => { const n = d.getCollection(c).countDocuments(); total += n; print('  ' + c + ': ' + n); });
  print('TOTAL_DOCS=' + total + ' COLLECTIONS=' + names.length);
")"
echo "$counts"

total="$(echo "$counts" | sed -n 's/.*TOTAL_DOCS=\([0-9]*\).*/\1/p')"
colls="$(echo "$counts" | sed -n 's/.*COLLECTIONS=\([0-9]*\).*/\1/p')"

if [ "${colls:-0}" -eq 0 ] || [ "${total:-0}" -eq 0 ]; then
  echo "[drill] FAIL: dump restored but '$DB_NAME' is empty ($colls collections, $total docs)" >&2
  exit 1
fi

echo "[drill] OK: $colls collections, $total documents — this dump restores cleanly"
