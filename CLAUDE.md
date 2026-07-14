# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A 360° virtual tour platform built as three independent npm packages that share no code (utilities like `coordUtils.js` are **duplicated** between `client/` and `admin/`, not imported):

- **`server/`** — Node.js + Express + MongoDB API (ES modules, `"type": "module"`)
- **`client/`** — React + Three.js viewer, the user-facing tour player (Vite, port 5173)
- **`admin/`** — React + Three.js admin dashboard with a 3D placement studio (Vite, port 5174)

Each has its own `package.json`; run `npm install` separately in each.

## Commands

All commands run from the respective package directory.

```bash
# server (requires MongoDB running + .env with MONGO_URI and JWT_SECRET; FFmpeg on PATH or FFMPEG_PATH set)
cd server && npm install && npm run dev     # nodemon, http://localhost:5000
npm start                                    # production (plain node)

# client / admin (identical scripts)
npm run dev        # vite dev server
npm run build      # production build to dist/
npm run preview    # preview the build

# client only
npm run build:static   # self-hosted tour player → client/dist-static/ (required before admin tour export works)
```

There is **no test runner, linter, or formatter configured** in any package — no `test`/`lint` scripts exist. `mongodb-memory-server` is a server devDependency but is not wired to any script.

Both frontends proxy `/api` and `/uploads` to `http://localhost:5000` via Vite (see each `vite.config.js`), so the server must be running for either to function. Both read `import.meta.env.VITE_API_URL` and fall back to `/api`.

## Architecture

### Data model — the whole tour is one Project document

A `Project` ([server/src/models/Project.js](server/src/models/Project.js)) is a single deeply-nested MongoDB document holding the entire tour. Key structural decisions:

