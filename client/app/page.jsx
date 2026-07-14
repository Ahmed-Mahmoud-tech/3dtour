import LandingView from '../src/landing/LandingView.jsx';
import { businessJsonLd } from '../src/landing/content.js';

export const metadata = {
  title: 'Gateverse — Cinematic 360° Virtual Tours in Egypt',
  description:
    "Don't show photos — let them walk in. Filmed 360° walk-through tours for real estate, wedding venues, hotels and cafés in Alexandria, Egypt. Live in 48 hours, shared with one link or QR code.",
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
      "Don't show photos. Let them walk in. Filmed 360° walk-throughs for real estate, venues and hotels.",
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
    </>
  );
}
