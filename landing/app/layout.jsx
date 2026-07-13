import { Manrope, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { SITE_URL, WHATSAPP_NUMBER, CONTACT } from '../components/content.js';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Gateverse — Cinematic 360° Virtual Tours',
    template: '%s | Gateverse',
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='8' fill='none' stroke='%2310c9b7' stroke-width='2.5'/%3E%3Cellipse cx='14' cy='14' rx='13' ry='5' fill='none' stroke='%233ef0dd' stroke-width='1.2' opacity='0.7' transform='rotate(-18 14 14)'/%3E%3Ccircle cx='24.5' cy='9.5' r='1.8' fill='%233ef0dd'/%3E%3C/svg%3E",
        type: 'image/svg+xml',
      },
    ],
  },
};

// Structured data: tells Google exactly what the business is, where it
// operates, and what it sells — this powers rich results and Maps relevance.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#business`,
  name: 'Gateverse',
  description:
    'Cinematic 360° virtual tours — filmed walk-throughs for real estate, wedding venues, hotels, cafés and schools.',
  url: SITE_URL,
  email: CONTACT.email,
  telephone: `+${WHATSAPP_NUMBER}`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Alexandria',
    addressCountry: 'EG',
  },
  areaServed: ['Alexandria', 'North Coast', 'Egypt'],
  priceRange: 'EGP',
  knowsLanguage: ['ar', 'en'],
  makesOffer: [
    {
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: '360° photo virtual tour (Essential)' },
      priceCurrency: 'EGP',
      price: '4900',
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Cinematic 360° virtual tour with filmed walk-through transitions',
      },
      priceCurrency: 'EGP',
      price: '12900',
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Signature 360° virtual tour — large & multi-floor spaces, Google Maps publishing',
      },
      priceCurrency: 'EGP',
      price: '19900',
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexArabic.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
