import express from 'express';
import cors from 'cors';
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

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];

app.disable('x-powered-by');

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

// Baseline security headers (API + uploaded files)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files as static assets. Filenames are timestamp-unique, so
// they never change content — safe to cache aggressively.
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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  // Never leak internal error details (stack-adjacent messages) on 500s
  const message = status >= 500 ? 'Internal server error' : err.message;
  res.status(status).json({ message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
