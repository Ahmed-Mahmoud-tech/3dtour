import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  canAccessTour,
  getDashboard,
  getRecentSessions,
} from '../controllers/analyticsController.js';
import {
  getMessages,
  setMessageRead,
  deleteMessage,
} from '../controllers/messageController.js';

const router = Router();

// Owner (assigned tours only) or admin. canAccessTour enforces ownership —
// the :tourId in the URL is never trusted on its own.
router.use(protect);

router.get('/:tourId', canAccessTour, getDashboard);
router.get('/:tourId/sessions', canAccessTour, getRecentSessions);

// Visitor messages inbox
router.get('/:tourId/messages', canAccessTour, getMessages);
router.put('/:tourId/messages/:messageId/read', canAccessTour, setMessageRead);
router.delete('/:tourId/messages/:messageId', canAccessTour, deleteMessage);

export default router;
