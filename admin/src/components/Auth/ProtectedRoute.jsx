import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Lazy: only renders in the rare forced-password-change flow, and its
// react-icons import would otherwise drag the icon bundle into the entry.
const ChangePasswordModal = lazy(() => import('./ChangePasswordModal.jsx'));

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/projects" replace />;

  // After an admin resets a staff password, block the app until it's changed.
  return (
    <>
      {children}
      {user.mustChangePassword && (
        <Suspense fallback={null}>
          <ChangePasswordModal forced />
        </Suspense>
      )}
    </>
  );
}
