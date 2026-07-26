import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi.js";
import AccountControls from "../components/Auth/AccountControls.jsx";
import {
  FaGlobe,
  FaSyncAlt,
  FaCalendarPlus,
  FaBan,
  FaFileExport,
  FaUserPlus,
  FaFolderPlus,
  FaExclamationTriangle,
} from "react-icons/fa";

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

// <input type="date"> wants local YYYY-MM-DD (toISOString would shift the day)
const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const fromYMD = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Day arithmetic on calendar components, not milliseconds: a ±DAY_MS jump
// lands on the wrong day across a DST change (Egypt observes DST again).
const addDays = (date, n) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

// Inclusive day count of a YMD..YMD range (round absorbs 23h/25h DST days)
const spanDays = (a, b) =>
  Math.round((fromYMD(b).getTime() - fromYMD(a).getTime()) / DAY_MS) + 1;

// Shortcuts; any other period is typed into the two date fields.
const PRESETS = [
  { label: "Today", range: (n) => [toYMD(n), toYMD(n)] },
  { label: "7 days", range: (n) => [toYMD(addDays(n, -6)), toYMD(n)] },
  { label: "30 days", range: (n) => [toYMD(addDays(n, -29)), toYMD(n)] },
  { label: "90 days", range: (n) => [toYMD(addDays(n, -89)), toYMD(n)] },
  {
    label: "This month",
    range: (n) => [toYMD(new Date(n.getFullYear(), n.getMonth(), 1)), toYMD(n)],
  },
  {
    label: "Last month",
    range: (n) => [
      toYMD(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
      toYMD(new Date(n.getFullYear(), n.getMonth(), 0)), // day 0 = last of prev month
    ],
  },
  {
    label: "This year",
    range: (n) => [toYMD(new Date(n.getFullYear(), 0, 1)), toYMD(n)],
  },
];

const DEFAULT_PRESET = PRESETS[2]; // 30 days

// Subscription.history actions → badge copy + color
const SUB_EVENT_STYLE = {
  created: { label: "New subscription", cls: "bg-emerald-900/40 text-emerald-300" },
  renewed: { label: "Renewed", cls: "bg-blue-900/40 text-blue-300" },
  plan_changed: { label: "Plan changed", cls: "bg-purple-900/40 text-purple-300" },
  canceled: { label: "Canceled", cls: "bg-red-900/40 text-red-300" },
  reactivated: { label: "Reactivated", cls: "bg-teal-900/40 text-teal-300" },
};

// ActivityLog actions (the ones the report timeline shows) → readable copy
const ACTIVITY_LABEL = {
  project_deleted: "Deleted tour",
  project_exported: "Exported tour (self-host zip)",
  project_access_changed: "Changed tour access",
  owner_updated: "Updated client",
  owner_deleted: "Deleted client",
  owner_password_reset: "Reset client password",
  employee_updated: "Updated employee",
  employee_deleted: "Deleted employee",
  employee_password_reset: "Reset employee password",
  owner_assigned: "Assigned tour to client",
  owner_unassigned: "Removed client from tour",
  employee_assigned: "Assigned tour to employee",
  employee_unassigned: "Removed employee from tour",
};

function DaysLeftBadge({ days }) {
  if (days < 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-300 font-medium">
        {Math.abs(days)}d overdue
      </span>
    );
  if (days <= 7)
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-300">
        {days}d left
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300">
      {days}d left
    </span>
  );
}

