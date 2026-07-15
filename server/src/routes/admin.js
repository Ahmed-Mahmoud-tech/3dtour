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
import {
  listNotifications,
  setNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../controllers/notificationController.js';

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
// In-app notifications (subscription expiry alerts) — shared by the admin team.
// read-all is registered before /:id/read so 'read-all' is never parsed as an id.
router.get('/notifications', listNotifications);
router.put('/notifications/read-all', markAllNotificationsRead);
router.put('/notifications/:id/read', setNotificationRead);
router.delete('/notifications/:id', deleteNotification);

export default router;
