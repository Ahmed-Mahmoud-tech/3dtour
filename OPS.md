# Operations: CI/CD, backups, monitoring

How the platform is built, shipped, backed up, and watched. Local/dev Docker
usage is in [DOCKER.md](DOCKER.md).

## Overview

| Piece | Where | What it does |
|---|---|---|
| CI | [.github/workflows/ci.yml](.github/workflows/ci.yml) | Builds all three Docker images on every PR (no tests exist — the image build is the gate) |
| CD | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | On push to `master`: pushes images to GHCR, then rolls the VPS stack over SSH with a health gate |
| Prod stack | [docker-compose.prod.yml](docker-compose.prod.yml) | GHCR images (no builds on the VPS); client :80, admin :8080, API internal-only |
| Backups | [ops/backup/](ops/backup/) + `backup` service | Nightly `mongodump` (14-day retention) + weekly uploads tar (keep 4) → `./backups/` |
| Monitoring | [docker-compose.monitoring.yml](docker-compose.monitoring.yml) | Uptime Kuma (alerts, status page) + Netdata (host/container metrics) |

## CI/CD

### Pipeline

1. **PR opened** → `ci.yml` builds `server`, `client`, `admin` images (matrix,
   buildx cache). A red build blocks the merge.
2. **Push to `master`** → `deploy.yml`:
   - builds and pushes `ghcr.io/ahmed-mahmoud-tech/3dtour/{server,client,admin}`
     tagged `:latest` **and** `:<git sha>`;
   - rsyncs `docker-compose.prod.yml`, `docker-compose.monitoring.yml`, and
     `ops/` to the VPS;
   - runs [ops/deploy/remote-deploy.sh](ops/deploy/remote-deploy.sh) there:
     `docker login` (short-lived CI token) → `pull` → `up -d --remove-orphans`
     → waits up to 60 s for `/api/health` → prunes old images. A failed health
     check fails the workflow and dumps the server logs.
3. **Rollback**: run the *Deploy* workflow manually (Actions → Deploy → Run
   workflow) with `tag` = an older commit sha. That skips the build and
   redeploys the already-pushed images for that commit.

Until the deploy secrets exist, pushes to `master` still publish images; the
deploy step just logs a warning and skips — nothing fails.

### Required GitHub secrets (repo → Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VPS IP (e.g. `169.58.27.248`) |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private key (full OpenSSH file content) whose public half is in the VPS `authorized_keys` |
| `DEPLOY_PORT` | *(optional)* SSH port, default 22 |
| `DEPLOY_PATH` | *(optional)* stack directory on the VPS, default `~/photovideo360` |

Tip: create a dedicated key for CI rather than reusing a personal one:
`ssh-keygen -t ed25519 -f deploy_key -N "" -C github-actions`.

### One-time VPS setup

```bash
# 1. Docker Engine + compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login afterwards

# 2. Stack directory + env
mkdir -p ~/photovideo360 && cd ~/photovideo360
# after the first deploy run has rsynced the files (or scp them yourself):
cp .env.docker.example .env
nano .env                        # set JWT_SECRET (required), SMTP_*, ALLOWED_ORIGINS

# 3. Free the ports. The old PM2 + host-nginx setup owns :80/:8080 — stop it
#    before the first docker deploy:
pm2 delete all && pm2 save
sudo systemctl disable --now nginx
```

Then push to `master` (or run the Deploy workflow manually) and check
`docker compose -f docker-compose.prod.yml ps` on the VPS. The first fresh-DB
run accepts one bootstrap `POST /api/auth/register` to create the admin user.

**Migrating existing data from the PM2 install**: before switching over, dump
and copy into the new stack — `mongodump --db photovideo360 --gzip
--archive=old.gz`, copy `server/uploads/` into the `uploads` volume
(`docker cp` or a bind-mount rsync), then restore the dump with
`ops/backup/restore.sh` (below).

## Database backups

The `backup` compose service (in both compose files; dev needs
`--profile backup`) runs [ops/backup/backup-loop.sh](ops/backup/backup-loop.sh):

- **Nightly at 03:00 UTC** (`BACKUP_HOUR_UTC`): `mongodump --gzip --archive` →
  `./backups/mongo/db-<stamp>.archive.gz`. Dumps older than
  `BACKUP_RETENTION_DAYS` (14) are pruned. Dumps write to a `.part` file first,
  so a crash never leaves a truncated file that looks like a backup.
- **Weekly (Sundays)** + on first ever run: tars the uploads volume →
  `./backups/uploads/uploads-<stamp>.tar.gz`, keeping the newest `UPLOADS_KEEP`
  (4). Uploads include `_originals` (the permanent media masters), so don't
  disable this (`BACKUP_UPLOADS=0`) unless you back the volume up some other way.
- **On container start**: if no dump from the last 24 h exists, one runs
  immediately — a box that was down over the schedule catches up by itself.

Manual run / restore (drop `-f docker-compose.prod.yml` in dev):

```bash
# back up right now
docker compose -f docker-compose.prod.yml run --rm backup bash /ops/backup.sh

# restore the DB (DROPS and replaces existing collections!)
docker compose -f docker-compose.prod.yml run --rm backup \
  bash /ops/restore.sh /backups/mongo/db-2026-07-17_030000.archive.gz

# restore uploaded media (extracts over the volume, overwriting)
docker compose -f docker-compose.prod.yml run --rm backup \
  bash /ops/restore.sh --uploads /backups/uploads/uploads-2026-07-13_030000.tar.gz
```

`./backups/` lives on the same disk as the data it protects. For real disaster
recovery, sync it off the box — e.g. `rclone` to any object storage, or a cron
on another machine doing `rsync -az vps:~/photovideo360/backups/ ./`. Do this
before relying on the system; test a restore once, too.

## Monitoring

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

- **Uptime Kuma** (port 3001) — is the site up, from the outside? Create an
  account on first visit, then add HTTP monitors for `http://<host>/`,
  `http://<host>/api/health` (the client proxies `/api`), and
  `http://<host>:8080/`. Wire notifications (email/Telegram/Discord) in its UI;
  it can also publish a public status page.
- **Netdata** (port 19999) — zero-config CPU/RAM/disk/network plus
  per-container metrics (it reads the mounted Docker socket). Watch disk space
  especially: uploads + backups grow.

Both bind to **127.0.0.1 only** by default, because Netdata has no auth and
Docker's published ports bypass ufw. View them through an SSH tunnel:

```bash
ssh -L 3001:127.0.0.1:3001 -L 19999:127.0.0.1:19999 <user>@<vps>
# → http://localhost:3001  (Kuma)   http://localhost:19999  (Netdata)
```

Set `MONITOR_BIND=0.0.0.0` in `.env` to expose them publicly — only behind
TLS/auth. Kuma's own alerting works fine from behind the localhost bind.

If Grafana-grade dashboards are ever needed, the upgrade path is
Prometheus + Grafana + mongodb_exporter — deliberately not included here;
Netdata covers a single-VPS deployment with zero configuration.
