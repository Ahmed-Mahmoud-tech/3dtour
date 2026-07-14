'use client';

import dynamic from 'next/dynamic';

// The whole viewer is WebGL + browser APIs — client-only, never SSR'd. This
// dynamic() boundary also keeps three.js out of the landing's JS payload.
// (src/views, not src/pages — a src/pages dir would be claimed by Next's
// pages router and built as routes.)
const TourPage = dynamic(() => import('../../../src/views/TourPage.jsx'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  ),
});

export default function TourClient({ projectId }) {
  // The viewer expects a full-height ancestor (it uses h-full internally);
  // in the old SPA that came from html/body/#root CSS, here we set it locally
  // so the landing pages keep normal document scrolling.
  return (
    <div className="h-dvh w-full overflow-hidden bg-black">
      <TourPage projectId={projectId} />
    </div>
  );
}
