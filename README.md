# 360 Virtual Tour Platform

A production-grade, data-driven 3D Virtual Tour Platform with:

- **`/server`** — Node.js + Express + MongoDB backend API
- **`/client`** — Next.js app: marketing landing (`/`, `/ar`), React + Three.js tour viewer (`/tour/:id`), and tour-owner dashboard (`/dashboard/:id`)
- **`/admin`** — React + Three.js admin dashboard with 3D placement studio (Vite)

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 |
| MongoDB | ≥ 6 (local or Atlas) |
| FFmpeg | Any (must be in PATH, or set `FFMPEG_PATH` in `.env`) |

---

## Quick Start

### 1. Server
```bash
cd server
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev                  # http://localhost:5000
```

### 2. Client (landing + viewer + dashboard, Next.js)
```bash
cd client
npm install
npm run dev                  # http://localhost:5173  (landing at /, tours at /tour/:projectId)
npm run build:static         # self-hosted tour player → dist-static/ (needed by the admin export)
```

### 3. Admin Dashboard
```bash
cd admin
npm install
npm run dev                  # http://localhost:5174
```

---

## Architecture

```
photovideo360/
├── server/
│   ├── src/
│   │   ├── config/db.js               MongoDB connection
│   │   ├── models/
│   │   │   ├── User.js                JWT auth user
│   │   │   └── Project.js             Full tour schema (Map-based nodes)
│   │   ├── middleware/
│   │   │   ├── auth.js                JWT protect middleware
│   │   │   └── upload.js              Multer (local disk storage)
│   │   ├── controllers/
│   │   │   ├── authController.js      register / login / me
│   │   │   ├── projectController.js   full CRUD: projects, nodes, hotspots, signs
│   │   │   └── mediaController.js     upload + HTTP Range streaming
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── projects.js
│   │   │   └── media.js
│   │   └── index.js                   Express app entry
│   └── uploads/                       Local media storage (gitignored)
│
├── client/                            Next.js 14 (App Router)
│   ├── app/
│   │   ├── page.jsx / ar/page.jsx     Marketing landing (EN / AR, prerendered)
│   │   ├── tour/[projectId]/          Tour viewer route (client-only, no SSR)
│   │   └── dashboard/[tourId]/        Tour-owner dashboard route
│   └── src/
│       ├── landing/                   LandingView + GlobeCanvas + copy
│       ├── utils/
│       │   ├── coordUtils.js           degToCartesian / cartesianToDeg (R=50)
│       │   └── iconCompiler.jsx        String → React Icon component resolver
│       ├── hooks/
│       │   ├── useTour.js              Tour state machine + audio
│       │   └── useSmartPreloader.js    Background image/video preloader
│       ├── components/
│       │   ├── Sphere/SphereViewer.jsx     R3F sphere + drag controls
│       │   ├── Sphere/NavigationHotspot.jsx
│       │   ├── Sphere/InfoSign.jsx
│       │   ├── Transition/TransitionPlayer.jsx  Video overlay
│       │   ├── Popup/InfoPopup.jsx          DOMPurify sanitized HTML
│       │   └── Sidebar/NavigationSidebar.jsx
│       ├── views/TourPage.jsx          Viewer screen (also the static player)
│       ├── views/DashboardPage.jsx     Owner analytics dashboard
│       └── main.jsx                    Entry of the Vite-built static player only
│
└── admin/
    └── src/
        ├── context/AuthContext.jsx     JWT auth state
        ├── api/projectApi.js           Axios API wrappers
        ├── utils/coordUtils.js         Same math as client
        ├── components/
        │   ├── Auth/ProtectedRoute.jsx
        │   ├── Studio/SphereStudio.jsx     R3F raycaster studio
        │   ├── Studio/HotspotModal.jsx     Hotspot config + video upload
        │   ├── Studio/SignModal.jsx         Sign config + icon picker
        │   └── IconPicker/IconPicker.jsx   Searchable icon selector
        └── pages/
            ├── LoginPage.jsx
            ├── ProjectsPage.jsx
            ├── ProjectEditPage.jsx     Node management + metadata
            └── StudioPage.jsx         3D placement studio
```

---

## Key Design Decisions

### Coordinate System
Both axes stored as degrees **0–360°**:
- `x_deg` → horizontal azimuth (phi)
- `y_deg` → vertical polar (theta), where 0° = top, 90° ≈ eye level, 180° = floor

**Formula (Degrees → Three.js Cartesian, R=50):**
```
x = -50 * sin(y_deg°) * cos(x_deg°)
y =  50 * cos(y_deg°)
z = -50 * sin(y_deg°) * sin(x_deg°)
```

**Formula (Raycaster point → Degrees):**
```
theta = acos(y / 50)         → y_deg (0–180°)
phi   = atan2(-z, -x)        → x_deg (normalized 0–360°)
```

### Dynamic Icon Compilation
Icon name strings (e.g. `"FaInfoCircle"`) are resolved at runtime:
```jsx
import * as FaIcons from 'react-icons/fa'
const Icon = FaIcons["FaInfoCircle"]  // resolved by prefix lookup
```

### Security
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens, never stored in DB
- `htmlContent` in popups sanitized via DOMPurify (OWASP XSS prevention)
- File upload type validation (whitelist) + size limits
- Path traversal prevention in video streaming endpoint
- CORS restricted to configured origins
