# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A 360° virtual tour platform built as three independent npm packages that share no code (utilities like `coordUtils.js` are **duplicated** between `client/` and `admin/`, not imported):

- **`server/`** — Node.js + Express + MongoDB API (ES modules, `"type": "module"`)
- **`client/`** — **Next.js 14 (App Router)** app on port 5173: the Gateverse marketing landing (`/` EN + `/ar` AR, statically prerendered for SEO), the user-facing tour viewer (`/tour/[projectId]`), and the tour-owner dashboard (`/dashboard/[tourId]`). Also carries a **secondary Vite build** that produces only the self-hosted static tour player (see Static export). Converted from Vite+react-router 2026-07-14; the former separate `landing/` Next package was merged in at the same time.
- **`admin/`** — React + Three.js admin dashboard with a 3D placement studio (Vite, port 5174)

Each has its own `package.json`; run `npm install` separately in each.

## Commands

All commands run from the respective package directory.

```bash
# server (requires MongoDB running + .env with MONGO_URI and JWT_SECRET; FFmpeg on PATH or FFMPEG_PATH set)
cd server && npm install && npm run dev     # nodemon, http://localhost:5000
npm start                                    # production (plain node)

# client (Next.js)
npm run dev            # next dev, http://localhost:5173
npm run build          # next build (landing pages prerendered; needs internet for next/font)
npm start              # next start -p 5173 (production; Node server, NOT a static export)
npm run build:static   # Vite build of the self-hosted tour player → client/dist-static/ (required before admin tour export works)

# admin
npm run dev        # vite dev server, port 5174
npm run build      # production build to dist/
npm run preview    # preview the build
```

There is **no test runner, linter, or formatter configured** in any package — no `test`/`lint` scripts exist. `mongodb-memory-server` is a server devDependency but is not wired to any script.

### Docker & ops

The full stack is dockerized: dev via [docker-compose.yml](docker-compose.yml) (see [DOCKER.md](DOCKER.md)), production via [docker-compose.prod.yml](docker-compose.prod.yml) with prebuilt GHCR images. CI builds all three images on PRs ([.github/workflows/ci.yml](.github/workflows/ci.yml)); pushes to `master` publish images and deploy to the VPS over SSH with a health gate ([.github/workflows/deploy.yml](.github/workflows/deploy.yml) → [ops/deploy/remote-deploy.sh](ops/deploy/remote-deploy.sh)). A `backup` compose service does nightly `mongodump` + weekly uploads tars with retention ([ops/backup/](ops/backup/)); monitoring (Uptime Kuma + Netdata) is [docker-compose.monitoring.yml](docker-compose.monitoring.yml). Runbook: [OPS.md](OPS.md). The server Dockerfile builds from the **repo root** context (it compiles the client static player); client/admin build from their own directories — so client/ and admin/ each have their own `.dockerignore`, and `nginx.conf` must stay OUT of admin's.

Both frontends proxy `/api` and `/uploads` to `http://localhost:5000`, so the server must be running for either to function: the client via Next `rewrites()` in [client/next.config.mjs](client/next.config.mjs) (target overridable with `SERVER_ORIGIN`; Range requests pass through, verified for video streaming), the admin via the Vite dev proxy. The admin reads `import.meta.env.VITE_API_URL`; the client reads `process.env.NEXT_PUBLIC_API_URL`. Both fall back to `/api`.

## Architecture

### Data model — the whole tour is one Project document

A `Project` ([server/src/models/Project.js](server/src/models/Project.js)) is a single deeply-nested MongoDB document holding the entire tour. Key structural decisions:

