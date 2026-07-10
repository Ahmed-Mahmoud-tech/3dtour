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

### API surface

- **Auth** ([routes/auth.js](server/src/routes/auth.js)): `/api/auth/register`, `/login`, `/me`. JWT bearer tokens, bcrypt passwords. The `protect` middleware ([middleware/auth.js](server/src/middleware/auth.js)) sets `req.user`.
- **Projects** ([routes/projects.js](server/src/routes/projects.js)): `GET /:id/public` is the **only public project route** (the viewer uses it). Everything else is behind `router.use(protect)` and scoped to `createdBy: req.user._id`. Nested CRUD routes exist per node / hotspot / sign / transition.
- **Media** ([routes/media.js](server/src/routes/media.js)): uploads (protected) for panorama/audio/image/video; public `GET /stream/:folder/:filename` (HTTP Range support) and `GET /reverse-status/...`.

### Media pipeline

- Uploads go to `server/uploads/{panoramas,videos,audio,images}/` via Multer disk storage ([middleware/upload.js](server/src/middleware/upload.js)). `setUploadDir(dir)` middleware sets `req.uploadDir` before Multer runs. `uploads/` is gitignored. Files are served statically at `/uploads/...`.
- **Reverse-video generation**: on transition-video upload ([mediaController.js](server/src/controllers/mediaController.js) `uploadTransitionVideo`), the server responds immediately with the forward URL, then runs FFmpeg (`reverse` filter, audio stripped, `yuv420p`) **asynchronously in the background** and patches `reverseVideoUrl` into the project's transition + any embedding hotspots. Clients poll `reverse-status` to know when it's ready. A hotspot with `playMode: "backward"` plays the reversed clip.

### Coordinate system (client ↔ admin ↔ server all agree on this)

Hotspot/sign positions are stored as `position2D: { x_deg, y_deg }` in degrees (0–360). `x_deg` = azimuth, `y_deg` = polar (0°=top, 90°≈eye level, 180°=floor). Conversion math lives in `coordUtils.js` (duplicated in [client](client/src/utils/coordUtils.js) and [admin](admin/src/utils/coordUtils.js) — **keep both in sync**). Sphere radius is hardcoded `R = 50`; the sphere is rendered inside-out (`BackSide`), which is why X and Z are negated. The admin studio raycasts clicks on the sphere and uses `cartesianToDeg` to capture placement coordinates.

### Client viewer

`useTour` ([client/src/hooks/useTour.js](client/src/hooks/useTour.js)) is the central state machine: fetches the project, tracks `activeNodeId`, drives the transition lifecycle (including a **sequential multi-video queue** — `transitionVideos` array on a hotspot plays in `order`), background audio (with autoplay-unlock on first click), and hides hotspots/signs during transitions. Rendering is React-Three-Fiber inside `SphereViewer`. `useSmartPreloader` background-loads neighbor panoramas by proximity (5s after the user settles).

### Dynamic icons & sanitized HTML

- Icons are stored as name strings (e.g. `"FaInfoCircle"`) and resolved at runtime via prefix lookup against `react-icons` bundles — see [client/src/utils/iconCompiler.jsx](client/src/utils/iconCompiler.jsx) and the admin `IconPicker`.
- Info-sign popup `htmlContent` is user-authored HTML, sanitized with **DOMPurify** before rendering ([client InfoPopup](client/src/components/Popup/InfoPopup.jsx)). Preserve this — it's the XSS boundary.

## Gotchas

- **`* copy.jsx` / `* copy 2.jsx` files exist** in `client/src` (e.g. `SphereViewer copy 2.jsx`, `TourPage copy.jsx`, `useTour copy.js`). These are stale working duplicates, not imported by the app. Edit the non-`copy` file; don't be misled by them when searching.
- Debug `console.log`s with placeholder strings (`"2222"`, `"5555"`) remain in `useTour.js`.
- Admin stores its JWT in `localStorage` under `admin_token` and sets `axios.defaults.headers.common.Authorization` globally ([admin AuthContext](admin/src/context/AuthContext.jsx)).
- CORS origins default to the two Vite ports; override with `ALLOWED_ORIGINS` (comma-separated) in server `.env`.
