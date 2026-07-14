import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Brute-force guard: failed logins are the only thing that consumes quota,
// so legitimate users who mistype once or twice are never locked out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts, please try again in 15 minutes.' },
});

router.post('/register', loginLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);
router.put('/password', protect, changePassword);

export default router;