- `nodes` and `transitions` are Mongoose **`Map`** fields keyed by dynamic string IDs (e.g. `node_ab12...`). The schema's `toJSON` transform converts these Maps to plain objects, so the API always returns/accepts `{ nodes: { node_x: {...} } }`, not arrays.
- A **node** = one panorama sphere with `navigationHotspots` (links to other nodes, optionally via transition video) and `infoSigns` (clickable popups).
- IDs are generated server-side with `uuid` (`node_`, `nav_`, `sign_` prefixes — see helpers in [projectController.js](server/src/controllers/projectController.js)).
- When mutating nested Map/array data in a controller, you must call `project.markModified('nodes')` before `save()` (Mongoose can't auto-detect deep Map mutations).

### Roles, subscriptions & multi-tenancy (SaaS layer, added 2026-07)

- `User.role` is `admin` (the platform operator, uses the admin app), `owner` (a client who bought a tour; analytics dashboard + own-password change only), or `employee` (staff: logs into the admin app but only sees/edits projects assigned to them — no create/delete/export, no admin routes). `POST /api/auth/register` is **bootstrap-only** — it creates the first admin when the users collection is empty, then returns 403 forever; owners are created via `POST /api/admin/owners` with `mustChangePassword: true`, employees via `POST /api/admin/employees`.
- `Project.owner` = the assigned client (set via `PUT /api/admin/projects/:id/assign`); `Project.assignedTo` = the assigned employee (set via `PUT /api/admin/projects/:id/assign-employee`); `Project.createdBy` stays the admin who built it. Dashboard access checks `owner`; studio scoping (`scopeFilter` in [projectController.js](server/src/controllers/projectController.js)) checks `createdBy` for admins and `assignedTo` for employees.
- Employees are managed on the admin app's `/employees` page ([EmployeesPage.jsx](admin/src/pages/EmployeesPage.jsx)); `/clients` and `/employees` routes are `adminOnly` in [ProtectedRoute](admin/src/components/Auth/ProtectedRoute.jsx), and the admin AuthContext accepts `admin` + `employee` logins.
- One [Subscription](server/src/models/Subscription.js) doc **per PROJECT** (`project` unique ref — an owner with several tours pays per tour; changed 2026-07-14 from per-owner, see [scripts/migrate-subscriptions-per-project.mjs](server/scripts/migrate-subscriptions-per-project.mjs)). `monthly`/`yearly`; `expiresAt` is the source of truth, `status` is display; `history[]` audit trail. Admin manages it via `POST/PUT /api/admin/projects/:id/subscription` and per-tour controls on the Clients page. Under the default `expiry.mode: 'subscription'`, an owner-assigned tour is served while its own subscription is active **plus a 3-month grace**; no subscription record or a canceled one blocks (`GET /:id/public` → 403 `reason: 'subscription_expired'`) — tours with `owner: null` are never gated. The owner's dashboard keeps working while expired. Deleting a project deletes its subscription; deleting an owner does NOT (subs stay with their projects).

### API surface

- **Auth** ([routes/auth.js](server/src/routes/auth.js)): `/api/auth/register` (bootstrap-only, see above; gated by `countDocuments`), `/login`, `/me`, `PUT /password` (self-service change, clears `mustChangePassword`). JWT bearer tokens, bcrypt passwords. `protect` ([middleware/auth.js](server/src/middleware/auth.js)) sets `req.user`, rejects suspended accounts, **and rejects any token minted before the user's `passwordChangedAt`** — so a password change/reset kills existing sessions immediately. Because of that, `PUT /password` returns a fresh `token` in its response (the frontends swap it in: admin via `AuthContext.adoptToken`, owner dashboard rewrites `owner_token`). `adminOnly` guards admin routes; `requireRole(...roles)` guards role-restricted ones.
- **Projects** ([routes/projects.js](server/src/routes/projects.js)): `GET /:id/public` is the only public project route (the viewer uses it) and is **subscription-gated**; the studio reads via protected `GET /:id`. Everything else is behind `router.use(protect)`. **All studio reads/writes — including `GET /:id` — are scoped by `scopeFilter` (admins → `createdBy`, employees → `assignedTo`, any other role → matches nothing), so an owner-role token can never read an arbitrary project here.** `POST /` and `DELETE /:id` additionally require `requireRole('admin')` at the route. The list route takes `?q` (title search, regex-escaped), `?page&limit` (returns `{ items, total, page, pages }`; **without `page` it returns the legacy plain array**), and `?noOwner=1` / `?noEmployee=1` (unassigned-only, used by the admin assign pickers). Nested CRUD routes exist per node / hotspot / sign / transition.
- **Admin** ([routes/admin.js](server/src/routes/admin.js), all `protect + adminOnly`): owner CRUD, password reset, per-project subscription create/renew/cancel (`/projects/:id/subscription`), tour assignment, and `GET /projects/:id/export` (self-hosted zip — see Static export below). `GET /owners` and `GET /employees` take `?q` (name/email search) and `?page&limit` with the same paginated-or-legacy-array convention as the projects list. The admin app's shared list UI (debounced `SearchInput`, `Pager`, searchable `AssignPicker`) lives in [ListControls.jsx](admin/src/components/ui/ListControls.jsx). Also `/notifications` (list `?page&limit&unread=1` → `{ items, total, unread, page, pages }`; `PUT /:id/read`, `PUT /read-all`, `DELETE /:id`) backing the header bell in [NotificationBell.jsx](admin/src/components/ui/NotificationBell.jsx) — see Subscription reminders below.
- **Analytics** ([routes/analytics.js](server/src/routes/analytics.js)): public `POST /collect`, rate-limited, parses `text/plain` as JSON because `navigator.sendBeacon` can't send `application/json` without a preflight.
- **Dashboard** ([routes/dashboard.js](server/src/routes/dashboard.js)): `GET /:tourId`, `/:tourId/sessions` (paginated: `?page&limit` → `{ items, total, page, pages }`), and the visitor-message inbox (`GET /:tourId/messages?page&limit&q` — `q` searches sender name/email/body but the `unread` count stays global; `PUT .../messages/:id/read`, `DELETE .../messages/:id` — all scoped to the tour, message id alone is never trusted), behind `protect` + `canAccessTour` (assigned owner or any admin — the URL is never trusted). Admins reach an owner dashboard from the admin app's Clients page: the link carries the admin JWT as `#token=...` and [DashboardPage.jsx](client/src/views/DashboardPage.jsx) consumes the hash on mount (stores it as `owner_token`, strips it from the URL — the hash never reaches a server).
- **Messages** ([routes/messages.js](server/src/routes/messages.js)): public `POST /:tourId` — a visitor leaves a message for the tour owner (stored in the separate [Message](server/src/models/Message.js) collection, never on the Project). Rate-limited 3/min per IP with `skipFailedRequests: true` so validation failures don't consume quota. The viewer form ([MessageForm.jsx](client/src/components/Popup/MessageForm.jsx)) is hidden in static exports (no API).
- **Media** ([routes/media.js](server/src/routes/media.js)): uploads for panorama/audio/image/video are `protect + requireRole('admin','employee')` — **owners never upload**; the `video/:projectId` route additionally checks the caller may edit that project (`scopeFilter`) before Multer writes to disk. Multer size/type rejections are surfaced as **400** (not a masked 500) via the `runUpload` wrapper. Public `GET /stream/:folder/:filename` (HTTP Range support).
- **Errors & async**: every async controller is wrapped in `asyncHandler` ([utils/asyncHandler.js](server/src/utils/asyncHandler.js)) so rejections reach the **single global error handler** in [index.js](server/src/index.js) — controllers no longer hand-roll `try/catch`, and **must not** return `err.message` themselves (the handler masks 500s to `'Internal server error'`, maps Mongoose `CastError`→400 and `ValidationError`→400). Any code that turns a stored `/uploads/...` URL back into a filesystem path **must** go through `safeUploadPath` ([utils/uploadPaths.js](server/src/utils/uploadPaths.js)) — it's the shared traversal guard used by file deletion (projectController) and the export rewriter.

### Analytics pipeline (never touches the Project document)

Three collections, all in [server/src/models](server/src/models): **AnalyticsEvent** (raw insert-only events, TTL 90 days, used only for per-session path replay), **DailyStat** (one doc per tour per day, maintained with `$inc` upserts on Map fields keyed by node/hotspot/sign id and `from>to` transition edges — the dashboard reads exclusively from this), and **Visitor** (dedup ledger: unique compound index on `{tourId, visitorId, date}` makes "new visitor today?" a race-free insert). Client side, [useAnalytics](client/src/hooks/useAnalytics.js) queues events and flushes every 10 s + on tab hide via sendBeacon; `scene_view.targetId` carries the *previous* node id, which is how navigation edges are counted. Analytics failures must stay silent — the collect endpoint even errors as 204.

### Subscription reminders & admin notifications

An hourly job ([jobs/subscriptionReminders.js](server/src/jobs/subscriptionReminders.js), started from index.js) sweeps active subscriptions expiring within 7 days: it emails the project's owner (thresholds 7d / 1d / expired — only the **most urgent** unsent one fires; every crossed key is recorded in `Subscription.remindersSent`, which renew/reactivate reset) and creates a [Notification](server/src/models/Notification.js) for the admin team (global read state, not per admin; TTL 90 days). Email goes through [utils/mailer.js](server/src/utils/mailer.js) (nodemailer): disabled unless `SMTP_USER`+`SMTP_PASS` are set (then reminders still create notifications); the From address defaults to `ahmedmahmoudtech@gmail.com` in dev and `contact@gateverse.tech` when `NODE_ENV=production`, overridable via `EMAIL_FROM`. Expiries older than 14 days are marked sent silently (no backfill spam on first deploy).

### Static export (admin-only)

`GET /api/admin/projects/:id/export` ([exportController.js](server/src/controllers/exportController.js)) streams a zip: the prebuilt static player (`client/dist-static`, from `npm run build:static`; override dir with `STATIC_PLAYER_DIR`) + `tour.json` (all `/uploads/...` URLs rewritten to relative `media/...`) + the media files. **The URL→file rewrite goes through `safeUploadPath`, so a maliciously-stored URL like `/uploads/../.env` can neither read outside `uploads/` nor produce a zip-slip entry** (this was a real hole — don't reintroduce a raw `path.join(UPLOADS_ROOT, rel)`). `tour.json` strips `createdBy`/`owner`/`assignedTo`/`_id`/`__v`. The static player is the ONLY thing still built with Vite — Next.js can't emit relative asset paths, and the export zip must run from any sub-path on any static host. Its entry is [client/src/main.jsx](client/src/main.jsx) (renders `TourPage` directly, no router) and [client/vite.config.js](client/vite.config.js) `define`s `process.env.NEXT_PUBLIC_STATIC_TOUR = "1"`, which makes `useTour` fetch `./tour.json` and compiles out analytics + the message form. Note: `archiver` v8 has **no default export** — `import { ZipArchive } from 'archiver'`.

### Media pipeline

- Uploads go to `server/uploads/{panoramas,videos,audio,images}/` via Multer disk storage ([middleware/upload.js](server/src/middleware/upload.js)). `setUploadDir(dir)` middleware sets `req.uploadDir` before Multer runs. `uploads/` is gitignored. Files are served statically at `/uploads/...`.
- **Transition-video upload** ([mediaController.js](server/src/controllers/mediaController.js) `uploadTransitionVideo`): the server responds immediately with the video URL, then shrinks the clip in place **asynchronously in the background** (same filename, so the returned URL stays valid). The camera master is archived in `uploads/_originals` before the lossy transcode — never delete that directory. (The reverse-video/`playMode: "backward"` system was removed 2026-07-17: clips only play forward as filmed; [scripts/remove-reverse-videos.mjs](server/scripts/remove-reverse-videos.mjs) purged the old DB fields and `*_reversed` files.)

### Coordinate system (client ↔ admin ↔ server all agree on this)

Hotspot/sign positions are stored as `position2D: { x_deg, y_deg }` in degrees (0–360). `x_deg` = azimuth, `y_deg` = polar (0°=top, 90°≈eye level, 180°=floor). Conversion math lives in `coordUtils.js` (duplicated in [client](client/src/utils/coordUtils.js) and [admin](admin/src/utils/coordUtils.js) — **keep both in sync**). Sphere radius is hardcoded `R = 50`; the sphere is rendered inside-out (`BackSide`), which is why X and Z are negated. The admin studio raycasts clicks on the sphere and uses `cartesianToDeg` to capture placement coordinates.

### Client app layout (Next.js)

Routes live in [client/app/](client/app/): `/` + `/ar` are server-prerendered landing pages (metadata + LocalBusiness JSON-LD; copy in [content.js](client/src/landing/content.js), UI in [LandingView.jsx](client/src/landing/LandingView.jsx)); `/tour/[projectId]` and `/dashboard/[tourId]` are thin server pages whose `*Client.jsx` wrappers `next/dynamic`-import the real screens with `ssr: false` (WebGL + localStorage — never SSR them). The screens themselves live in `client/src/views/` — **the directory must NOT be named `src/pages`** or Next's pages router claims it and the build breaks. Shared viewer code reads `process.env.NEXT_PUBLIC_*` so the same files compile under both Next (inlined) and the Vite static build (`define` in vite.config.js). Full-height surfaces are per-route (`h-dvh` wrappers) — don't put `height: 100%` on html/body; the landing needs normal scrolling.

### Client viewer

`useTour` ([client/src/hooks/useTour.js](client/src/hooks/useTour.js)) is the central state machine: fetches the project, tracks `activeNodeId`, drives the transition lifecycle (including a **sequential multi-video queue** — `transitionVideos` array on a hotspot plays in `order`), background audio (with autoplay-unlock on first click), and hides hotspots/signs during transitions. Rendering is React-Three-Fiber inside `SphereViewer`. `useSmartPreloader` background-loads neighbor panoramas by proximity (5s after the user settles).

The client app also hosts the **tour-owner dashboard** at `/dashboard/:tourId` ([DashboardPage.jsx](client/src/views/DashboardPage.jsx), loaded client-only via `next/dynamic`): renders a login form when logged out, forces a password change when `mustChangePassword`, then shows analytics + subscription + a paginated visitor-messages inbox (unread badge, mark read/unread, delete). Recent visits are paginated server-side; the engagement `BarList`s paginate client-side (8/page, bars scaled to the global max so later pages aren't misleading). Its chart series colors (`#0d9488`, `#8b5cf6`) were validated for contrast/CVD on the dark surface — don't casually swap them for lighter Tailwind steps.

### Dynamic icons & sanitized HTML

- Icons are stored as name strings (e.g. `"FaInfoCircle"`) and resolved at runtime via prefix lookup against `react-icons` bundles — see [client/src/utils/iconCompiler.jsx](client/src/utils/iconCompiler.jsx) and the admin `IconPicker`.
- Info-sign popup `htmlContent` is user-authored HTML, sanitized with **DOMPurify** before rendering ([client InfoPopup](client/src/components/Popup/InfoPopup.jsx)). Preserve this — it's the XSS boundary.

## Gotchas

- Auth login/register are rate-limited (10 failed attempts / 15 min per IP); `listOwners`/`listEmployees` use `.lean()` which bypasses the User model's password-stripping `toJSON` — any new `.lean()` User query must add `.select('-password')`.
- `safeUploadPath` ([utils/uploadPaths.js](server/src/utils/uploadPaths.js)) is the ONE place that resolves a `/uploads/...` URL to a filesystem path with a traversal guard — `deleteUploadByUrl` (projectController) and the export rewriter both use it. `UPLOADS_ROOT` is exported from there too; don't re-derive it or hand-roll the prefix check.
- The `/api/analytics` router is mounted **before** the global `express.json({ limit: '10mb' })` in [index.js](server/src/index.js), so its own 64 kb parser is what caps analytics bodies (body-parser skips an already-parsed body). Don't move it below the global parser or the small cap silently stops applying to `application/json`.
- Multer is **2.x** (1.x had 2025 DoS CVEs). Uploads are staff-only and the `runUpload` wrapper turns filter/size rejections into 400s — keep both if you add an upload route.
- Admin stores its JWT in `localStorage` under `admin_token` and sets `axios.defaults.headers.common.Authorization` globally ([admin AuthContext](admin/src/context/AuthContext.jsx)); the owner dashboard in the client app uses a **separate** `owner_token` and plain `fetch`. The admin AuthContext also rejects non-admin logins client-side.
- CORS origins default to the two Vite ports; override with `ALLOWED_ORIGINS` (comma-separated) in server `.env`.
- Mongoose Map fields can't contain `.` or `$` in keys — analytics `$inc` paths are sanitized in [analyticsController.js](server/src/controllers/analyticsController.js) (`safeKey`); keep that if you add new rollup fields.
