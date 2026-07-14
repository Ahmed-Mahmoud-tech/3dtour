import TourClient from './TourClient.jsx';

// Generic title on purpose — tour titles aren't public until the project
// loads, and the viewer is an app screen, not a marketing page.
export const metadata = {
  title: '360° Tour',
  robots: { index: false },
};

export default function Page({ params }) {
  return <TourClient projectId={params.projectId} />;
}
