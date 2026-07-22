'use client';

import Script from 'next/script';
import { useEffect } from 'react';

// Marketing/conversion tracking for the landing pages only (NOT the tour viewer
// or the owner dashboard — this component is mounted from app/page.jsx and
// app/ar/page.jsx, never the root layout). Both providers are opt-in: set the
// IDs in the environment and they load; leave them blank and nothing is emitted.
//   NEXT_PUBLIC_GA_ID        — Google Analytics 4 measurement id, e.g. G-XXXXXXXXXX
//   NEXT_PUBLIC_FB_PIXEL_ID  — Meta (Facebook) Pixel id, e.g. 1234567890123456
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export default function Analytics() {
  // Every WhatsApp CTA on the page is a conversion. Delegated at the document
  // level so any current or future wa.me link counts without wiring each anchor.
  useEffect(() => {
    if (!GA_ID && !FB_PIXEL_ID) return undefined;
    const onClick = (e) => {
      const link = e.target.closest?.('a[href*="wa.me/"]');
      if (!link) return;
      if (window.fbq) window.fbq('track', 'Lead', { content_name: 'whatsapp_click' });
      if (window.gtag) window.gtag('event', 'generate_lead', { method: 'whatsapp' });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}

      {FB_PIXEL_ID && (
        <>
          <Script id="fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${FB_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
