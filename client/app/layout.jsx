import { Manrope, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { SITE_URL } from '../src/landing/content.js';
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexArabic.variable}`}>
      <body>{children}</body>
    </html>
  );
}
