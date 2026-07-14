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
  updateProjectAccess,
  createEmployee,
  listEmployees,
  updateEmployee,
  resetEmployeePassword,
  deleteEmployee,
  assignProjectEmployee,
} from '../controllers/adminController.js';
import { exportProject } from '../controllers/exportController.js';

const router = Router();

// Everything here is platform-admin only.
router.use(protect, adminOnly);

router.route('/owners').post(createOwner).get(listOwners);
router.route('/owners/:id').put(updateOwner).delete(deleteOwner);
router.put('/owners/:id/password', resetOwnerPassword);
// Subscriptions are per project (each tour is sold/renewed on its own)
router.post('/projects/:id/subscription', upsertSubscription);
router.put('/projects/:id/subscription', setSubscriptionStatus);
router.route('/employees').post(createEmployee).get(listEmployees);
router.route('/employees/:id').put(updateEmployee).delete(deleteEmployee);
router.put('/employees/:id/password', resetEmployeePassword);
router.put('/projects/:id/assign', assignProjectOwner);
router.put('/projects/:id/access', updateProjectAccess);
router.put('/projects/:id/assign-employee', assignProjectEmployee);
router.get('/projects/:id/export', exportProject);

export default router;
