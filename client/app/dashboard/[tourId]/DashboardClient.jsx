'use client';

import dynamic from 'next/dynamic';

// Client-only: reads localStorage tokens and the #token= URL hash on mount
// (admin handoff), so it must never be server-rendered. Also keeps the chart
// code out of every other route's payload — same role the old lazy() had.
const DashboardPage = dynamic(() => import('../../../src/views/DashboardPage.jsx'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-700 border-t-teal-500 rounded-full animate-spin" />
    </div>
  ),
});

export default function DashboardClient({ tourId }) {
  return <DashboardPage tourId={tourId} />;
}
