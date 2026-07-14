import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/**
 * Tour-owner dashboard (/dashboard/:tourId).
 *
 * The route is public but the content is not: without a valid token the page
 * only renders the login form. Ownership is enforced server-side — a logged-in
 * owner opening another tour's URL gets a 403 from /api/dashboard/:tourId.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const TOKEN_KEY = "owner_token";

// Series colors — validated (dataviz) against the dark surface for lightness,
// chroma, CVD separation and contrast. Don't swap for lighter tailwind steps.
const COLOR_VISITORS = "#0d9488";
const COLOR_SESSIONS = "#8b5cf6";

const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token, user } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col gap-4"
      >
        <h1 className="text-white text-xl font-bold text-center">
          gate<span className="text-teal-400">verse</span>
        </h1>
        <p className="text-gray-400 text-sm text-center mb-2">
          Tour dashboard — sign in
        </p>
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          type="email"
          placeholder="Email"
          value={email}
          required
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={busy}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ─── Change password (forced on first login, or on demand) ───────────────────

function ChangePasswordForm({ forced, onDone, onCancel }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== confirm) return setError("New passwords do not match");
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col gap-4"
      >
        <h2 className="text-white text-lg font-semibold text-center">
          {forced ? "Set your own password" : "Change password"}
        </h2>
        {forced && (
          <p className="text-gray-400 text-sm text-center">
            Your account was created with a temporary password. Please choose a
            new one to continue.
          </p>
        )}
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          type="password"
          placeholder="Current password"
          value={current}
          required
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          type="password"
          placeholder="New password (min 8 chars)"
          value={next}
          required
          minLength={8}
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          type="password"
          placeholder="Repeat new password"
          value={confirm}
          required
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={busy}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
        {!forced && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}

// ─── Chart: daily visitors & sessions ─────────────────────────────────────────

function DailyChart({ days }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // index into days

  const W = 640,
    H = 200,
    PL = 36,
    PR = 12,
    PT = 10,
    PB = 22;
  const innerW = W - PL - PR,
    innerH = H - PT - PB;

  const yMax = Math.max(
    1,
    ...days.map((d) => Math.max(d.uniqueVisitors, d.sessions)),
  );
  const niceMax = Math.ceil(yMax / 4) * 4;
  const x = (i) =>
    PL + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v) => PT + innerH - (v / niceMax) * innerH;

  const line = (key) => days.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PL) / innerW) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-4 mb-2 text-xs text-gray-300">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_VISITORS }}
          />
          Unique visitors
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_SESSIONS }}
          />
          Sessions
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid */}
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(v)}
              y2={y(v)}
              stroke="#1f2937"
              strokeWidth="1"
            />
            <text
              x={PL - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#6b7280"
            >
              {v}
            </text>
          </g>
        ))}
        {/* x labels: first / middle / last */}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fill="#6b7280"
            >
              {dayLabel(days[i].date)}
            </text>
          ))}
        {/* series */}
        <polyline
          points={line("sessions")}
          fill="none"
          stroke={COLOR_SESSIONS}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polyline
          points={line("uniqueVisitors")}
          fill="none"
          stroke={COLOR_VISITORS}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* hover crosshair */}
        {hover != null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PT}
              y2={PT + innerH}
              stroke="#4b5563"
              strokeWidth="1"
            />
            <circle
              cx={x(hover)}
              cy={y(days[hover].sessions)}
              r="4"
              fill={COLOR_SESSIONS}
              stroke="#030712"
              strokeWidth="2"
            />
            <circle
              cx={x(hover)}
              cy={y(days[hover].uniqueVisitors)}
              r="4"
              fill={COLOR_VISITORS}
              stroke="#030712"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="absolute pointer-events-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 shadow-lg"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform:
              x(hover) > W * 0.7 ? "translateX(-110%)" : "translateX(10px)",
          }}
        >
          <div className="text-gray-400 mb-1">{dayLabel(days[hover].date)}</div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: COLOR_VISITORS }}
            />
            {days[hover].uniqueVisitors} visitors
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: COLOR_SESSIONS }}
            />
            {days[hover].sessions} sessions
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

