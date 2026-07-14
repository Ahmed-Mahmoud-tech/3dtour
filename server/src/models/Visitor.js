import mongoose from 'mongoose';

// Deduplication ledger for unique-visitor counting. The unique compound index
// makes "is this visitor new today?" a race-free single insert: success →
// increment DailyStat.uniqueVisitors, duplicate-key error → already counted.
const visitorSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, required: true },
    visitorId: { type: String, required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
    firstSeenAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

visitorSchema.index({ tourId: 1, visitorId: 1, date: 1 }, { unique: true });
// Keep ~13 months so year-over-year re-aggregation stays possible.
visitorSchema.index({ firstSeenAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

export default mongoose.model('Visitor', visitorSchema);
