import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TourPage from './pages/TourPage.jsx';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ViewerHome />} />
        {/* /tour/:projectId — main viewer route */}
        <Route path="/tour/:projectId" element={<TourPage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
