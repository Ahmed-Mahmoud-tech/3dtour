#!/usr/bin/env bash
# Safe Docker disk housekeeping for the VPS. Reclaims the two things that
# actually grow on a pull-only host — old images and build cache — and
# NEVER touches volumes (uploads/mongo-data are the product) or containers.
#
#   bash ~/photovideo360/ops/maintenance/docker-prune.sh
#
# Cron weekly:
#   0 4 * * 1 bash ~/photovideo360/ops/maintenance/docker-prune.sh >> ~/docker-prune.log 2>&1
#
# Note on rollbacks: this removes local images (tagged or not) unused for
# PRUNE_UNTIL_HOURS (default 168h = 7 days). Rolling back to an older sha
# still works — the Deploy workflow re-pulls it from GHCR, which keeps
# every pushed tag.
set -euo pipefail

PRUNE_UNTIL_HOURS="${PRUNE_UNTIL_HOURS:-168}"

echo "== docker prune $(date -u '+%Y-%m-%d %H:%M:%S') UTC =="
echo "-- before --"
docker system df

echo "-- pruning unused images older than ${PRUNE_UNTIL_HOURS}h --"
docker image prune -af --filter "until=${PRUNE_UNTIL_HOURS}h"

echo "-- pruning build cache --"
docker builder prune -af

echo "-- after --"
docker system df
echo "== done =="
