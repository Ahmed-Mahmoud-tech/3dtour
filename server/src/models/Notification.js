import mongoose from 'mongoose';

// In-app notifications for platform admins (subscription expiry warnings
// etc.). Global to the admin team, not per admin user — marking one read
// marks it read for everyone. Auto-pruned after 90 days.
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['subscription_expiring', 'subscription_expired'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('Notification', notificationSchema);
