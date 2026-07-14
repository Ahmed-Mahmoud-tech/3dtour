import mongoose from 'mongoose';

// Read-optimized rollup: one document per tour per day, maintained with
// atomic $inc upserts at ingest time. The dashboard renders exclusively from
// this collection, so analytics reads never scan raw events.
const dailyStatSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
    uniqueVisitors: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    nodeViews: { type: Map, of: Number, default: () => new Map() }, // nodeId → views
    hotspotClicks: { type: Map, of: Number, default: () => new Map() }, // hotspotId → clicks
    popupOpens: { type: Map, of: Number, default: () => new Map() }, // signId → opens
    transitions: { type: Map, of: Number, default: () => new Map() }, // 'from>to' → count
  },
  {
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        for (const k of ['nodeViews', 'hotspotClicks', 'popupOpens', 'transitions']) {
          if (ret[k] instanceof Map) ret[k] = Object.fromEntries(ret[k]);
        }
        return ret;
      },
    },
  }
);

dailyStatSchema.index({ tourId: 1, date: -1 }, { unique: true });

export default mongoose.model('DailyStat', dailyStatSchema);
