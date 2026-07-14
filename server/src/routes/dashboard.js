import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  canAccessTour,
  getDashboard,
  getRecentSessions,
} from '../controllers/analyticsController.js';

const router = Router();

// Owner (assigned tours only) or admin. canAccessTour enforces ownership —
// the :tourId in the URL is never trusted on its own.
router.use(protect);

router.get('/:tourId', canAccessTour, getDashboard);
router.get('/:tourId/sessions', canAccessTour, getRecentSessions);

export default router;
