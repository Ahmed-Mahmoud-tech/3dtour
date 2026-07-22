import LandingView from '../src/landing/LandingView.jsx';
import Analytics from '../src/landing/Analytics.jsx';
import { businessJsonLd } from '../src/landing/content.js';

export const metadata = {
  title: 'Gateverse — Cinematic 360° Virtual Tours in Egypt',
  description:
    "Don't send photos — let them walk in. Cinematic 360° tours filmed as real walk-throughs, never stitched, for real estate, wedding venues, hotels and cafés in Alexandria and the North Coast. Live in 48 hours — one link, no app.",
  keywords: [
    'virtual tour Egypt',
    '360 tour Alexandria',
    'cinematic virtual tour',
    'real estate virtual tour Egypt',
    'Matterport alternative Egypt',
  ],
  alternates: {
    canonical: '/',
    languages: { en: '/', ar: '/ar' },
  },
  openGraph: {
    title: 'Gateverse — Cinematic 360° Virtual Tours',
    description:
      "Don't send photos. Let them walk in. Filmed 360° walk-throughs for real estate, venues and hotels — live in 48 hours.",
    url: '/',
    siteName: 'Gateverse',
    locale: 'en_US',
    type: 'website',
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <LandingView lang="en" />
      <Analytics />
    </>
  );
}
