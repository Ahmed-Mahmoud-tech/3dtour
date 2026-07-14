/** @type {import('next').NextConfig} */

// Where the Express API lives. In dev that's the local server; in production
// you can either keep these rewrites (single `next start` process proxies to
// the API) or strip them and route /api + /uploads at the nginx level.
const SERVER_ORIGIN = process.env.SERVER_ORIGIN || 'http://localhost:5000';

const nextConfig = {
  // The landing pages (/ and /ar) are server-prerendered at build time — same
  // SEO baseline the old static-export landing package had. The viewer and
  // dashboard routes are client-only (WebGL / token-gated) and skip SSR via
  // next/dynamic. NOTE: the self-hosted tour export does NOT come from this
  // build — it's the separate relative-path Vite build (npm run build:static),
  // which Next can't produce (no relative assetPrefix support).
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${SERVER_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${SERVER_ORIGIN}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
