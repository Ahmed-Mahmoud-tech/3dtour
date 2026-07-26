import mongoose from 'mongoose';

// Audit trail of admin/staff actions, powering the admin Reports page
// (GET /api/admin/report). Actor/project/user names are denormalized at
// write time so entries stay readable after the thing they mention is
// deleted. Kept forever — volume is tiny (manual admin actions only) and
// the report must be able to look arbitrarily far back.
const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'project_created',
        'project_deleted',
        'project_exported',
        'project_access_changed',
        'owner_created',
        'owner_updated',
        'owner_deleted',
        'owner_password_reset',
        'employee_created',
        'employee_updated',
        'employee_deleted',
        'employee_password_reset',
        'subscription_created',
        'subscription_renewed',
        'subscription_plan_changed',
        'subscription_canceled',
        'subscription_reactivated',
        'owner_assigned',
        'owner_unassigned',
        'employee_assigned',
        'employee_unassigned',
      ],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    projectTitle: { type: String, default: '' },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetUserName: { type: String, default: '' },
    // Action-specific details (plan, expiresAt, changed fields, …)
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