- `nodes` and `transitions` are Mongoose **`Map`** fields keyed by dynamic string IDs (e.g. `node_ab12...`). The schema's `toJSON` transform converts these Maps to plain objects, so the API always returns/accepts `{ nodes: { node_x: {...} } }`, not arrays.
- A **node** = one panorama sphere with `navigationHotspots` (links to other nodes, optionally via transition video) and `infoSigns` (clickable popups).
- IDs are generated server-side with `uuid` (`node_`, `nav_`, `sign_` prefixes — see helpers in [projectController.js](server/src/controllers/projectController.js)).
- When mutating nested Map/array data in a controller, you must call `project.markModified('nodes')` before `save()` (Mongoose can't auto-detect deep Map mutations).

### Roles, subscriptions & multi-tenancy (SaaS layer, added 2026-07)

- `User.role` is `admin` (the platform operator, uses the admin app) or `owner` (a client who bought a tour; analytics dashboard + own-password change only). `POST /api/auth/register` is **bootstrap-only** — it creates the first admin when the users collection is empty, then returns 403 forever; owners are created via `POST /api/admin/owners` with `mustChangePassword: true`.
- `Project.owner` = the assigned client (set via `PUT /api/admin/projects/:id/assign`); `Project.createdBy` stays the admin who built it. Dashboard access checks `owner`, studio scoping checks `createdBy`.
- One [Subscription](server/src/models/Subscription.js) doc per owner (`monthly`/`yearly`; `expiresAt` is the source of truth, `status` is display; `history[]` audit trail). An expired/canceled subscription makes `GET /:id/public` return **403 with `reason: 'subscription_expired'`** (viewer shows a "tour unavailable" screen) — tours with `owner: null` are never gated. The owner's dashboard keeps working while expired.

### API surface

- **Auth** ([routes/auth.js](server/src/routes/auth.js)): `/api/auth/register` (bootstrap-only, see above), `/login`, `/me`, `PUT /password` (self-service change, clears `mustChangePassword`). JWT bearer tokens, bcrypt passwords. `protect` ([middleware/auth.js](server/src/middleware/auth.js)) sets `req.user` and rejects suspended accounts; `adminOnly` guards admin routes.
- **Projects** ([routes/projects.js](server/src/routes/projects.js)): `GET /:id/public` is the only public project route (the viewer uses it) and is **subscription-gated**; the admin studio reads via protected `GET /:id`. Everything else is behind `router.use(protect)` and scoped to `createdBy: req.user._id`. Nested CRUD routes exist per node / hotspot / sign / transition.
- **Admin** ([routes/admin.js](server/src/routes/admin.js), all `protect + adminOnly`): owner CRUD, password reset, subscription create/renew/cancel, tour assignment, and `GET /projects/:id/export` (self-hosted zip — see Static export below).
- **Analytics** ([routes/analytics.js](server/src/routes/analytics.js)): public `POST /collect`, rate-limited, parses `text/plain` as JSON because `navigator.sendBeacon` can't send `application/json` without a preflight.
- **Dashboard** ([routes/dashboard.js](server/src/routes/dashboard.js)): `GET /:tourId` and `/:tourId/sessions`, behind `protect` + `canAccessTour` (assigned owner or any admin — the URL is never trusted).
- **Media** ([routes/media.js](server/src/routes/media.js)): uploads (protected) for panorama/audio/image/video; public `GET /stream/:folder/:filename` (HTTP Range support) and `GET /reverse-status/...`.

### Analytics pipeline (never touches the Project document)

Three collections, all in [server/src/models](server/src/models): **AnalyticsEvent** (raw insert-only events, TTL 90 days, used only for per-session path replay), **DailyStat** (one doc per tour per day, maintained with `$inc` upserts on Map fields keyed by node/hotspot/sign id and `from>to` transition edges — the dashboard reads exclusively from this), and **Visitor** (dedup ledger: unique compound index on `{tourId, visitorId, date}` makes "new visitor today?" a race-free insert). Client side, [useAnalytics](client/src/hooks/useAnalytics.js) queues events and flushes every 10 s + on tab hide via sendBeacon; `scene_view.targetId` carries the *previous* node id, which is how navigation edges are counted. Analytics failures must stay silent — the collect endpoint even errors as 204.

### Static export (admin-only)

`GET /api/admin/projects/:id/export` ([exportController.js](server/src/controllers/exportController.js)) streams a zip: the prebuilt static player (`client/dist-static`, from `npm run build:static`; override dir with `STATIC_PLAYER_DIR`) + `tour.json` (all `/uploads/...` URLs rewritten to relative `media/...`) + the media files. The static build compiles `VITE_STATIC_TOUR=1` in (see [client/vite.config.js](client/vite.config.js)): `useTour` then fetches `./tour.json`, the whole router renders `TourPage`, and analytics is disabled. Note: `archiver` v8 has **no default export** — `import { ZipArchive } from 'archiver'`.

### Media pipeline

- Uploads go to `server/uploads/{panoramas,videos,audio,images}/` via Multer disk storage ([middleware/upload.js](server/src/middleware/upload.js)). `setUploadDir(dir)` middleware sets `req.uploadDir` before Multer runs. `uploads/` is gitignored. Files are served statically at `/uploads/...`.
- **Reverse-video generation**: on transition-video upload ([mediaController.js](server/src/controllers/mediaController.js) `uploadTransitionVideo`), the server responds immediately with the forward URL, then runs FFmpeg (`reverse` filter, audio stripped, `yuv420p`) **asynchronously in the background** and patches `reverseVideoUrl` into the project's transition + any embedding hotspots. Clients poll `reverse-status` to know when it's ready. A hotspot with `playMode: "backward"` plays the reversed clip.

### Coordinate system (client ↔ admin ↔ server all agree on this)

Hotspot/sign positions are stored as `position2D: { x_deg, y_deg }` in degrees (0–360). `x_deg` = azimuth, `y_deg` = polar (0°=top, 90°≈eye level, 180°=floor). Conversion math lives in `coordUtils.js` (duplicated in [client](client/src/utils/coordUtils.js) and [admin](admin/src/utils/coordUtils.js) — **keep both in sync**). Sphere radius is hardcoded `R = 50`; the sphere is rendered inside-out (`BackSide`), which is why X and Z are negated. The admin studio raycasts clicks on the sphere and uses `cartesianToDeg` to capture placement coordinates.

### Client viewer

`useTour` ([client/src/hooks/useTour.js](client/src/hooks/useTour.js)) is the central state machine: fetches the project, tracks `activeNodeId`, drives the transition lifecycle (including a **sequential multi-video queue** — `transitionVideos` array on a hotspot plays in `order`), background audio (with autoplay-unlock on first click), and hides hotspots/signs during transitions. Rendering is React-Three-Fiber inside `SphereViewer`. `useSmartPreloader` background-loads neighbor panoramas by proximity (5s after the user settles).

The client app also hosts the **tour-owner dashboard** at `/dashboard/:tourId` ([DashboardPage.jsx](client/src/pages/DashboardPage.jsx), lazy-loaded): renders a login form when logged out, forces a password change when `mustChangePassword`, then shows analytics + subscription. Its chart series colors (`#0d9488`, `#8b5cf6`) were validated for contrast/CVD on the dark surface — don't casually swap them for lighter Tailwind steps.

### Dynamic icons & sanitized HTML

- Icons are stored as name strings (e.g. `"FaInfoCircle"`) and resolved at runtime via prefix lookup against `react-icons` bundles — see [client/src/utils/iconCompiler.jsx](client/src/utils/iconCompiler.jsx) and the admin `IconPicker`.
- Info-sign popup `htmlContent` is user-authored HTML, sanitized with **DOMPurify** before rendering ([client InfoPopup](client/src/components/Popup/InfoPopup.jsx)). Preserve this — it's the XSS boundary.

## Gotchas

- **`* copy.jsx` / `* copy 2.jsx` files exist** in `client/src` (e.g. `SphereViewer copy 2.jsx`, `TourPage copy.jsx`, `useTour copy.js`). These are stale working duplicates, not imported by the app. Edit the non-`copy` file; don't be misled by them when searching.
- Debug `console.log`s with placeholder strings (`"2222"`, `"5555"`) remain in `useTour.js`.
- Admin stores its JWT in `localStorage` under `admin_token` and sets `axios.defaults.headers.common.Authorization` globally ([admin AuthContext](admin/src/context/AuthContext.jsx)); the owner dashboard in the client app uses a **separate** `owner_token` and plain `fetch`. The admin AuthContext also rejects non-admin logins client-side.
- CORS origins default to the two Vite ports; override with `ALLOWED_ORIGINS` (comma-separated) in server `.env`.
- Mongoose Map fields can't contain `.` or `$` in keys — analytics `$inc` paths are sanitized in [analyticsController.js](server/src/controllers/analyticsController.js) (`safeKey`); keep that if you add new rollup fields.
