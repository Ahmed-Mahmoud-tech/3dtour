import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import mediaRoutes from './routes/media.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import dashboardRoutes from './routes/dashboard.js';
import messageRoutes from './routes/messages.js';
import { startSubscriptionReminderJob } from './jobs/subscriptionReminders.js';
import { startUploadCleanupJob } from './jobs/uploadCleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Behind nginx in production: trust the first proxy hop so req.ip (used by the
// rate limiters) reflects the real client, not 127.0.0.1. Harmless in dev.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ─── Database ─────────────────────────────────────────────────────────────────
connectDB();

// Hourly sweep: emails owners about expiring subscriptions and creates
// admin notifications (see jobs/subscriptionReminders.js).
startSubscriptionReminderJob();

// Daily sweep: deletes uploaded files no tour uses (48h grace — see
// jobs/uploadCleanup.js for the exact rules and safety guards).
startUploadCleanupJob();

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

app.disable('x-powered-by');

// Baseline security headers via helmet. This is a JSON API + static file host
// (the Next/Vite frontends live on other origins), so a strict CSP here does
// not constrain the apps — it only hardens direct responses. HSTS is enabled
// in production (behind nginx TLS); harmless-to-omit in plain-HTTP dev.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // API returns JSON and static media; nothing should load active content.
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    // The frontends embed /uploads media cross-origin — don't block that.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g., Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      const err = new Error('Not allowed by CORS');
      err.status = 403; // a disallowed origin is a client error, not a server crash
      cb(err);
    },
    credentials: true,
  })
);

// Analytics mounts BEFORE the global 10mb JSON parser: it carries its own
// strict 64kb parser (and accepts text/plain for sendBeacon), and body-parser
// skips bodies another parser already consumed — mounting it here is the only
// way its small limit actually applies to application/json too.
app.use('/api/analytics', analyticsRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files as static assets. Panoramas/images/audio are fully
// optimized BEFORE their URL is handed out, so those filenames never change
// content — safe to cache aggressively. Transition videos are the exception:
// uploadTransitionVideo returns the URL immediately and the optimizer rewrites
// the SAME file in the background, so a video fetched during that window must
// not be pinned as `immutable` for 30 days. no-cache forces an ETag
// revalidation on reuse — a cheap 304 once the file is stable.
app.use(
  '/uploads/videos',
  express.static(path.join(__dirname, '../uploads/videos'), {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
);
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '30d',
    immutable: true,
  })
);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Global error handler ─────────────────────────────────────────────────────
// Every async controller routes here (via asyncHandler) — this is the single
// place that decides what error detail a client may see.
app.use((err, _req, res, _next) => {
  // Malformed ids / schema-rejected payloads are client errors, not crashes
  if (err.name === 'CastError')
    return res.status(400).json({ message: 'Invalid id format' });
  if (err.name === 'ValidationError')
    return res.status(400).json({ message: err.message });
  // Optimistic-concurrency conflict (Project schema): a stale save() lost the
  // race to a concurrent editor — the client should reload and retry.
  if (err.name === 'VersionError')
    return res.status(409).json({
      message: 'This project was modified by someone else. Reload to get the latest version, then re-apply your change.',
    });

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err.stack);
  // Never leak internal error details (stack-adjacent messages) on 500s
  const message = status >= 500 ? 'Internal server error' : err.message;
  res.status(status).json({ message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
