import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import TourPage from './pages/TourPage.jsx';

// Owner dashboard is code-split — visitors loading a tour never pay for it.
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));

// The marketing site lives in the separate landing/ Next.js package.
// In production it is served at the domain root; this app only owns /tour/*.
const LANDING_URL = import.meta.env.VITE_LANDING_URL || 'http://localhost:3000';

function ViewerHome() {
  return (
    <div className="flex h-full flex-col gap-3 items-center justify-center text-white">
      <p className="text-xl">
        gate<span className="text-teal-400">verse</span> viewer — open a tour link
        (<code className="mx-1">/tour/:projectId</code>)
      </p>
      <a href={LANDING_URL} className="text-teal-400 underline text-sm">
        Go to the Gateverse website
      </a>
    </div>
  );
}

// Static export build: the whole app IS the tour — no landing, no dashboard.
const IS_STATIC = import.meta.env.VITE_STATIC_TOUR === '1';

export default function App() {
  if (IS_STATIC) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<TourPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ViewerHome />} />
        {/* /tour/:projectId — main viewer route */}
        <Route path="/tour/:projectId" element={<TourPage />} />
        {/* /dashboard/:tourId — tour-owner analytics (login-gated inside) */}
        <Route
          path="/dashboard/:tourId"
          element={
            <Suspense fallback={null}>
              <DashboardPage />
            </Suspense>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
