import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { collect } from '../controllers/analyticsController.js';

const router = Router();

// Public ingest endpoint — keep it cheap to abuse-proof: small body cap,
// per-IP rate limit, and the controller whitelists/validates every field.
const collectLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // one batch per second sustained is far above real viewer traffic
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/collect',
  collectLimiter,
  // sendBeacon sends text/plain blobs (json needs a CORS preflight beacons can't do)
  express.json({ limit: '64kb', type: ['application/json', 'text/plain'] }),
  collect
);

export default router;
