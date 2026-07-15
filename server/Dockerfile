# syntax=docker/dockerfile:1
#
# Server image. Build context is the REPO ROOT (see docker-compose.yml) so the
# first stage can compile the client's self-hosted static tour player, which the
# admin "export tour" feature zips up (STATIC_PLAYER_DIR points at it).

# ─── Stage 1: build the Vite static tour player (client/dist-static) ──────────
FROM node:20-alpine AS static-player
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build:static     # → /build/dist-static

# ─── Stage 2: runtime (Node + FFmpeg + sharp) ────────────────────────────────
# Debian slim so FFmpeg installs cleanly from apt and sharp uses its prebuilt
# linux binaries without a compile toolchain.
FROM node:20-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    STATIC_PLAYER_DIR=/app/static-player

# Production deps only. mongodb-memory-server is a devDependency and is never
# imported when NODE_ENV=production, so --omit=dev is safe.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./

# Bake in the prebuilt static player for the export zip.
COPY --from=static-player /build/dist-static ./static-player

# Uploads live on a mounted volume; create the dir so static serving works even
# before the first upload.
RUN mkdir -p uploads

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "src/index.js"]
