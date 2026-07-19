# Production Server Cheat Sheet

Day-to-day command reference for the Gateverse / photovideo360 VPS.

**Stack:** Ubuntu VPS (Contabo) · Docker Compose · Node.js API · MongoDB 7 · GHCR + GitHub Actions · Uptime Kuma + Netdata

How the pipeline/backups/monitoring *work* is in [OPS.md](OPS.md); this file is the
"what do I type" companion. Unless noted, commands run **on the VPS** from the
stack directory (`~/photovideo360`).

Helper scripts referenced below live in [ops/](ops/) — see
[§7 Helper scripts](#7-helper-scripts).

---

## 1. Server & Process Management

| Command | What it does |
|---|---|
| `ssh <user>@<vps>` | Connect to the VPS (key-only auth — no passwords) |
| `ssh -L 3001:127.0.0.1:3001 -L 19999:127.0.0.1:19999 <user>@<vps>` | Tunnel to reach Kuma (3001) + Netdata (19999), which bind to localhost only |
| `htop` (or `top`) | Live CPU/RAM per process; in htop `F5` = tree view, `F9` = kill |
| `df -h` | Disk space per filesystem — **your #1 metric**: uploads + backups grow |
| `du -sh ~/photovideo360/backups/* /var/lib/docker` | See what's actually eating the disk |
| `free -h` | RAM + swap usage |
| `uptime` | Load averages (compare against your CPU core count) |
| `ss -tulpn` | All listening ports + which process owns them |
| `sudo systemctl status docker` | Is the Docker daemon healthy? |
| `sudo systemctl restart docker` | Restart Docker (restarts all containers — last resort) |
| `sudo journalctl -u docker -n 100 --no-pager` | Docker daemon logs |
| `sudo journalctl -b -p err --no-pager` | All system errors since last boot |
| `who` / `last` | Who is logged in / recent login history |
| `sudo reboot` | Reboot — containers restart automatically (`restart: unless-stopped`) |

> **Pro-Tips**
> - Run long operations inside `tmux` (`tmux new -s work`, reattach with
>   `tmux attach -t work`) so an SSH drop doesn't kill a restore or migration.
> - Load average > core count sustained = CPU-bound; check whether it's an
>   FFmpeg transcode (expected, transient) before blaming the app.
> - Set a disk alert in Netdata at **80%** — a full disk corrupts MongoDB
>   writes and breaks uploads silently.

---

## 2. Database Management (MongoDB — runs *inside* Docker)

All DB access goes through the `mongo` container; nothing is exposed on the host.

| Command | What it does |
|---|---|
| `docker compose -f docker-compose.prod.yml exec mongo mongosh photovideo360` | Open a Mongo shell on the production DB |
| `docker compose -f docker-compose.prod.yml exec mongo mongosh --quiet --eval "db.adminCommand('ping')"` | Connection check (same probe as the compose healthcheck) |
| In `mongosh`: `db.stats(1024*1024)` | DB size in MB |
| In `mongosh`: `db.projects.countDocuments()` | Quick sanity count (also `users`, `subscriptions`, `dailystats`) |
| In `mongosh`: `db.currentOp({ active: true, secs_running: { $gt: 3 } })` | Find slow/stuck queries |
| In `mongosh`: `db.serverStatus().connections` | Open connection count |
| `docker compose -f docker-compose.prod.yml run --rm backup bash /ops/backup.sh` | **Backup right now** (gzipped archive → `./backups/mongo/`) |
| `docker compose -f docker-compose.prod.yml run --rm backup bash /ops/restore.sh /backups/mongo/db-<stamp>.archive.gz` | **Restore DB** — ⚠️ drops and replaces existing collections |
| `docker compose -f docker-compose.prod.yml run --rm backup bash /ops/restore.sh --uploads /backups/uploads/uploads-<stamp>.tar.gz` | Restore uploaded media over the volume |
| `bash ops/backup/restore-drill.sh` | Prove the newest dump is restorable — restores into a throwaway container, never touches prod |
| `ls -lh ~/photovideo360/backups/mongo/` | Verify nightly dumps exist and are fresh (03:00 UTC, 14-day retention) |
| `docker compose -f docker-compose.prod.yml logs backup --tail 50` | Did last night's backup run cleanly? |

> **Pro-Tips**
> - **Always take a manual backup before a restore, migration script, or risky
>   change** — `bash /ops/backup.sh` takes seconds.
> - The backup loop writes to a `.part` file first, so any `*.part` file in
>   `backups/mongo/` means an in-progress or crashed dump — never restore from one.
> - A backup you've never restored is a hope, not a backup — run
>   `restore-drill.sh` after any change to the backup pipeline.
> - One-off repo scripts (`backfill-uploads.mjs`, etc.) run inside the server
>   container: `docker compose -f docker-compose.prod.yml exec server node scripts/backfill-uploads.mjs`.

---

## 3. Project / App Management (Docker stack)

Run everything from `~/photovideo360`.

| Command | What it does |
|---|---|
| `docker compose -f docker-compose.prod.yml ps` | Status of all 5 services (mongo, server, client, admin, backup) + health |
| `docker compose -f docker-compose.prod.yml logs -f server` | **Follow API logs live** (swap `server` for `client`/`admin`/`mongo`) |
| `docker compose -f docker-compose.prod.yml logs --tail 200 server` | Last 200 API log lines |
| `docker compose -f docker-compose.prod.yml logs --since 1h` | Everything from the last hour, all services |
| `docker compose -f docker-compose.prod.yml restart server` | Restart just the API |
| `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d` | Manual deploy of `:latest` images |
| `IMAGE_TAG=<git-sha> docker compose -f docker-compose.prod.yml up -d` | Pin the stack to a specific commit's images (manual rollback) |
| `docker compose -f docker-compose.prod.yml exec server sh` | Shell inside the API container |
| `docker compose -f docker-compose.prod.yml exec server env \| sort` | Inspect the env the API actually sees |
| `nano .env` then `docker compose -f docker-compose.prod.yml up -d` | Edit prod env (JWT_SECRET, SMTP_*, ALLOWED_ORIGINS) — picked up on `up -d`, **not** `restart` |
| `curl -s localhost:80/api/health` | Health check through the client proxy (the API port itself is not published — by design) |
| `bash ops/health.sh` | Full red/green health sweep: services, API, Mongo, disk, backup age |
| `docker stats --no-stream` | Per-container CPU/RAM snapshot |
| `docker inspect --format '{{.Config.Image}}' photovideo360-server-1` | Which image tag is a container actually running? |

**Legacy PM2 (old POC only — should stay off; it fights Docker for :80/:8080):**
`pm2 list` · `pm2 logs` · `pm2 delete all && pm2 save` · `sudo systemctl disable --now nginx`

> **Pro-Tips**
> - `restart` ≠ redeploy: `restart` reuses the same image and **does not**
>   reload `.env` changes. After editing `.env` or pulling images, use `up -d`.
> - Uploads and Mongo data live in named volumes (`uploads`, `mongo-data`) —
>   `docker compose down` is safe, but **never** `down -v` (the `-v` deletes
>   the volumes = all media + DB).
> - When the API misbehaves, check in this order: `ps` (restart loop?) →
>   `logs --tail 200 server` → `curl /api/health` → mongo ping.

---

## 4. CI/CD & Pipeline Troubleshooting (GitHub Actions → GHCR → VPS)

From your **local machine** with the `gh` CLI:

| Command | What it does |
|---|---|
| `gh run list --limit 10` | Recent workflow runs + status |
| `gh run list --workflow deploy.yml` | Deploy runs only |
| `gh run watch` | Live-follow the current run |
| `gh run view <run-id> --log-failed` | **Show only the failed step's logs** — fastest way to diagnose a red run |
| `gh run rerun <run-id> --failed` | Re-run just the failed jobs |
| `gh workflow run deploy.yml -f tag=<old-git-sha>` | **Rollback**: redeploy already-built images for an older commit (skips the build) |
| `gh secret list` | Confirm `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` exist |

On the **VPS**, when a deploy fails at the health gate:

| Command | What it does |
|---|---|
| `docker compose -f docker-compose.prod.yml logs --tail 100 server` | The deploy script dumps these on failure — the answer is usually here |
| `bash ops/deploy/remote-deploy.sh` | Re-run the deploy manually (needs `GHCR_USER`/`GHCR_TOKEN`/`IMAGE_TAG` env) |
| `docker login ghcr.io -u <github-user>` | Manual GHCR auth if a manual `pull` gets `denied` (use a PAT with `read:packages`) |
| `docker images \| grep 3dtour` | Which image tags are present locally |
| `groups` | Verify your user is in the `docker` group (if not: `sudo usermod -aG docker $USER` + re-login) |
| `ls -la ~/.ssh/ && cat ~/.ssh/authorized_keys` | Verify the CI deploy key is authorized; key files must be `600` |

> **Pro-Tips**
> - Deploy failures split cleanly in two: **before SSH** (build/GHCR push —
>   read `--log-failed` locally) vs **after SSH** (health gate — read server
>   logs on the VPS). Identify which half first.
> - The health gate waits 60 s for `/api/health`. If Mongo is slow to start
>   after a reboot, a deploy can fail spuriously — re-run the workflow before
>   digging deeper.
> - A rollback needs its target image on GHCR — GHCR keeps every pushed sha
>   tag, so any past commit sha on `master` is a valid rollback target.

---

## 5. Security

| Command | What it does |
|---|---|
| `sudo ufw status verbose` | Current firewall rules |
| `sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 8080/tcp && sudo ufw enable` | Baseline firewall (SSH + client + admin) |
| `sudo lastb -n 20` | Recent **failed** login attempts |
| `sudo journalctl -u ssh -n 100 --no-pager \| grep -i "failed\|invalid"` | Failed SSH auth in the journal |
| `sudo fail2ban-client status sshd` | Banned IPs (if fail2ban installed — `sudo apt install fail2ban`, sane defaults out of the box) |
| `sudo apt update && sudo apt list --upgradable` | See pending security updates |
| `sudo apt upgrade -y` | Apply them |
| `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades` | Auto-apply security patches |
| `sudo ss -tulpn \| grep -v 127.0.0.1` | **Audit what's actually reachable from the internet** |
| `sudo grep -E "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config` | Confirm password auth + root login are `no` |
| `docker compose -f docker-compose.prod.yml pull mongo` then `up -d` | Pick up patched base images (mongo:7 gets security fixes) |

> **Pro-Tips**
> - ⚠️ **Docker-published ports bypass UFW.** `ufw deny 8080` does *not* block
>   the admin app — Docker writes its own iptables rules. Control exposure in
>   the compose file (`127.0.0.1:8080:80` makes a port localhost-only), not in
>   UFW. This is exactly why Kuma/Netdata bind to `127.0.0.1`.
> - The API is already unpublished (browsers reach it via the client/admin
>   proxies) and Mongo has no host port — keep it that way; an
>   internet-exposed MongoDB gets ransomed within days.
> - After `apt upgrade` pulls a new kernel, `sudo reboot` during a quiet
>   window — containers come back on their own.

---

## 6. Monitoring, Backups & Housekeeping

| Command | What it does |
|---|---|
| `docker compose -f docker-compose.monitoring.yml up -d` | Start/refresh Uptime Kuma + Netdata |
| `docker compose -f docker-compose.monitoring.yml ps` | Are the monitors themselves up? |
| *(via SSH tunnel)* `http://localhost:3001` | Kuma — uptime alerts + public status page; monitor `http://<host>/`, `/api/health`, `:8080/` |
| *(via SSH tunnel)* `http://localhost:19999` | Netdata — live CPU/RAM/disk/per-container metrics |
| `docker system df` | Disk used by images / containers / volumes / build cache |
| `bash ops/maintenance/docker-prune.sh` | Safe disk housekeeping: old images + build cache only, never volumes |
| `find ~/photovideo360/backups -name "*.part"` | Detect crashed/incomplete backups |
| `bash ops/offsite/pull-backups.sh` *(from another machine)* | Pull `backups/` off the VPS + alert when the newest dump is stale |
| `docker compose -f docker-compose.prod.yml exec server ls uploads/videos \| head` | Spot-check the uploads volume contents |
| `curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://<host>/tour/<id>` | Response code + latency for a public tour |

> **Pro-Tips**
> - `./backups/` sits **on the same disk it protects** — a dead disk loses
>   both. Cron `ops/offsite/pull-backups.sh` on any other machine; it's the
>   single highest-value piece of the disaster-recovery story.
> - Never `docker volume prune` on this box — `uploads` and `mongo-data` are
>   the product.
> - Wire Kuma notifications (Telegram is the 2-minute option) so downtime
>   pings you instead of a customer.

---

## 7. Helper scripts

| Script | Runs where | What it does |
|---|---|---|
| [ops/health.sh](ops/health.sh) | VPS | One-shot red/green sweep: compose services, `/api/health`, Mongo ping, disk %, backup freshness. Exit 0 = all green (cron-able). |
| [ops/backup/restore-drill.sh](ops/backup/restore-drill.sh) | VPS | Restores the newest (or a given) dump into a **throwaway** Mongo container and counts documents — proves backups restore without touching prod. |
| [ops/offsite/pull-backups.sh](ops/offsite/pull-backups.sh) | **Another machine** | Rsync-pulls `backups/` from the VPS, keeps a longer local retention, exits non-zero when the newest dump is older than 26 h (cron + alert on failure). |
| [ops/maintenance/docker-prune.sh](ops/maintenance/docker-prune.sh) | VPS | Weekly-cron-safe prune of unused images (>7 days) + build cache. Never touches volumes or running containers. |

Suggested crons:

```bash
# On the VPS (crontab -e):
0 4 * * 1  bash ~/photovideo360/ops/maintenance/docker-prune.sh >> ~/docker-prune.log 2>&1
0 7 * * *  bash ~/photovideo360/ops/health.sh >> ~/health.log 2>&1

# On any OTHER machine (laptop, second server):
17 5 * * * VPS=<user>@<vps-ip> bash /path/to/ops/offsite/pull-backups.sh >> ~/offsite-backup.log 2>&1
```
