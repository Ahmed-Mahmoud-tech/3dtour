import { useState } from "react";
import { FaKey, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import NotificationBell from "../ui/NotificationBell.jsx";

// Right side of every page header: user name, self-service password change,
// sign out. Used by admins and employees alike. The notification bell is
// admin-only (its API routes are adminOnly).
export default function AccountControls() {
  const { user, logout } = useAuth();
  const [changing, setChanging] = useState(false);

  return (
    <div className="flex items-center gap-4">
      {user?.role === "admin" && <NotificationBell />}
      <span className="text-gray-400 text-sm">{user?.name}</span>
      <button
        onClick={() => setChanging(true)}
        className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors"
        title="Change your password"
      >
        <FaKey size={13} />
        Password
      </button>
      <button
        onClick={logout}
        className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors"
      >
        <FaSignOutAlt size={14} />
        Sign out
      </button>

      {changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
    </div>
  );
}
