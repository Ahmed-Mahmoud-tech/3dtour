import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { adminApi } from "../api/adminApi.js";
import { projectApi } from "../api/projectApi.js";
import {
  FaPlus,
  FaTrash,
  FaGlobe,
  FaSignOutAlt,
  FaSyncAlt,
  FaKey,
  FaUserSlash,
  FaUserCheck,
  FaCalendarPlus,
  FaLink,
  FaChartBar,
} from "react-icons/fa";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// The public viewer app (client/), where the owner dashboard lives.
const VIEWER_URL = import.meta.env.VITE_VIEWER_URL || "http://localhost:5173";

function SubscriptionBadge({ sub }) {
  if (!sub)
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">
        No subscription
      </span>
    );
  if (sub.status === "canceled")
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400">
        Canceled
      </span>
    );
  if (!sub.isActive)
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400">
        Expired {fmtDate(sub.expiresAt)}
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
      {sub.plan === "yearly" ? "Yearly" : "Monthly"} · until{" "}
      {fmtDate(sub.expiresAt)}
    </span>
  );
}

export default function ClientsPage() {
  const { user, logout } = useAuth();
  const [owners, setOwners] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    plan: "monthly",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [ownersData, projectsData] = await Promise.all([
        adminApi.listOwners(),
        projectApi.list(),
      ]);
      setOwners(ownersData);
      setProjects(projectsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await adminApi.createOwner(form);
      setForm({ name: "", email: "", password: "", plan: "monthly" });
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = async (owner, plan) => {
    await adminApi.upsertSubscription(owner._id, { plan });
    await refresh();
  };

  const handleCancelSub = async (owner) => {
    if (
      !window.confirm(
        `Cancel ${owner.name}'s subscription? Their tour will stop being served.`,
      )
    )
      return;
    await adminApi.setSubscriptionStatus(owner._id, "canceled");
    await refresh();
  };

  const handleResetPassword = async (owner) => {
    const password = window.prompt(
      `New temporary password for ${owner.name} (min 8 chars):`,
    );
    if (!password) return;
    try {
      await adminApi.resetOwnerPassword(owner._id, password);
      window.alert("Password reset. The client must change it on next login.");
    } catch (err) {
      window.alert(err.response?.data?.message || err.message);
    }
  };

  const handleToggleStatus = async (owner) => {
    const next = owner.status === "suspended" ? "active" : "suspended";
    if (
      next === "suspended" &&
      !window.confirm(`Suspend ${owner.name}? They will not be able to log in.`)
    )
      return;
    await adminApi.updateOwner(owner._id, { status: next });
    await refresh();
  };

  const handleDelete = async (owner) => {
    if (
      !window.confirm(
        `Delete ${owner.name}'s account and subscription? Their tours become unassigned. This cannot be undone.`,
      )
    )
      return;
    await adminApi.deleteOwner(owner._id);
    await refresh();
  };

  const handleAssign = async (owner, projectId) => {
    if (!projectId) return;
    await adminApi.assignProject(projectId, owner._id);
    await refresh();
  };

  const handleUnassign = async (owner, projectId) => {
    await adminApi.assignProject(projectId, null);
    await refresh();
  };

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
            <Link to="/clients" className="text-white font-medium">
              Clients
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">{user?.name}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors"
          >
            <FaSignOutAlt size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Clients</h2>
          <button
            onClick={() => setCreating((v) => !v)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <FaPlus size={12} />
            New Client
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <form
            onSubmit={handleCreate}
            className="admin-card mb-6 flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                autoFocus
                className="admin-input"
                placeholder="Client name…"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="admin-input"
                type="email"
                placeholder="Email (login)…"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="admin-input"
                placeholder="Temporary password (min 8 chars)…"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <select
                className="admin-input"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="monthly">Monthly plan</option>
                <option value="yearly">Yearly plan</option>
                <option value="">No subscription yet</option>
              </select>
            </div>
            <p className="text-gray-500 text-xs">
              The client logs in with this email/password and is forced to set a
              new password on first login.
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="admin-btn-primary flex items-center gap-2"
              >
                {submitting && <FaSyncAlt size={12} className="animate-spin" />}
                Create client
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="admin-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Client list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : owners.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <FaGlobe size={48} className="mx-auto mb-4 opacity-30" />
            <p>
              No clients yet. Create a tour owner account for your first client.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {owners.map((owner) => {
              const assignedIds = new Set(owner.tours.map((t) => t._id));
              const unassignedProjects = projects.filter(
                (p) => !assignedIds.has(p._id) && !p.owner,
              );
              return (
                <div key={owner._id} className="admin-card flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {owner.name}
                        {owner.status === "suspended" && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400">
                            Suspended
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {owner.email} · created {fmtDate(owner.createdAt)} ·
                        last login {fmtDate(owner.lastLoginAt)}
                      </p>
                    </div>
                    <SubscriptionBadge sub={owner.subscription} />
                  </div>

                  {/* Tours */}
                  <div className="border-t border-gray-800 pt-3">
                    <p className="admin-label mb-2">Tours</p>
                    {owner.tours.length === 0 ? (
                      <p className="text-gray-600 text-xs mb-2">
                        No tour assigned yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 mb-2">
                        {owner.tours.map((t) => (
                          <li
                            key={t._id}
                            className="flex items-center gap-3 text-sm text-gray-300"
                          >
                            <FaLink size={10} className="text-gray-600" />
                            <span className="truncate">{t.title}</span>
                            <Link
                              to={`/projects/${t._id}`}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              open
                            </Link>
                            <a
                              href={`${VIEWER_URL}/dashboard/${t._id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-400 hover:text-teal-300 text-xs flex items-center gap-1"
                            >
                              <FaChartBar size={10} /> dashboard
                            </a>
                            <button
                              onClick={() => handleUnassign(owner, t._id)}
                              className="text-gray-600 hover:text-red-400 text-xs ml-auto"
                            >
                              unassign
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {unassignedProjects.length > 0 && (
                      <select
                        className="admin-input text-xs w-auto"
                        value=""
                        onChange={(e) => handleAssign(owner, e.target.value)}
                      >
                        <option value="">Assign a tour…</option>
                        {unassignedProjects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.info?.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                    <button
                      onClick={() => handleRenew(owner, "monthly")}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaCalendarPlus size={11} /> +1 month
                    </button>
                    <button
                      onClick={() => handleRenew(owner, "yearly")}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaCalendarPlus size={11} /> +1 year
                    </button>
                    {owner.subscription?.status === "active" && (
                      <button
                        onClick={() => handleCancelSub(owner)}
                        className="admin-btn-secondary text-xs py-1.5 text-amber-400"
                      >
                        Cancel subscription
                      </button>
                    )}
                    <span className="flex-1" />
                    <button
                      onClick={() => handleResetPassword(owner)}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaKey size={11} /> Reset password
                    </button>
                    <button
                      onClick={() => handleToggleStatus(owner)}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      {owner.status === "suspended" ? (
                        <>
                          <FaUserCheck size={11} /> Reactivate
                        </>
                      ) : (
                        <>
                          <FaUserSlash size={11} /> Suspend
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(owner)}
                      className="admin-btn-danger text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
