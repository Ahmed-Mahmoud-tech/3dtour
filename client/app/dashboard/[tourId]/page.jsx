import DashboardClient from './DashboardClient.jsx';

export const metadata = {
  title: 'Owner Dashboard',
  robots: { index: false },
};

export default function Page({ params }) {
  return <DashboardClient tourId={params.tourId} />;
}
