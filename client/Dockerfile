# syntax=docker/dockerfile:1
#
# Next.js client (landing + hosted tour viewer + owner dashboard). Runs as a
# real Node server via `next start` — NOT a static export — so its rewrites()
# can proxy /api and /uploads to the API (SERVER_ORIGIN, set in compose).

# ─── Stage 1: install all deps (build needs tailwind/postcss devDeps) ─────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build fetches next/font at build time — Docker build has network access.
RUN npm run build

# ─── Stage 3: production deps only (smaller runtime node_modules) ─────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 4: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5173
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/.next        ./.next
COPY --from=builder   /app/public       ./public
COPY package.json next.config.mjs ./
EXPOSE 5173
CMD ["npm", "run", "start"]
