import ActivityLog from '../models/ActivityLog.js';

/**
 * Fire-and-forget audit write — a failed log line must never fail (or slow
 * down) the action being logged. Pass `req.user` as `by` and the rest of the
 * entry fields as-is; see the ActivityLog schema for the shape.
 */
export const logActivity = (by, entry) => {
  ActivityLog.create({
    actor: by?._id || null,
    actorName: by?.name || '',
    ...entry,
  }).catch((err) => console.error('Activity log write failed:', err.message));
};
