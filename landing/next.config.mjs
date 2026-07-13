/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pure static export: every page is pre-rendered to plain HTML at build
  // time — the strongest possible baseline for SEO crawlers. Deploy /out
  // to any static host or serve it from nginx at the domain root.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
