import mongoose from 'mongoose';

// One subscription document per PROJECT (tour) — a client owning several
// tours pays for each one separately. The authoritative "is this
// subscription usable" check is expiresAt (see isActive virtual) — the status
// field exists for display/filtering and admin actions like cancellation.
const historyEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'renewed', 'plan_changed', 'canceled', 'reactivated'],
      required: true,
    },
    plan: { type: String, enum: ['monthly', 'yearly'] },
    expiresAt: Date,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      unique: true,
    },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    status: {
      type: String,
      enum: ['active', 'canceled'],
      default: 'active',
    },
    startedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && this.expiresAt > new Date();
});

subscriptionSchema.index({ expiresAt: 1, status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
