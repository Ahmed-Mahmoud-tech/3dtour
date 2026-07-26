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

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
  { label: "This month", month: true },
];

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

function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-semibold text-white mb-2">
        {title}
        {count !== undefined && (
          <span className="text-gray-500 font-normal ml-2">({count})</span>
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
  const [from, setFrom] = useState(toYMD(new Date(Date.now() - 29 * DAY_MS)));
  const [to, setTo] = useState(toYMD(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null); // project id with a sub action in flight

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await adminApi.getReport({ from, to }));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyPreset = (p) => {
    const now = new Date();
    if (p.month) setFrom(toYMD(new Date(now.getFullYear(), now.getMonth(), 1)));
    else setFrom(toYMD(new Date(now.getTime() - p.days * DAY_MS)));
    setTo(toYMD(now));
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

  // Preset chip highlighting: active when it produces the current range
  const activePreset = useMemo(() => {
    const now = new Date();
    if (to !== toYMD(now)) return null;
    for (const p of PRESETS) {
      const f = p.month
        ? toYMD(new Date(now.getFullYear(), now.getMonth(), 1))
        : toYMD(new Date(now.getTime() - p.days * DAY_MS));
      if (f === from) return p.label;
    }
    return null;
  }, [from, to]);

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-white">Activity Report</h2>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  activePreset === p.label
                    ? "bg-teal-900/40 text-teal-300 border-teal-700"
                    : "bg-gray-900 text-gray-400 border-gray-700 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="admin-input text-xs py-1 w-auto"
            />
            <span className="text-gray-600 text-xs">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="admin-input text-xs py-1 w-auto"
            />
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
              count={report.expiring.length}
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
              count={report.subscriptionEvents.length}
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
            <Section title="New tours" count={report.newProjects.length}>
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
              <Section title="New clients" count={report.newClients.length}>
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
              <Section title="New employees" count={report.newEmployees.length}>
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
            <Section title="Other activity" count={report.activities.length}>
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
