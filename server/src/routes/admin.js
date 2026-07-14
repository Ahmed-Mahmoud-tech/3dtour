import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  createOwner,
  listOwners,
  updateOwner,
  resetOwnerPassword,
  deleteOwner,
  upsertSubscription,
  setSubscriptionStatus,
  assignProjectOwner,
} from '../controllers/adminController.js';
import { exportProject } from '../controllers/exportController.js';

const router = Router();

// Everything here is platform-admin only.
router.use(protect, adminOnly);

router.route('/owners').post(createOwner).get(listOwners);
router.route('/owners/:id').put(updateOwner).delete(deleteOwner);
router.put('/owners/:id/password', resetOwnerPassword);
router.post('/owners/:id/subscription', upsertSubscription);
router.put('/owners/:id/subscription', setSubscriptionStatus);
router.put('/projects/:id/assign', assignProjectOwner);
router.get('/projects/:id/export', exportProject);

export default router;