/** Prev / Next pager. Renders nothing when there's a single page. */
function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const btn =
    "px-2.5 py-1 rounded-md border border-gray-800 text-gray-400 " +
    "hover:border-gray-600 hover:text-gray-200 disabled:opacity-40 " +
    "disabled:hover:border-gray-800 disabled:hover:text-gray-400 transition-colors";
  return (
    <div className="flex items-center justify-between mt-3 text-xs">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="text-gray-500 tabular-nums">
        Page {page} of {pages}
      </span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

/** Ranked horizontal bar list (single-hue magnitude), paginated client-side. */
function BarList({ title, rows, emptyText, pageSize = 8 }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(Math.ceil(rows.length / pageSize), 1);
  const cur = Math.min(page, pages); // clamp if rows shrink after a range change
  const visible = rows.slice((cur - 1) * pageSize, cur * pageSize);
  // Bars stay scaled to the global max so page 2 isn't misleadingly tall
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-white text-sm font-semibold mb-3">
        {title}
        {rows.length > pageSize && (
          <span className="text-gray-500 font-normal ml-2">({rows.length})</span>
        )}
      </h3>
      {rows.length === 0 ? (
        <p className="text-gray-600 text-sm">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((r) => (
            <li key={r.key} className="text-xs">
              <div className="flex justify-between text-gray-300 mb-0.5">
                <span className="truncate pr-2">{r.label}</span>
                <span className="text-gray-400 tabular-nums">{r.value}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.value / max) * 100}%`,
                    background: COLOR_VISITORS,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={cur} pages={pages} onPage={setPage} />
    </div>
  );
}

// ─── Visitor messages inbox ───────────────────────────────────────────────────

function MessagesCard({ tourId }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // debounced search actually queried

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(
        await apiFetch(
          `/dashboard/${tourId}/messages?page=${page}&limit=10&q=${encodeURIComponent(q)}`,
        ),
      );
    } catch (err) {
      setError(err.message);
    }
  }, [tourId, page, q]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRead = async (m) => {
    try {
      await apiFetch(`/dashboard/${tourId}/messages/${m._id}/read`, {
        method: "PUT",
        body: JSON.stringify({ read: !m.read }),
      });
      setData((d) => ({
        ...d,
        unread: d.unread + (m.read ? 1 : -1),
        items: d.items.map((x) => (x._id === m._id ? { ...x, read: !m.read } : x)),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (m) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    try {
      await apiFetch(`/dashboard/${tourId}/messages/${m._id}`, { method: "DELETE" });
      // If we just emptied the current page, step back one; otherwise refresh.
      if (data.items.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
        Visitor messages
        {data?.unread > 0 && (
          <span className="bg-teal-600/20 border border-teal-600 text-teal-300 text-xs font-normal rounded-full px-2 py-0.5">
            {data.unread} new
          </span>
        )}
        {data?.total > 0 && (
          <span className="text-gray-500 font-normal">({data.total})</span>
        )}
      </h3>
      {(q || (data && data.total > 0)) && (
        <input
          className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs mb-3 focus:outline-none focus:border-teal-500"
          placeholder="Search messages by sender or text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!data ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-600 text-sm">
          {q
            ? `No messages match “${q}”.`
            : "No messages yet. Visitors can write to you from the tour."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((m) => (
            <li
              key={m._id}
              className={`text-xs border rounded-lg p-3 ${
                m.read
                  ? "border-gray-800 bg-gray-900"
                  : "border-teal-800/60 bg-teal-950/20"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                {!m.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                )}
                <span className="text-gray-200 font-medium">{m.name}</span>
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="text-teal-400 hover:text-teal-300"
                  >
                    {m.email}
                  </a>
                )}
                <span className="text-gray-600 ml-auto">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-300 whitespace-pre-wrap break-words">
                {m.body}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => toggleRead(m)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  {m.read ? "Mark as unread" : "Mark as read"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="text-gray-600 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}

function SubscriptionCard({ sub }) {
  if (!sub) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white text-sm font-semibold mb-2">Subscription</h3>
        <p className="text-gray-500 text-sm">No subscription on record.</p>
      </div>
    );
  }
  const daysLeft = Math.ceil((new Date(sub.expiresAt) - Date.now()) / 86400000);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-white text-sm font-semibold mb-3">Subscription</h3>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Plan</span>
          <span className="text-gray-200 capitalize">{sub.plan}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Status</span>
          {sub.isActive ? (
            <span className="text-emerald-400">● Active</span>
          ) : (
            <span className="text-red-400">
              ● {sub.status === "canceled" ? "Canceled" : "Expired"}
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Renewed</span>
          <span className="text-gray-200">{fmtDate(sub.startedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">
            {sub.isActive ? "Expires" : "Expired"}
          </span>
          <span className={daysLeft <= 7 ? "text-amber-400" : "text-gray-200"}>
            {fmtDate(sub.expiresAt)}
            {sub.isActive && daysLeft >= 0 && ` (${daysLeft}d)`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard body ───────────────────────────────────────────────────────────

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function Dashboard({ tourId, me, onLogout, onChangePassword }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState(null);
  const [sessPage, setSessPage] = useState(1);
  const [sessions, setSessions] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = new Date(Date.now() - (rangeDays - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      setData(await apiFetch(`/dashboard/${tourId}?from=${from}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tourId, rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  // Recent visits are paginated server-side, independent of the range filter
  useEffect(() => {
    apiFetch(`/dashboard/${tourId}/sessions?page=${sessPage}&limit=10`)
      .then(setSessions)
      .catch(() => {}); // main error state is owned by the dashboard load
  }, [tourId, sessPage]);

  // Fill the requested range with zero-days so the chart has a continuous axis
  const chartDays = useMemo(() => {
    if (!data) return [];
    const byDate = new Map(data.days.map((d) => [d.date, d]));
    const out = [];
    const start = new Date(`${data.range.from}T00:00:00Z`);
    const end = new Date(`${data.range.to}T00:00:00Z`);
    for (let t = start; t <= end; t = new Date(t.getTime() + 86400000)) {
      const iso = t.toISOString().slice(0, 10);
      out.push(
        byDate.get(iso) || { date: iso, uniqueVisitors: 0, sessions: 0 },
      );
    }
    return out;
  }, [data]);

  const barRows = useMemo(() => {
    if (!data) return { scenes: [], hotspots: [], popups: [], paths: [] };
    const { totals, labels } = data;
    // Full ranked lists — BarList paginates them client-side
    const top = (obj, mapLabel) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(([key, value]) => ({ key, value, label: mapLabel(key) }));

    return {
      scenes: top(totals.nodeViews, (id) => labels.nodes[id] || id),
      hotspots: top(totals.hotspotClicks, (id) => {
        const h = labels.hotspots[id];
        return h ? `${h.fromNode} → ${h.toNode}` : id;
      }),
      popups: top(totals.popupOpens, (id) => {
        const s = labels.signs[id];
        return s ? `${s.title} (${s.node})` : id;
      }),
      paths: top(totals.transitions, (key) => {
        const [from, to] = key.split(">");
        return `${labels.nodes[from] || from} → ${labels.nodes[to] || to}`;
      }),
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-white text-sm underline"
        >
          Sign in with a different account
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-white font-bold">
            gate<span className="text-teal-400">verse</span>
            <span className="text-gray-100 font-normal text-sm ml-3">
              {data.tour.title}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href={`/tour/${tourId}`}
            target="_blank"
            rel="noreferrer"
            className="text-teal-400 hover:text-teal-300"
          >
            Open tour ↗
          </a>
          <button
            onClick={onChangePassword}
            className="text-gray-400 hover:text-white"
          >
            Change password
          </button>
          <span className="text-gray-100">{me?.name}</span>
          <button onClick={onLogout} className="text-gray-300 hover:text-white">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Range filter */}
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                rangeDays === r.days
                  ? "bg-teal-600/20 border-teal-600 text-teal-300"
                  : "border-gray-800 text-gray-400 hover:border-gray-600"
              }`}
            >
              {r.label}
            </button>
          ))}
          {loading && (
            <span className="text-gray-600 text-xs ml-2">Refreshing…</span>
          )}
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Unique visitors"
            value={data.totals.uniqueVisitors}
          />
          <StatTile label="Sessions" value={data.totals.sessions} />
          <StatTile
            label="Hotspot clicks"
            value={Object.values(data.totals.hotspotClicks).reduce(
              (a, b) => a + b,
              0,
            )}
          />
          <StatTile
            label="Popup opens"
            value={Object.values(data.totals.popupOpens).reduce(
              (a, b) => a + b,
              0,
            )}
          />
        </div>

        {/* Daily chart + subscription */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white text-sm font-semibold mb-3">
              Daily traffic
            </h3>
            <DailyChart days={chartDays} />
          </div>
          <SubscriptionCard sub={data.subscription} />
        </div>

        {/* Engagement tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarList
            title="Most viewed scenes"
            rows={barRows.scenes}
            emptyText="No scene views yet."
          />
          <BarList
            title="Hotspot clicks"
            rows={barRows.hotspots}
            emptyText="No hotspot clicks yet."
          />
          <BarList
            title="Info popup opens"
            rows={barRows.popups}
            emptyText="No popup opens yet."
          />
          <BarList
            title="Popular navigation paths"
            rows={barRows.paths}
            emptyText="No navigation yet."
          />
        </div>

        {/* Visitor messages */}
        <MessagesCard tourId={tourId} />

        {/* Recent sessions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white text-sm font-semibold mb-3">
            Recent visits
            {sessions.total > 0 && (
              <span className="text-gray-500 font-normal ml-2">
                ({sessions.total})
              </span>
            )}
          </h3>
          {sessions.items.length === 0 ? (
            <p className="text-gray-600 text-sm">No visits recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.items.map((s) => (
                <li
                  key={s._id}
                  className="text-xs border-b border-gray-800 last:border-0 pb-3 last:pb-0"
                >
                  <div className="text-gray-500 mb-1">
                    {new Date(s.startedAt).toLocaleString()} · {s.events} events
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-gray-300">
                    {(s.path || []).map((nodeId, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-600">→</span>}
                        <span className="bg-gray-800 rounded px-1.5 py-0.5">
                          {data.labels.nodes[nodeId] || nodeId}
                        </span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager page={sessions.page} pages={sessions.pages} onPage={setSessPage} />
        </div>
      </main>
    </div>
  );
}

// ─── Page shell: login → forced password change → dashboard ──────────────────

// tourId comes from the route (app/dashboard/[tourId]).
export default function DashboardPage({ tourId }) {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    // Admin handoff: the admin panel links here with its JWT in the URL hash
    // (#token=...). The hash never reaches any server; consume it, store it
    // as this app's session and strip it from the address bar. The server
    // still decides what the token may access (canAccessTour allows admins).
    const hashMatch = window.location.hash.match(/[#&]token=([^&]+)/);
    if (hashMatch) {
      localStorage.setItem(TOKEN_KEY, decodeURIComponent(hashMatch[1]));
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return setChecking(false);
    apiFetch("/auth/me")
      .then(setMe)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, []);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setMe(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!me) return <LoginForm onLogin={setMe} />;

  if (me.mustChangePassword || changingPassword) {
    return (
      <ChangePasswordForm
        forced={me.mustChangePassword}
        onDone={() => {
          setMe({ ...me, mustChangePassword: false });
          setChangingPassword(false);
        }}
        onCancel={() => setChangingPassword(false)}
      />
    );
  }

  return (
    <Dashboard
      tourId={tourId}
      me={me}
      onLogout={logout}
      onChangePassword={() => setChangingPassword(true)}
    />
  );
}
