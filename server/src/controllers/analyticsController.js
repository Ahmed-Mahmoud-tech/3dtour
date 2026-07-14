import mongoose from 'mongoose';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import DailyStat from '../models/DailyStat.js';
import Visitor from '../models/Visitor.js';
import Project from '../models/Project.js';
import Subscription from '../models/Subscription.js';

const EVENT_TYPES = new Set([
  'session_start',
  'scene_view',
  'hotspot_click',
  'popup_open',
  'popup_close',
]);
const MAX_EVENTS_PER_BATCH = 50;
const MAX_ID_LEN = 64;

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

// Mongoose Map keys cannot contain '.' — node/hotspot ids never do (uuid hex),
// but sanitize defensively since these keys come from the network.
const safeKey = (s) => String(s).slice(0, MAX_ID_LEN * 2 + 1).replace(/[.$]/g, '_');

const cleanId = (v) => (typeof v === 'string' ? v.slice(0, MAX_ID_LEN) : '');

// POST /api/analytics/collect  (public, rate-limited)
// Body: { tourId, visitorId, sessionId, events: [{ type, nodeId, targetId, seq, ts }] }
// Accepts text/plain too, because navigator.sendBeacon can't send
// application/json without a CORS preflight.
export const collect = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { tourId, visitorId, sessionId, events } = body || {};

    if (!mongoose.isValidObjectId(tourId)) return res.status(400).json({ message: 'Bad tourId' });
    if (
      typeof visitorId !== 'string' || !visitorId || visitorId.length > MAX_ID_LEN ||
      typeof sessionId !== 'string' || !sessionId || sessionId.length > MAX_ID_LEN ||
      !Array.isArray(events) || events.length === 0
    ) {
      return res.status(400).json({ message: 'Bad payload' });
    }

    const project = await Project.findById(tourId).select('_id').lean();
    if (!project) return res.status(404).json({ message: 'Tour not found' });

    const now = new Date();
    const date = utcDay(now);

    const docs = [];
    const inc = {}; // $inc paths for today's DailyStat
    for (const ev of events.slice(0, MAX_EVENTS_PER_BATCH)) {
      if (!ev || !EVENT_TYPES.has(ev.type)) continue;
      const nodeId = cleanId(ev.nodeId);
      const targetId = cleanId(ev.targetId);
      docs.push({
        tourId,
        visitorId,
        sessionId,
        type: ev.type,
        nodeId,
        targetId,
        seq: Number.isFinite(ev.seq) ? ev.seq : 0,
        ts: now,
      });

      switch (ev.type) {
        case 'session_start':
          inc.sessions = (inc.sessions || 0) + 1;
          break;
        case 'scene_view': {
          if (nodeId) {
            const k = `nodeViews.${safeKey(nodeId)}`;
            inc[k] = (inc[k] || 0) + 1;
          }
          // targetId = previous node → transition edge for the flow report
          if (nodeId && targetId) {
            const t = `transitions.${safeKey(`${targetId}>${nodeId}`)}`;
            inc[t] = (inc[t] || 0) + 1;
          }
          break;
        }
        case 'hotspot_click': {
          if (targetId) {
            const k = `hotspotClicks.${safeKey(targetId)}`;
            inc[k] = (inc[k] || 0) + 1;
          }
          break;
        }
        case 'popup_open': {
          if (targetId) {
            const k = `popupOpens.${safeKey(targetId)}`;
            inc[k] = (inc[k] || 0) + 1;
          }
          break;
        }
        default:
          break;
      }
    }

    if (docs.length === 0) return res.status(400).json({ message: 'No valid events' });

    // Unique-visitor dedup: insert into the ledger; success means first visit today.
    try {
      await Visitor.create({ tourId, visitorId, date });
      inc.uniqueVisitors = 1;
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = already counted today
    }

    await Promise.all([
      AnalyticsEvent.insertMany(docs, { ordered: false }),
      Object.keys(inc).length
        ? DailyStat.updateOne({ tourId, date }, { $inc: inc }, { upsert: true })
        : Promise.resolve(),
    ]);

    res.status(204).end();
  } catch (err) {
    // Analytics must never break the viewer — log and swallow.
    console.error('analytics collect failed:', err.message);
    res.status(204).end();
  }
};