function StatCard({ icon, label, value, accent = "text-white" }) {
  return (
    <div className="admin-card flex items-center gap-3 py-3">
      <span className="text-gray-500">{icon}</span>
      <div>
        <p className={`text-xl font-bold leading-none ${accent}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, count, truncated, limit, children }) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-semibold text-white mb-2">
        {title}
        {count !== undefined && (
          <span className="text-gray-500 font-normal ml-2">({count})</span>
        )}
        {/* A wide custom range can outgrow the per-section cap — say so
            instead of quietly showing a partial list. */}
        {truncated && (
          <span className="text-amber-400/80 font-normal ml-2 text-xs">
            showing the most recent {limit} — narrow the dates to see the rest
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="admin-card text-sm text-gray-500 py-4">{children}</p>;
}

// Admin activity report: pick a period, see everything that happened in it
// (renewals, new tours, exports, assignments…) plus the always-current
// "expiring soon" list with renew/cancel right on the row.
export default function ReportsPage() {
  // `applied` is what the report was fetched for; `draft` is what's in the two
  // date fields. Splitting them means typing a custom range doesn't fire a
  // request per keystroke (and never queries a half-edited period).
  const [applied, setApplied] = useState(() => {
    const [f, t] = DEFAULT_PRESET.range(new Date());
    return { from: f, to: t };
  });
  const [draft, setDraft] = useState(applied);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null); // project id with a sub action in flight

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(
        await adminApi.getReport({
          from: applied.from,
          to: applied.to,
          // Day boundaries belong to the admin's timezone, not the server's
          tz: new Date().getTimezoneOffset(),
        }),
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyPreset = (p) => {
    const [f, t] = p.range(new Date());
    setDraft({ from: f, to: t });
    setApplied({ from: f, to: t });
  };

  const rangeInvalid = !draft.from || !draft.to || draft.from > draft.to;
  const dirty = draft.from !== applied.from || draft.to !== applied.to;

  const applyDraft = () => {
    if (rangeInvalid) return;
    if (dirty) setApplied({ ...draft });
    else refresh(); // same range → treat Apply as a reload
  };

  // Renew/cancel straight from the expiring list — same endpoints the
  // Clients page uses, then refetch so the row moves/disappears.
  const handleRenew = async (row, plan) => {
    setBusyId(row.projectId);
    try {
      await adminApi.upsertSubscription(row.projectId, { plan });
      await refresh();
    } catch (err) {
      window.alert(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (row) => {
    if (
      !window.confirm(
        `Cancel the subscription for "${row.projectTitle}"? The tour will stop being served.`,
      )
    )
      return;
    setBusyId(row.projectId);
    try {
      await adminApi.setSubscriptionStatus(row.projectId, "canceled");
      await refresh();
    } catch (err) {
      window.alert(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  };

  const s = report?.summary;
  const renewals = s ? s.subscriptions.renewed + s.subscriptions.plan_changed : 0;

  // Preset chip highlighting: active when it produces exactly what's in the fields
  const activePreset = useMemo(() => {
    const now = new Date();
    for (const p of PRESETS) {
      const [f, t] = p.range(now);
      if (f === draft.from && t === draft.to) return p.label;
    }
    return null;
  }, [draft]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaGlobe className="text-blue-400" size={22} />
          <h1 className="text-lg font-bold text-white">360 Tour Admin</h1>
          <nav className="ml-6 flex items-center gap-4 text-sm">
            <Link
              to="/projects"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/clients"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Clients
            </Link>
            <Link
              to="/employees"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Employees
            </Link>
            <Link to="/reports" className="text-white font-medium">
              Reports
            </Link>
          </nav>
        </div>
        <AccountControls />
      </header>

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-semibold text-white">Activity Report</h2>
          <p className="text-xs text-gray-500">
            {loading
              ? "Loading…"
              : report && (
                  <>
                    {/* The server decides the real boundaries (it clamps very
                        wide spans), so report the range it actually used. */}
                    {report.range?.days ?? spanDays(applied.from, applied.to)}{" "}
                    days · {fmtDate(report.range?.from || applied.from)} →{" "}
                    {fmtDate(report.range?.to || applied.to)}
                    {report.range?.clamped && (
                      <span className="text-amber-400/80">
                        {" "}
                        · range shortened to the maximum allowed
                      </span>
                    )}
                  </>
                )}
          </p>
        </div>

        {/* Period picker: shortcut chips + a free From/To range */}
        <div className="admin-card mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  activePreset === p.label
                    ? "bg-teal-900/40 text-teal-300 border-teal-700"
                    : "bg-gray-950 text-gray-400 border-gray-700 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                From
              </span>
              <input
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && applyDraft()}
                className="admin-input text-sm py-1.5 w-auto"
              />
            </label>
            <span className="text-gray-600 text-sm pb-2">→</span>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                To
              </span>
              <input
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && applyDraft()}
                className="admin-input text-sm py-1.5 w-auto"
              />
            </label>
            <button
              onClick={applyDraft}
              disabled={rangeInvalid || loading}
              className={`text-sm py-1.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                dirty
                  ? "bg-teal-600 hover:bg-teal-500 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              }`}
              title={dirty ? "Load this period" : "Reload this period"}
            >
              <FaSyncAlt size={11} className={loading ? "animate-spin" : ""} />
              {dirty ? "Apply" : "Refresh"}
            </button>
            {rangeInvalid && (
              <span className="text-xs text-red-400 pb-2">
                {!draft.from || !draft.to
                  ? "Pick both dates."
                  : "“From” must be on or before “To”."}
              </span>
            )}
            {!rangeInvalid && dirty && (
              <span className="text-xs text-amber-400/80 pb-2">
                {spanDays(draft.from, draft.to)} day
                {spanDays(draft.from, draft.to) === 1 ? "" : "s"} selected — hit
                Apply
              </span>
            )}
          </div>
        </div>

        {error && (
          <p className="admin-card text-sm text-red-400 mb-6">{error}</p>
        )}

        {loading && !report ? (
          <p className="text-gray-500 text-sm py-10 text-center">Loading report…</p>
        ) : report ? (
          <div className={loading ? "opacity-60 pointer-events-none" : ""}>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              <StatCard
                icon={<FaFolderPlus size={16} />}
                label="New tours"
                value={s.newProjects}
              />
              <StatCard
                icon={<FaCalendarPlus size={16} />}
                label="New subscriptions"
                value={s.subscriptions.created}
                accent="text-emerald-300"
              />
              <StatCard
                icon={<FaSyncAlt size={16} />}
                label="Renewals"
                value={renewals}
                accent="text-blue-300"
              />
              <StatCard
                icon={<FaBan size={16} />}
                label="Canceled"
                value={s.subscriptions.canceled}
                accent={s.subscriptions.canceled ? "text-red-300" : "text-white"}
              />
              <StatCard
                icon={<FaFileExport size={16} />}
                label="Exports"
                value={s.exports}
              />
              <StatCard
                icon={<FaUserPlus size={16} />}
                label="New clients"
                value={s.newClients}
              />
            </div>

            {/* Expiring soon — current state, not bound to the period */}
            <Section
              title={
                <>
                  <FaExclamationTriangle
                    className="inline mr-2 text-amber-400"
                    size={13}
                  />
                  Needs attention — subscriptions due within 30 days
                </>
              }
              count={report.totals?.expiring ?? report.expiring.length}
              truncated={report.truncated?.expiring}
              limit={report.limit}
            >
              {report.expiring.length === 0 ? (
                <Empty>Nothing due in the next 30 days. 🎉</Empty>
              ) : (
                <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                  {report.expiring.map((row) => (
                    <div
                      key={String(row.projectId)}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">
                          {row.projectTitle}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.owner ? (
                            <>
                              {row.owner.name}
                              {row.owner.phone && (
                                <span dir="ltr"> · {row.owner.phone}</span>
                              )}
                            </>
                          ) : (
                            "No client assigned"
                          )}
                          {" · "}
                          {row.plan === "yearly" ? "Yearly" : "Monthly"} · until{" "}
                          {fmtDate(row.expiresAt)}
                        </p>
                      </div>
                      <DaysLeftBadge days={row.daysLeft} />
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busyId === row.projectId}
                          onClick={() => handleRenew(row, "monthly")}
                          className="admin-btn-secondary text-xs py-1 px-2 flex items-center gap-1.5"
                          title="Extend one month from the current expiry"
                        >
                          <FaSyncAlt size={10} /> +1 month
                        </button>
                        <button
                          disabled={busyId === row.projectId}
                          onClick={() => handleRenew(row, "yearly")}
                          className="admin-btn-secondary text-xs py-1 px-2 flex items-center gap-1.5"
                          title="Extend one year from the current expiry"
                        >
                          <FaSyncAlt size={10} /> +1 year
                        </button>
                        <button
                          disabled={busyId === row.projectId}
                          onClick={() => handleCancel(row)}
                          className="text-xs py-1 px-2 rounded border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                          Cancel
                        </button>
                        <Link
                          to="/clients"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Subscription events in the period */}
            <Section
              title="Subscription activity"
              count={
                report.totals?.subscriptionEvents ??
                report.subscriptionEvents.length
              }
              truncated={report.truncated?.subscriptionEvents}
              limit={report.limit}
            >
              {report.subscriptionEvents.length === 0 ? (
                <Empty>No subscription activity in this period.</Empty>
              ) : (
                <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                  {report.subscriptionEvents.map((e, i) => {
                    const style = SUB_EVENT_STYLE[e.action] || {
                      label: e.action,
                      cls: "bg-gray-800 text-gray-300",
                    };
                    return (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                      >
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${style.cls} shrink-0`}
                        >
                          {style.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-white">
                            {e.projectTitle}
                          </span>
                          {e.ownerName && (
                            <span className="text-xs text-gray-500 ml-2">
                              {e.ownerName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {e.plan && (
                            <>
                              {e.plan === "yearly" ? "Yearly" : "Monthly"}
                              {e.expiresAt && <> · until {fmtDate(e.expiresAt)}</>}
                              {" · "}
                            </>
                          )}
                          {e.by && <>by {e.by} · </>}
                          {fmtDateTime(e.at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* New tours */}
            <Section
              title="New tours"
              count={s.newProjects}
              truncated={report.truncated?.newProjects}
              limit={report.limit}
            >
              {report.newProjects.length === 0 ? (
                <Empty>No tours created in this period.</Empty>
              ) : (
                <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                  {report.newProjects.map((p) => (
                    <div
                      key={p._id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                    >
                      <Link
                        to={`/projects/${p._id}`}
                        className="text-sm text-white font-medium hover:text-teal-300 transition-colors min-w-0 flex-1 truncate"
                      >
                        {p.title}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {p.createdByName && <>by {p.createdByName} · </>}
                        {p.ownerName ? `client: ${p.ownerName}` : "no client yet"}
                        {p.assignedToName && <> · staff: {p.assignedToName}</>}
                        {" · "}
                        {fmtDateTime(p.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* New clients / employees */}
            <div className="grid md:grid-cols-2 gap-6">
              <Section
                title="New clients"
                count={s.newClients}
                truncated={report.truncated?.newClients}
                limit={report.limit}
              >
                {report.newClients.length === 0 ? (
                  <Empty>No clients added in this period.</Empty>
                ) : (
                  <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                    {report.newClients.map((c) => (
                      <div key={c._id} className="px-4 py-2.5">
                        <p className="text-sm text-white">{c.name}</p>
                        <p className="text-xs text-gray-500">
                          {c.email}
                          {c.phone && <span dir="ltr"> · {c.phone}</span>} ·{" "}
                          {fmtDate(c.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
              <Section
                title="New employees"
                count={s.newEmployees}
                truncated={report.truncated?.newEmployees}
                limit={report.limit}
              >
                {report.newEmployees.length === 0 ? (
                  <Empty>No employees added in this period.</Empty>
                ) : (
                  <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                    {report.newEmployees.map((e) => (
                      <div key={e._id} className="px-4 py-2.5">
                        <p className="text-sm text-white">{e.name}</p>
                        <p className="text-xs text-gray-500">
                          {e.email} · {fmtDate(e.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* Everything else the team did (from the activity log) */}
            <Section
              title="Other activity"
              count={report.totals?.activities ?? report.activities.length}
              truncated={report.truncated?.activities}
              limit={report.limit}
            >
              {report.activities.length === 0 ? (
                <Empty>
                  No other activity in this period. (Exports, deletions and
                  assignments are recorded from the day this report feature was
                  deployed onward.)
                </Empty>
              ) : (
                <div className="admin-card divide-y divide-gray-800 p-0 overflow-hidden">
                  {report.activities.map((a) => (
                    <div
                      key={a._id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1 text-sm text-gray-300">
                        <span className="text-white">
                          {ACTIVITY_LABEL[a.action] || a.action}
                        </span>
                        {a.projectTitle && <> — {a.projectTitle}</>}
                        {a.targetUserName && <> — {a.targetUserName}</>}
                      </div>
                      <span className="text-xs text-gray-500">
                        {a.actorName && <>by {a.actorName} · </>}
                        {fmtDateTime(a.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
