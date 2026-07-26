import Project from '../models/Project.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import ActivityLog from '../models/ActivityLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_CAP = 300; // hard cap per section — the report is a digest, not an export

// Each report section reads from its most durable source, so the numbers are
// right even for periods before the ActivityLog existed:
//   new projects / clients / employees ← createdAt on the real documents
//   subscription events                ← Subscription.history (audit trail)
//   everything else                    ← ActivityLog
// The timeline therefore EXCLUDES the log actions already covered by a
// durable source, or those events would show up twice.
const LOG_ONLY_ACTIONS = [
  'project_deleted',
  'project_exported',
  'project_access_changed',
  'owner_updated',
  'owner_deleted',
  'owner_password_reset',
  'employee_updated',
  'employee_deleted',
  'employee_password_reset',
  'owner_assigned',
  'owner_unassigned',
  'employee_assigned',
  'employee_unassigned',
];

// ?from / ?to are date-only strings from <input type="date">. Missing or
// unparseable values fall back to the last 30 days; `to` includes its whole
// day so "today .. today" isn't an empty range.
const parseRange = (query) => {
  const now = new Date();
  let to = query.to ? new Date(query.to) : now;
  if (Number.isNaN(to.getTime())) to = now;
  to.setHours(23, 59, 59, 999);

  let from = query.from ? new Date(query.from) : null;
  if (!from || Number.isNaN(from.getTime()) || from > to) {
    from = new Date(to.getTime() - 30 * DAY_MS);
  }
  from.setHours(0, 0, 0, 0);
  return { from, to };
};

// GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD
// Everything that happened in the period + the always-current expiring list.
export const getActivityReport = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const inRange = { $gte: from, $lte: to };
  const now = new Date();

  const [
    newProjects,
    newClients,
    newEmployees,
    subEvents,
    activities,
    exportCount,
    deletedCount,
    expiringSubs,
  ] = await Promise.all([
    Project.find({ createdAt: inRange })
      .select('info.title owner createdBy assignedTo createdAt')
      .populate('owner', 'name')
      .populate('createdBy', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(LIST_CAP)
      .lean(),
    // Inclusion-only selects, so .lean() never leaks the password hash
    User.find({ role: 'owner', createdAt: inRange })
      .select('name email phone createdAt')
      .sort({ createdAt: -1 })
      .limit(LIST_CAP)
      .lean(),
    User.find({ role: 'employee', createdAt: inRange })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(LIST_CAP)
      .lean(),
    Subscription.aggregate([
      { $unwind: '$history' },
      { $match: { 'history.at': inRange } },
      { $sort: { 'history.at': -1 } },
      { $limit: LIST_CAP },
      { $project: { project: 1, entry: '$history' } },
    ]),
    ActivityLog.find({ createdAt: inRange, action: { $in: LOG_ONLY_ACTIONS } })
      .sort({ createdAt: -1 })
      .limit(LIST_CAP)
      .lean(),
    ActivityLog.countDocuments({ createdAt: inRange, action: 'project_exported' }),
    ActivityLog.countDocuments({ createdAt: inRange, action: 'project_deleted' }),
    // Current state, independent of the range: everything due within 30 days,
    // including already-overdue subs still marked active (canceled is a
    // deliberate admin decision, so it isn't "needs attention").
    Subscription.find({
      status: 'active',
      expiresAt: { $lte: new Date(now.getTime() + 30 * DAY_MS) },
    })
      .sort({ expiresAt: 1 })
      .limit(LIST_CAP)
      .lean(),
  ]);

  // Join subscription events + expiring subs to project titles / owner names
  const projIds = new Set();
  const byIds = new Set();
  subEvents.forEach((e) => {
    projIds.add(String(e.project));
    if (e.entry.by) byIds.add(String(e.entry.by));
  });
  expiringSubs.forEach((s) => projIds.add(String(s.project)));

  const [joinProjects, byUsers] = await Promise.all([
    Project.find({ _id: { $in: [...projIds] } })
      .select('info.title owner')
      .populate('owner', 'name email phone')
      .lean(),
    User.find({ _id: { $in: [...byIds] } }).select('name').lean(),
  ]);
  const projById = new Map(joinProjects.map((p) => [String(p._id), p]));
  const nameById = new Map(byUsers.map((u) => [String(u._id), u.name]));

  const subscriptionEvents = subEvents.map((e) => {
    const p = projById.get(String(e.project));
    return {
      action: e.entry.action,
      plan: e.entry.plan || null,
      expiresAt: e.entry.expiresAt || null,
      at: e.entry.at,
      by: e.entry.by ? nameById.get(String(e.entry.by)) || 'deleted user' : null,
      projectId: e.project,
      projectTitle: p?.info?.title || 'Deleted tour',
      ownerName: p?.owner?.name || null,
    };
  });

  const subCounts = { created: 0, renewed: 0, plan_changed: 0, canceled: 0, reactivated: 0 };
  subscriptionEvents.forEach((e) => {
    if (subCounts[e.action] !== undefined) subCounts[e.action] += 1;
  });

  const expiring = expiringSubs.map((s) => {
    const p = projById.get(String(s.project));
    return {
      projectId: s.project,
      projectTitle: p?.info?.title || 'Deleted tour',
      owner: p?.owner
        ? { _id: p.owner._id, name: p.owner.name, email: p.owner.email, phone: p.owner.phone }
        : null,
      plan: s.plan,
      expiresAt: s.expiresAt,
      daysLeft: Math.ceil((new Date(s.expiresAt).getTime() - now.getTime()) / DAY_MS),
    };
  });

  res.json({
    range: { from, to },
    summary: {
      newProjects: newProjects.length,
      deletedProjects: deletedCount,
      newClients: newClients.length,
      newEmployees: newEmployees.length,
      exports: exportCount,
      subscriptions: subCounts,
    },
    newProjects: newProjects.map((p) => ({
      _id: p._id,
      title: p.info?.title || 'Untitled',
      createdAt: p.createdAt,
      ownerName: p.owner?.name || null,
      createdByName: p.createdBy?.name || null,
      assignedToName: p.assignedTo?.name || null,
    })),
    newClients,
    newEmployees,
    subscriptionEvents,
    activities,
    expiring,
  });
});
