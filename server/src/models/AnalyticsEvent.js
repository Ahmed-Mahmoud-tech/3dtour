import mongoose from 'mongoose';

// Raw event log — write-optimized, insert-only. The dashboard reads the
// DailyStat rollups, not this collection; raw events exist for per-session
// path replay and future re-aggregation, and auto-expire via TTL.
const analyticsEventSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, required: true },
    visitorId: { type: String, required: true }, // UUID persisted in localStorage
    sessionId: { type: String, required: true }, // UUID per viewer page-load
    type: {
      type: String,
      required: true,
      enum: ['session_start', 'scene_view', 'hotspot_click', 'popup_open', 'popup_close'],
    },
    nodeId: { type: String, default: '' }, // scene where the event happened
    targetId: { type: String, default: '' }, // hotspot/sign id, or target node for scene_view
    seq: { type: Number, default: 0 }, // per-session counter → deterministic path order
    meta: { type: Object, default: undefined },
    ts: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

analyticsEventSchema.index({ tourId: 1, ts: -1 });
analyticsEventSchema.index({ tourId: 1, sessionId: 1, seq: 1 });
// Raw events expire after 90 days; rollups keep the numbers forever.
analyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model('AnalyticsEvent', analyticsEventSchema);
