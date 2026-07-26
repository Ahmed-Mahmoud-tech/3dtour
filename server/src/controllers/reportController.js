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

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_RANGE_DAYS = 5 * 366; // an accidental year-3000 "to" shouldn't scan everything

// ?from / ?to are date-only strings (YYYY-MM-DD) straight from the admin's
// two date fields, interpreted in the ADMIN's timezone — ?tz carries
// Date#getTimezoneOffset() (minutes to add to local time to get UTC), so a
// UTC server doesn't chop 3 hours off an Egyptian day. `to` covers its whole
// day so "today .. today" isn't an empty range; a reversed range is swapped
// rather than silently ignored, and anything missing/unparseable falls back
// to the last 30 days.
export const parseRange = (query) => {
  const tz = Number(query.tz);
  // ±14h is the real-world limit; anything else (garbage, NaN) → UTC days
  const offsetMin = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? tz : 0;

  // 'YYYY-MM-DD' or null. Also rejects dates Date.UTC would silently roll
  // over (2026-02-31, month 13) and 2-digit years mapped into the 1900s.
  const asDay = (value) => {
    const m = YMD_RE.exec(String(value ?? '').trim());
    if (!m) return null;
    const [y, mo, d] = m.slice(1).map(Number);
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() !== mo - 1 ||
      probe.getUTCDate() !== d
    )
      return null;
    return m[0];
  };

  // One end of a wall-clock day in the admin's timezone, as a UTC instant
  const boundary = (day, endOfDay) => {
    const [y, mo, d] = day.split('-').map(Number);
    const ms = endOfDay
      ? Date.UTC(y, mo - 1, d, 23, 59, 59, 999)
      : Date.UTC(y, mo - 1, d);
    return new Date(ms + offsetMin * 60_000);
  };

  // Which calendar day an instant falls on for the admin
  const dayOf = (instant) => {
    const w = new Date(instant.getTime() - offsetMin * 60_000);
    return `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, '0')}-${String(
      w.getUTCDate(),
    ).padStart(2, '0')}`;
  };

  // Order the DAYS before turning them into boundaries — swapping the
  // instants instead would leave each with the other's time-of-day and clip
  // the first and last day of the range.
  let fromDay = asDay(query.from);
  let toDay = asDay(query.to);
  if (fromDay && toDay && fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  if (!toDay) toDay = dayOf(new Date());
  if (!fromDay) fromDay = dayOf(new Date(boundary(toDay, false).getTime() - 30 * DAY_MS));

  let clamped = false;
  if (
    boundary(toDay, true).getTime() - boundary(fromDay, false).getTime() >
    MAX_RANGE_DAYS * DAY_MS
  ) {
    fromDay = dayOf(new Date(boundary(toDay, true).getTime() - MAX_RANGE_DAYS * DAY_MS));
    clamped = true;
  }
  return { from: boundary(fromDay, false), to: boundary(toDay, true), clamped };
};

// GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=-180
// Everything that happened in the period + the always-current expiring list.
export const getActivityReport = asyncHandler(async (req, res) => {
  const { from, to, clamped } = parseRange(req.query);
  const inRange = { $gte: from, $lte: to };
  const now = new Date();
  const logFilter = { createdAt: inRange, action: { $in: LOG_ONLY_ACTIONS } };
  const expiringFilter = {
    status: 'active',
    expiresAt: { $lte: new Date(now.getTime() + 30 * DAY_MS) },
  };

  const [
    newProjects,
    newClients,
    newEmployees,
    subEvents,
    activities,
    exportCount,
    deletedCount,
    expiringSubs,
    // Lists are capped at LIST_CAP, so the headline numbers are counted
    // separately — otherwise a wide custom range under-reports at exactly 300.
    newProjectTotal,
    newClientTotal,
    newEmployeeTotal,
    subCountRows,
    activityTotal,
    expiringTotal,
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
    ActivityLog.find(logFilter).sort({ createdAt: -1 }).limit(LIST_CAP).lean(),
    ActivityLog.countDocuments({ createdAt: inRange, action: 'project_exported' }),
    ActivityLog.countDocuments({ createdAt: inRange, action: 'project_deleted' }),
    // Current state, independent of the range: everything due within 30 days,
    // including already-overdue subs still marked active (canceled is a
    // deliberate admin decision, so it isn't "needs attention").
    Subscription.find(expiringFilter).sort({ expiresAt: 1 }).limit(LIST_CAP).lean(),
    Project.countDocuments({ createdAt: inRange }),
    User.countDocuments({ role: 'owner', createdAt: inRange }),
    User.countDocuments({ role: 'employee', createdAt: inRange }),
    Subscription.aggregate([
      { $unwind: '$history' },
      { $match: { 'history.at': inRange } },
      { $group: { _id: '$history.action', n: { $sum: 1 } } },
    ]),
    ActivityLog.countDocuments(logFilter),
    Subscription.countDocuments(expiringFilter),
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

  // Counted from the unlimited $group, not the capped list above
  const subCounts = { created: 0, renewed: 0, plan_changed: 0, canceled: 0, reactivated: 0 };
  let subEventTotal = 0;
  subCountRows.forEach(({ _id, n }) => {
    subEventTotal += n;
    if (subCounts[_id] !== undefined) subCounts[_id] += n;
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
    range: {
      from,
      to,
      days: Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS)),
      clamped, // true → the requested span was wider than MAX_RANGE_DAYS
    },
    limit: LIST_CAP,
    totals: {
      newProjects: newProjectTotal,
      newClients: newClientTotal,
      newEmployees: newEmployeeTotal,
      subscriptionEvents: subEventTotal,
      activities: activityTotal,
      expiring: expiringTotal,
    },
    truncated: {
      newProjects: newProjectTotal > newProjects.length,
      newClients: newClientTotal > newClients.length,
      newEmployees: newEmployeeTotal > newEmployees.length,
      subscriptionEvents: subEventTotal > subscriptionEvents.length,
      activities: activityTotal > activities.length,
      expiring: expiringTotal > expiring.length,
    },
    summary: {
      newProjects: newProjectTotal,
      deletedProjects: deletedCount,
      newClients: newClientTotal,
      newEmployees: newEmployeeTotal,
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
