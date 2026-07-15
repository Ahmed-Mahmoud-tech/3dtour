# Running with Docker

The whole platform (MongoDB, API, Next.js client, admin dashboard) runs from a
single `docker compose` command. FFmpeg and the self-hosted static tour player
are baked into the server image — no host dependencies beyond Docker.

## Quick start

```bash
cp .env.docker.example .env
# edit .env and set JWT_SECRET (required)

docker compose up -d --build
```

| Service | URL | Notes |
|---|---|---|
| Client (landing / tour viewer / owner dashboard) | http://localhost:5173 | Next.js; proxies `/api` + `/uploads` to the API |
| Admin dashboard | http://localhost:5174 | Vite SPA served by nginx (proxies `/api` + `/uploads`) |
| API | http://localhost:5000/api/health | exposed for convenience; remove the port mapping to keep it internal |

The first run registers the bootstrap admin: `POST /api/auth/register` works only
while the users collection is empty (see CLAUDE.md).

## Services

- **mongo** — `mongo:7`, data persisted in the `mongo-data` volume.
- **server** — Node + FFmpeg + sharp on Debian slim. Uploaded media persists in
  the `uploads` volume (`/app/uploads`). `STATIC_PLAYER_DIR` points at the Vite
  static player baked in at build time, so the admin "export tour" zip works.
- **client** — `next start` (a real Node server, not a static export) so its
  `rewrites()` can reverse-proxy the API via `SERVER_ORIGIN=http://server:5000`.
- **admin** — built to static assets, served by nginx with `client_max_body_size`
  lifted so large panorama/video uploads pass through.

## Common commands

```bash
docker compose up -d --build      # build + start
docker compose logs -f server     # tail API logs
docker compose down               # stop (keeps volumes/data)
docker compose down -v            # stop AND delete DB + uploaded media
docker compose build server       # rebuild one service
```

## Notes

- Secrets come from `.env` via compose substitution and are injected as
  environment variables at runtime — `.env` is never copied into an image.
- In production behind a real domain, set `ALLOWED_ORIGINS` and put the client
  and admin behind HTTPS (a reverse proxy / load balancer terminating TLS).
- To re-bake speed ramps or run other server scripts inside the container:
  `docker compose exec server node scripts/bake-speed-ramps.mjs --force`.
