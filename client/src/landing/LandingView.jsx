'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  STRINGS,
  PORTFOLIO,
  CONTACT,
  VIEWER_URL,
  waLink,
} from './content.js';

// WebGL — client-only, loaded when a globe scrolls into view
const GlobeCanvas = dynamic(() => import('./GlobeCanvas.jsx'), { ssr: false });

const DEMO_TOUR_URL = `${VIEWER_URL}/tour/${PORTFOLIO[0].id}`;

/* ---------------------------------- utils --------------------------------- */

function useInView(margin = '120px') {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { rootMargin: margin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);
  return [ref, inView];
}

/** Fade-up on first scroll into view */
function Reveal({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView('-40px');
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-2/3 aspect-square rounded-full bg-gradient-to-br from-brand/20 to-transparent animate-pulse" />
    </div>
  );
}

function SectionHeading({ eyebrow, title, sub }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-brand text-sm font-semibold tracking-[0.25em] uppercase mb-3">
        {eyebrow}
      </p>
      <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">{title}</h2>
      {sub && <p className="mt-4 text-gray-400 text-lg leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2 select-none">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="8" fill="none" stroke="#10c9b7" strokeWidth="2.5" />
        <ellipse
          cx="14"
          cy="14"
          rx="13"
          ry="5"
          fill="none"
          stroke="#3ef0dd"
          strokeWidth="1.2"
          opacity="0.7"
          transform="rotate(-18 14 14)"
        />
        <circle cx="24.5" cy="9.5" r="1.8" fill="#3ef0dd" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-white">
        gate<span className="text-brand">verse</span>
      </span>
    </span>
  );
}

const ArrowSvg = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    className="rtl:-scale-x-100"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const WhatsAppSvg = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.49 9 9 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 9.88 9.9c0 5.45-4.44 9.88-9.89 9.88zm8.42-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.47-8.4z" />
  </svg>
);

/* --------------------------------- sections -------------------------------- */

