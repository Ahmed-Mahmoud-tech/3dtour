#!/usr/bin/env bash
# Runs ON the VPS, piped over SSH by .github/workflows/deploy.yml.
# Expects env: DEPLOY_PATH, GHCR_USER, GHCR_TOKEN, IMAGE_TAG.
# Pulls the freshly pushed images, rolls the stack, and fails the deploy
# (non-zero exit) if the API doesn't come back healthy.
set -euo pipefail

cd "${DEPLOY_PATH:-$HOME/photovideo360}"

if [ ! -f .env ]; then
  echo "ERROR: no .env in $(pwd) — copy .env.docker.example to .env and set JWT_SECRET (see OPS.md)." >&2
  exit 1
fi

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

compose() {
  IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml "$@"
}

echo "==> Pulling images (tag: $IMAGE_TAG)"
compose pull --quiet

echo "==> Rolling the stack"
compose up -d --remove-orphans

echo "==> Waiting for the API health check"
for _ in $(seq 1 30); do
  if compose exec -T server wget -qO- http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    echo "==> API healthy — deploy OK"
    docker image prune -f >/dev/null
    compose ps
    exit 0
  fi
  sleep 2
done

echo "ERROR: API failed its health check after 60s — recent server logs:" >&2
compose logs --tail 50 server >&2
exit 1
