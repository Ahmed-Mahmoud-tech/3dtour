import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TourPage from './pages/TourPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* /tour/:projectId — main viewer route */}
        <Route path="/tour/:projectId" element={<TourPage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route
          path="/"
          element={
            <div className="flex h-full items-center justify-center text-white text-xl">
              No tour selected. Navigate to <code className="mx-2">/tour/:projectId</code>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
