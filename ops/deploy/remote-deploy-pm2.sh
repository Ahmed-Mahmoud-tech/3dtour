#!/usr/bin/env bash
# Runs ON the VPS, piped over SSH by .github/workflows/deploy.yml.
# PM2/nginx deploy path (the VPS is not on the Docker stack yet — when it
# migrates, switch the workflow back to remote-deploy.sh).
#
# Expects env: SHA (git commit being deployed).
# Expects the source tarball already uploaded to /tmp/deploy-$SHA.tar.gz
# (git archive of the repo — no node_modules, no uploads, no .env).
#
# Strategy: build everything in a sibling dir while PM2 keeps serving the
# old tree, then swap (two renames), restart PM2, and health-check. If the
# health check fails, swap back and exit non-zero so the workflow goes red.
set -euo pipefail

APP=/var/www/photovideo360
NEW=$APP-new
PREV=$APP-prev
DATA=/var/www/photovideo360-data
TARBALL=/tmp/deploy-$SHA.tar.gz

[ -f "$TARBALL" ] || { echo "ERROR: $TARBALL not found" >&2; exit 1; }
[ -f "$APP/server/.env" ] || { echo "ERROR: no live server/.env to carry over" >&2; exit 1; }

echo "==> Extracting $SHA"
rm -rf "$NEW"
mkdir -p "$NEW"
tar -xzf "$TARBALL" -C "$NEW"

echo "==> Carrying over runtime state"
cp "$APP/server/.env" "$NEW/server/.env"
[ -f "$APP/ecosystem.config.cjs" ] && cp "$APP/ecosystem.config.cjs" "$NEW/ecosystem.config.cjs"

# Uploads live OUTSIDE the app tree so deploys never copy media.
# Self-bootstrap: first run moves the real dir out and leaves a symlink.
mkdir -p "$DATA"
if [ ! -d "$DATA/uploads" ]; then
  if [ -d "$APP/server/uploads" ] && [ ! -L "$APP/server/uploads" ]; then
    echo "==> Bootstrapping: moving uploads to $DATA/uploads"
    mv "$APP/server/uploads" "$DATA/uploads"
    ln -s "$DATA/uploads" "$APP/server/uploads"
  else
    mkdir -p "$DATA/uploads"
  fi
fi
ln -sfn "$DATA/uploads" "$NEW/server/uploads"

# Reuse the live node_modules so npm install only applies the delta.
for p in server client admin; do
  if [ -d "$APP/$p/node_modules" ]; then
    cp -a "$APP/$p/node_modules" "$NEW/$p/node_modules"
  fi
done

echo "==> Installing dependencies"
(cd "$NEW/server" && npm install --no-audit --no-fund)
(cd "$NEW/client" && npm install --no-audit --no-fund)
(cd "$NEW/admin" && npm install --no-audit --no-fund)

echo "==> Building client (.next), static player, admin"
(cd "$NEW/client" && npm run build && npm run build:static)
(cd "$NEW/admin" && npm run build)

echo "==> Swapping in the new tree"
rm -rf "$PREV"
mv "$APP" "$PREV"
mv "$NEW" "$APP"
pm2 restart api client --update-env

echo "==> Waiting for health checks"
healthy=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:5000/api/health &&
     curl -fsS -o /dev/null http://127.0.0.1:5173/; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" != 1 ]; then
  echo "ERROR: health check failed after 60s — rolling back to previous tree" >&2
  pm2 logs api --lines 30 --nostream >&2 || true
  mv "$APP" "$APP-failed-$SHA"
  mv "$PREV" "$APP"
  pm2 restart api client --update-env
  exit 1
fi

echo "$SHA" > "$APP/DEPLOYED_SHA"
rm -f "$TARBALL"
echo "==> Deployed $SHA OK"
pm2 list
