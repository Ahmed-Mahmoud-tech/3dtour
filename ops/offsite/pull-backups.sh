#!/usr/bin/env bash
# Off-site backup pull. Run on ANY machine that is NOT the VPS (laptop,
# second server, NAS) — the VPS's ./backups sits on the same disk as the
# data it protects, so this copy is the real disaster-recovery layer.
#
#   VPS=user@169.58.27.248 bash ops/offsite/pull-backups.sh
#
# Cron it (alert on non-zero exit — cron mails output by default, or wrap
# with your notifier of choice):
#
#   17 5 * * * VPS=user@<ip> bash /path/to/ops/offsite/pull-backups.sh >> ~/offsite-backup.log 2>&1
#
# Behavior:
#   - rsync-pulls the VPS backups/ tree into DEST (no --delete: the VPS's
#     14-day prune does NOT propagate here — ransomware or an accidental
#     wipe on the VPS can't eat the off-site copy)
#   - prunes the LOCAL copy on its own, longer retention
#   - exits non-zero when the newest pulled DB dump is older than
#     MAX_AGE_HOURS (backup pipeline broken) or the pull itself failed
#
# Tunables (env):
#   VPS                    user@host              (required)
#   VPS_PATH               remote backups path    (default photovideo360/backups/, relative to remote $HOME)
#   DEST                   local destination      (default ~/vps-backups)
#   SSH_PORT               ssh port               (default 22)
#   MAX_AGE_HOURS          freshness gate         (default 26)
#   LOCAL_RETENTION_DAYS   local dump retention   (default 60; uploads tars kept LOCAL_UPLOADS_KEEP=8)
set -euo pipefail

VPS="${VPS:?set VPS=user@host}"
VPS_PATH="${VPS_PATH:-photovideo360/backups/}"
DEST="${DEST:-$HOME/vps-backups}"
SSH_PORT="${SSH_PORT:-22}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-60}"
LOCAL_UPLOADS_KEEP="${LOCAL_UPLOADS_KEEP:-8}"

mkdir -p "$DEST"

echo "[offsite] $(date -u '+%Y-%m-%d %H:%M:%S') UTC — pulling $VPS:$VPS_PATH -> $DEST"
rsync -az -e "ssh -p $SSH_PORT" --exclude '*.part' "$VPS:$VPS_PATH" "$DEST/"

# Freshness gate: a successful pull of a stale tree is still an alert —
# it means the VPS-side nightly backup stopped producing dumps.
fresh="$(find "$DEST/mongo" -name 'db-*.archive.gz' -mmin -"$((MAX_AGE_HOURS * 60))" -print -quit 2>/dev/null || true)"
newest="$(ls -1t "$DEST"/mongo/db-*.archive.gz 2>/dev/null | head -1 || true)"

if [ -z "$newest" ]; then
  echo "[offsite] ALERT: no DB dumps present at all in $DEST/mongo" >&2
  exit 1
fi
if [ -z "$fresh" ]; then
  echo "[offsite] ALERT: newest dump older than ${MAX_AGE_HOURS}h — VPS backup pipeline broken?" >&2
  echo "[offsite]        newest: $newest" >&2
  exit 1
fi

# Local retention (longer than the VPS's, and independent of it).
find "$DEST/mongo" -name 'db-*.archive.gz' -mtime +"$LOCAL_RETENTION_DAYS" -delete 2>/dev/null || true
ls -1t "$DEST"/uploads/uploads-*.tar.gz 2>/dev/null | tail -n +"$((LOCAL_UPLOADS_KEEP + 1))" | xargs -r rm -f

echo "[offsite] OK — newest dump: $(basename "$newest") ($(du -h "$newest" | cut -f1)), local copy: $(du -sh "$DEST" | cut -f1)"
