import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Admin in-app notifications (subscription expiry alerts). Shared by the
// whole admin team — read state is global, not per user.

// GET /api/admin/notifications?page&limit&unread=1
// Always paginated: { items, total, unread, page, pages }. `unread` is the
// global unread count regardless of the filter (drives the bell badge).
export const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  const filter = req.query.unread === '1' ? { read: false } : {};

  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ read: false }),
  ]);

  res.json({ items, total, unread, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

// PUT /api/admin/notifications/:id/read  — body: { read?: boolean } (default true)
export const setNotificationRead = asyncHandler(async (req, res) => {
  const read = req.body.read === undefined ? true : Boolean(req.body.read);
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { $set: { read } },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  res.json(notification);
});

// PUT /api/admin/notifications/read-all
export const markAllNotificationsRead = asyncHandler(async (_req, res) => {
  await Notification.updateMany({ read: false }, { $set: { read: true } });
  res.json({ message: 'All notifications marked read' });
});

// DELETE /api/admin/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  res.json({ message: 'Notification deleted' });
});
