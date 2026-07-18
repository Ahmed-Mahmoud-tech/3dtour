import { useState } from "react";
import axios from "axios";
import { FaKey, FaSyncAlt, FaTimes } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Self-service password change for the logged-in staff account (admin or
// employee) via PUT /api/auth/password. When `forced` (mustChangePassword
// after an admin reset) the modal can't be dismissed until it succeeds.
export default function ChangePasswordModal({ forced = false, onClose }) {
  const { updateUser, adoptToken } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await axios.put(`${API_BASE}/auth/password`, {
        currentPassword: form.current,
        newPassword: form.next,
      });
      // The change invalidated the old token — switch to the re-issued one
      adoptToken(data.token);
      updateUser({ mustChangePassword: false });
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={forced ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="admin-card max-w-sm w-full flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FaKey size={13} className="text-blue-400" />
            Change password
          </h2>
          {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <FaTimes size={14} />
            </button>
          )}
        </div>

        {forced && (
          <p className="text-amber-400/90 text-xs">
            Your password was reset by an administrator. Please choose a new
            one to continue.
          </p>
        )}

        <div>
          <label className="admin-label">Current password</label>
          <input
            autoFocus
            className="admin-input"
            type="password"
            autoComplete="current-password"
            required
            value={form.current}
            onChange={set("current")}
          />
        </div>
        <div>
          <label className="admin-label">New password</label>
          <input
            className="admin-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Min 8 characters…"
            value={form.next}
            onChange={set("next")}
          />
        </div>
        <div>
          <label className="admin-label">Confirm new password</label>
          <input
            className="admin-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="admin-btn-secondary"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="admin-btn-primary flex items-center gap-2"
          >
            {submitting && <FaSyncAlt size={12} className="animate-spin" />}
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}
