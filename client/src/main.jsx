import React from 'react';
import ReactDOM from 'react-dom/client';
import TourPage from './views/TourPage.jsx';
import '../app/globals.css';

// Entry point of the SELF-HOSTED STATIC PLAYER ONLY (vite build → dist-static,
// zipped by the admin export). The hosted site — landing, /tour/:id viewer,
// /dashboard/:id — is the Next.js app (app/); this file is not part of it.
// No router: the whole page IS the tour, loaded from ./tour.json (projectId
// is irrelevant — useTour ignores it when NEXT_PUBLIC_STATIC_TOUR is set).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="h-dvh w-full overflow-hidden bg-black">
      <TourPage projectId={null} />
    </div>
  </React.StrictMode>
);
