import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitMessage } from '../controllers/messageController.js';
import { validateBody } from '../utils/validate.js';
import { submitMessageSchema } from '../validators/schemas.js';

const router = Router();

// Public contact form from the tour viewer. Stricter than analytics: a human
// writes at most a couple of messages, so 3/minute per IP is generous.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Only stored messages consume quota — a visitor whose validation failed
  // (typo'd email etc.) can retry without being locked out for a minute.
  skipFailedRequests: true,
  message: { message: 'Too many messages, please try again in a minute.' },
});

router.post('/:tourId', messageLimiter, validateBody(submitMessageSchema), submitMessage);

export default router;
