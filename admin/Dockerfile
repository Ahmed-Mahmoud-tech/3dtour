# syntax=docker/dockerfile:1
#
# Admin dashboard (Vite SPA). Built to static files and served by nginx, which
# also reverse-proxies /api and /uploads to the API container.

# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The app reads VITE_API_URL with a "/api" fallback; nginx proxies that path,
# so relative URLs work without baking an origin into the bundle.
RUN npm run build     # → /app/dist

# ─── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
