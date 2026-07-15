import { useEffect, useRef, useState, useCallback } from "react";
import { FaBell, FaCheckDouble, FaTrash } from "react-icons/fa";
import { adminApi } from "../../api/adminApi.js";

const POLL_MS = 60 * 1000;

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};

// Header bell for platform admins: unread badge polled every minute,
// dropdown with the latest subscription-expiry notifications.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const refresh = useCallback(async (withList) => {
    try {
      const data = await adminApi.listNotifications({ limit: withList ? 15 : 1 });
      setUnread(data.unread);
      if (withList) setItems(data.items);
    } catch {
      /* badge polling failures stay silent */
    }
  }, []);

  // Badge poll
  useEffect(() => {
    refresh(false);
    const id = setInterval(() => refresh(false), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Load the list when the panel opens; close on outside click
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refresh(true).finally(() => setLoading(false));

    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, refresh]);

  const markRead = async (n) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(u - 1, 0));
    try {
      await adminApi.setNotificationRead(n._id);
    } catch {
      refresh(true);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await adminApi.markAllNotificationsRead();
    } catch {
      refresh(true);
    }
  };

  const remove = async (e, n) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x._id !== n._id));
    if (!n.read) setUnread((u) => Math.max(u - 1, 0));
    try {
      await adminApi.deleteNotification(n._id);
    } catch {
      refresh(true);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-gray-500 hover:text-white transition-colors"
        title="Notifications"
      >
        <FaBell size={15} />
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-96 max-w-[90vw] bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <FaCheckDouble size={11} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">
                No notifications
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n._id}
                  onClick={() => markRead(n)}
                  className={`group px-4 py-3 border-b border-gray-800 last:border-b-0 cursor-pointer hover:bg-gray-800/60 transition-colors ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium leading-snug">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-600 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => remove(e, n)}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                      title="Delete"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