// ─── Dashboard reads (protected; ownership enforced by canAccessTour) ─────────

/**
 * Loads the tour and verifies the requester may see its dashboard:
 * the assigned owner, or any platform admin. Attaches req.project.
 */
export const canAccessTour = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.tourId))
      return res.status(400).json({ message: 'Bad tour id' });

    const project = await Project.findById(req.params.tourId);
    if (!project) return res.status(404).json({ message: 'Tour not found' });

    const isOwner = project.owner && project.owner.equals(req.user._id);
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ message: 'You do not have access to this tour' });

    req.project = project;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sumMapField = (docs, field) => {
  const out = {};
  for (const doc of docs) {
    const m = doc[field];
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) out[k] = (out[k] || 0) + v;
  }
  return out;
};

// GET /api/dashboard/:tourId?from&to
// Everything the dashboard needs in one call: tour labels, subscription,
// range totals, and the daily series. Defaults to the last 30 days.
export const getDashboard = async (req, res) => {
  try {
    const project = req.project;

    const to = req.query.to || utcDay();
    const from =
      req.query.from || utcDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

    const [days, subscription] = await Promise.all([
      DailyStat.find({ tourId: project._id, date: { $gte: from, $lte: to } })
        .sort({ date: 1 })
        .lean(),
      project.owner
        ? Subscription.findOne({ owner: project.owner }).select('-history').lean()
        : null,
    ]);

    // Plain objects after lean() (Mongoose stores Maps as objects internally)
    const totals = {
      uniqueVisitors: days.reduce((s, d) => s + (d.uniqueVisitors || 0), 0),
      sessions: days.reduce((s, d) => s + (d.sessions || 0), 0),
      nodeViews: sumMapField(days, 'nodeViews'),
      hotspotClicks: sumMapField(days, 'hotspotClicks'),
      popupOpens: sumMapField(days, 'popupOpens'),
      transitions: sumMapField(days, 'transitions'),
    };

    // Friendly labels so the dashboard never shows raw ids.
    const labels = { nodes: {}, hotspots: {}, signs: {} };
    for (const [nid, node] of project.nodes.entries()) {
      labels.nodes[nid] = node.displayName;
      for (const h of node.navigationHotspots || []) {
        const target = project.nodes.get(h.targetNodeId);
        labels.hotspots[h.id] = {
          fromNode: node.displayName,
          toNode: target ? target.displayName : h.targetNodeId,
        };
      }
      for (const s of node.infoSigns || []) {
        labels.signs[s.id] = {
          title: s.popupContent?.title || 'Untitled sign',
          node: node.displayName,
        };
      }
    }

    const sub = subscription
      ? {
          ...subscription,
          isActive:
            subscription.status === 'active' && new Date(subscription.expiresAt) > new Date(),
        }
      : null;

    res.json({
      tour: { id: project._id, title: project.info.title },
      range: { from, to },
      totals,
      days: days.map((d) => ({
        date: d.date,
        uniqueVisitors: d.uniqueVisitors || 0,
        sessions: d.sessions || 0,
      })),
      labels,
      subscription: sub,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/dashboard/:tourId/sessions?limit=20
// Recent visitor sessions with their navigation path, reconstructed from raw
// events (available for the raw-event retention window).
export const getRecentSessions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const sessions = await AnalyticsEvent.aggregate([
      { $match: { tourId: req.project._id } },
      { $sort: { sessionId: 1, seq: 1 } },
      {
        $group: {
          _id: '$sessionId',
          visitorId: { $first: '$visitorId' },
          startedAt: { $min: '$ts' },
          endedAt: { $max: '$ts' },
          events: { $sum: 1 },
          path: {
            $push: {
              $cond: [{ $eq: ['$type', 'scene_view'] }, '$nodeId', '$$REMOVE'],
            },
          },
        },
      },
      { $sort: { startedAt: -1 } },
      { $limit: limit },
    ]);

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