function Navbar({ t }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    ['#portfolio', t.nav.portfolio],
    ['#why', t.nav.why],
    ['#pricing', t.nav.pricing],
    ['#testimonials', t.nav.testimonials],
    ['#contact', t.nav.contact],
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-ink-950/85 backdrop-blur-md border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" aria-label="Gateverse home">
          <Logo />
        </a>
        <div className="hidden md:flex items-center gap-7 text-sm text-gray-300">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-brand transition-colors">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={t.langHref}
            className="text-sm text-gray-300 hover:text-white border border-white/15 rounded-full
                       px-3 py-1.5 transition-colors"
            aria-label="Switch language"
          >
            {t.langButton}
          </a>
          <a
            href={waLink(t.dir === 'rtl' ? 'ar' : 'en')}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-ink-950 bg-brand
                       hover:bg-brand-bright rounded-full px-4 py-1.5 transition-colors"
          >
            <WhatsAppSvg size={15} />
            {t.nav.cta}
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero({ t, lang }) {
  const [globeRef, globeInView] = useInView();
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 70% 40%, rgba(16,201,183,0.14) 0%, transparent 70%), radial-gradient(40% 40% at 20% 80%, rgba(16,201,183,0.07) 0%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-10 pb-16 lg:pt-16 lg:pb-24 grid lg:grid-cols-2 gap-10 items-center">
        <div className="order-2 lg:order-1">
          <Reveal>
            <p className="text-brand text-sm font-semibold tracking-[0.25em] uppercase mb-4">
              {t.hero.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-[1.08]">
              {t.hero.title1}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-bright">
                {t.hero.title2}
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-gray-400 text-lg leading-relaxed max-w-xl">{t.hero.sub}</p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={waLink(lang)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand hover:bg-brand-bright
                           text-ink-950 font-bold px-7 py-3.5 transition-all hover:shadow-[0_0_35px_rgba(16,201,183,0.45)]"
              >
                <WhatsAppSvg />
                {t.hero.ctaBook}
              </a>
              <a
                href={DEMO_TOUR_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 hover:border-brand
                           text-white font-semibold px-7 py-3.5 transition-colors"
              >
                {t.hero.ctaDemo}
                <ArrowSvg />
              </a>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <dl className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl">
              {t.hero.stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl font-extrabold text-white">{s.value}</dd>
                  <dd className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <div
          ref={globeRef}
          className="order-1 lg:order-2 relative h-[320px] sm:h-[420px] lg:h-[560px]"
        >
          {globeInView && (
            <Suspense fallback={<GlobeFallback />}>
              <GlobeCanvas textureUrl="/panos/hero.webp" particles />
            </Suspense>
          )}
          <p className="absolute bottom-1 inset-x-0 text-center text-xs text-gray-500 tracking-widest uppercase pointer-events-none">
            ↔ {t.hero.dragHint}
          </p>
        </div>
      </div>
    </section>
  );
}

function Why({ t }) {
  return (
    <section id="why" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28">
      <SectionHeading eyebrow={t.why.eyebrow} title={t.why.title} sub={t.why.sub} />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {t.why.cards.map((c, i) => (
          <Reveal key={c.title} delay={(i % 3) * 80}>
            <div
              className="h-full rounded-2xl border border-white/8 bg-ink-800/60 p-7
                         hover:border-brand/40 hover:bg-ink-700/50 transition-colors group"
            >
              <div
                className="w-10 h-10 rounded-xl bg-brand-faint flex items-center justify-center mb-5
                           text-brand font-extrabold group-hover:scale-110 transition-transform"
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="text-white font-bold text-xl">{c.title}</h3>
              <p className="mt-3 text-gray-400 leading-relaxed">{c.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PortfolioCard({ item, t, lang, index }) {
  const [ref, inView] = useInView();
  return (
    <Reveal delay={index * 100}>
      <div
        ref={ref}
        className="rounded-3xl border border-white/8 bg-ink-800/50 overflow-hidden
                   hover:border-brand/40 transition-colors"
      >
        <div className="relative h-64 sm:h-72">
          {inView && (
            <Suspense fallback={<GlobeFallback />}>
              <GlobeCanvas textureUrl={item.texture} />
            </Suspense>
          )}
        </div>
        <div className="p-6 pt-2">
          <h3 className="text-white font-bold text-lg">{item.title[lang]}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags[lang].map((tag) => (
              <span key={tag} className="text-xs text-brand bg-brand-faint rounded-full px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
          <a
            href={`${VIEWER_URL}/tour/${item.id}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 font-bold text-ink-950 bg-brand
                       hover:bg-brand-bright rounded-full px-5 py-2.5 transition-colors text-sm"
          >
            {t.portfolio.walkIn}
            <ArrowSvg />
          </a>
        </div>
      </div>
    </Reveal>
  );
}

function Portfolio({ t, lang }) {
  return (
    <section id="portfolio" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28">
      <SectionHeading eyebrow={t.portfolio.eyebrow} title={t.portfolio.title} sub={t.portfolio.sub} />
      <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl">
        {PORTFOLIO.map((item, i) => (
          <PortfolioCard key={item.id} item={item} t={t} lang={lang} index={i} />
        ))}
      </div>
    </section>
  );
}

function Testimonials({ t }) {
  return (
    <section
      id="testimonials"
      className="relative py-20 lg:py-28 bg-ink-900/60 border-y border-white/5"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow={t.testimonials.eyebrow} title={t.testimonials.title} />
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {t.testimonials.items.map((item, i) => (
            <Reveal key={item.role} delay={i * 100}>
              <figure
                className="h-full rounded-2xl border border-white/8 bg-ink-800/60 p-7 flex flex-col
                           hover:border-brand/40 transition-colors"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="#10c9b7"
                  className="mb-4 opacity-70 rtl:-scale-x-100"
                  aria-hidden="true"
                >
                  <path d="M10 7H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4V9a2 2 0 0 0 0-2zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4V9a2 2 0 0 0 0-2z" />
                </svg>
                <blockquote className="text-gray-200 leading-relaxed flex-1">
                  {item.quote}
                </blockquote>
                <figcaption className="mt-5 pt-5 border-t border-white/8">
                  <p className="text-white font-semibold text-sm">{item.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{item.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ t, lang }) {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28">
      <SectionHeading eyebrow={t.pricing.eyebrow} title={t.pricing.title} sub={t.pricing.sub} />
      <div className="mt-12 grid md:grid-cols-3 gap-6 items-stretch">
        {t.pricing.packages.map((p, i) => (
          <Reveal key={p.name} delay={i * 100} className="h-full">
            <div
              className={`relative h-full rounded-3xl p-8 flex flex-col border transition-colors ${
                p.featured
                  ? 'border-brand bg-gradient-to-b from-brand/10 to-ink-800/60 shadow-[0_0_45px_rgba(16,201,183,0.15)]'
                  : 'border-white/8 bg-ink-800/50 hover:border-brand/40'
              }`}
            >
              {p.featured && (
                <span
                  className="absolute -top-3.5 start-8 text-xs font-bold text-ink-950 bg-brand
                             rounded-full px-4 py-1.5"
                >
                  {t.pricing.popular}
                </span>
              )}
              <p className="text-gray-400 text-sm">{p.tagline}</p>
              <h3 className="mt-1 text-white font-extrabold text-2xl">{p.name}</h3>
              <p className="mt-4 text-4xl font-extrabold text-brand">{p.price}</p>
              <ul className="mt-7 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-gray-300 text-sm leading-relaxed">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10c9b7"
                      strokeWidth="3"
                      className="mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M4 12l6 6L20 6" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={waLink(lang, WA_PACKAGE_MSG[lang](p.name))}
                target="_blank"
                rel="noreferrer"
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full font-bold px-6 py-3.5 transition-colors ${
                  p.featured
                    ? 'bg-brand hover:bg-brand-bright text-ink-950'
                    : 'border border-white/20 hover:border-brand text-white'
                }`}
              >
                <WhatsAppSvg size={16} />
                {t.pricing.cta}
              </a>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}>
        <div className="mt-10 text-center space-y-2">
          <p className="text-gray-400">{t.pricing.hostingNote}</p>
          <p className="text-gray-500 text-sm">
            <a href={waLink(lang)} target="_blank" rel="noreferrer" className="text-brand hover:text-brand-bright transition-colors">
              {t.pricing.customNote}
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}

// A message that ends with a question gets answered faster — and feels lighter to send.
const WA_PACKAGE_MSG = {
  en: (name) => `Hi Gateverse! I'd like to book the "${name}" package. What's the next available shoot date?`,
  ar: (name) => `أهلًا جيت ڤيرس! عايز أحجز باقة «${name}». إمتى أقرب معاد تصوير؟`,
};

function How({ t }) {
  return (
    <section id="how" className="relative py-20 lg:py-28 bg-ink-900/60 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow={t.how.eyebrow} title={t.how.title} />
        <div className="mt-14 grid md:grid-cols-3 gap-10">
          {t.how.steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="relative">
                <span className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-brand/60 to-transparent">
                  {s.n}
                </span>
                <h3 className="mt-3 text-white font-bold text-xl">{s.title}</h3>
                <p className="mt-3 text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sectors({ t }) {
  return (
    <section id="sectors" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 lg:py-28">
      <SectionHeading eyebrow={t.sectors.eyebrow} title={t.sectors.title} />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {t.sectors.items.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <div
              className="h-full rounded-2xl border border-white/8 p-6 bg-gradient-to-b from-ink-800/70 to-transparent
                         hover:border-brand/40 transition-colors"
            >
              <h3 className="text-white font-bold">{s.title}</h3>
              <p className="mt-2.5 text-gray-400 text-sm leading-relaxed">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ContactCta({ t, lang }) {
  return (
    <section id="contact" className="relative overflow-hidden py-24 lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 100%, rgba(16,201,183,0.16) 0%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <Reveal>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white">{t.cta.title}</h2>
          <p className="mt-5 text-gray-400 text-lg">{t.cta.sub}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <a
              href={waLink(lang)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full bg-brand hover:bg-brand-bright text-ink-950 font-bold px-8 py-4
                         transition-all hover:shadow-[0_0_35px_rgba(16,201,183,0.45)]"
            >
              <WhatsAppSvg size={20} />
              {t.cta.whatsapp}
            </a>
            <a
              href={`mailto:${CONTACT.email}?subject=Gateverse%20shoot%20request`}
              className="rounded-full border border-white/20 hover:border-brand text-white font-semibold px-8 py-4 transition-colors"
            >
              {t.cta.email}
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">
            {CONTACT.location[lang]}
            {t.cta.reply && <> · {t.cta.reply}</>}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer({ t }) {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-gray-500 text-sm">{t.footer.tagline}</p>
        <p className="text-gray-600 text-xs">{t.footer.rights}</p>
      </div>
    </footer>
  );
}

/* ----------------------------------- view ---------------------------------- */

export default function LandingView({ lang = 'en' }) {
  const t = STRINGS[lang];

  return (
    <div
      dir={t.dir}
      lang={lang}
      className={`min-h-screen bg-ink-950 ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`}
    >
      <Navbar t={t} />
      <main>
        <Hero t={t} lang={lang} />
        <Why t={t} />
        <Portfolio t={t} lang={lang} />
        <Testimonials t={t} />
        <Pricing t={t} lang={lang} />
        <How t={t} />
        <Sectors t={t} />
        <ContactCta t={t} lang={lang} />
      </main>
      <Footer t={t} />
    </div>
  );
}
