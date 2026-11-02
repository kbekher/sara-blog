import type { NextConfig } from "next";

/** Baseline security headers for every response ("CSP-lite": no script/style policy, which would need nonces). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
  },
];

/** The admin must never be framed or indexed. (Later rules override earlier ones for the same key.) */
const adminHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      // Long posts are saved as Tiptap JSON in one action call.
      bodySizeLimit: "4mb",
    },
    // app/global-not-found.tsx: 404 for unmatched URLs (two root layouts — (site) and admin — and no app/layout.tsx).
    globalNotFound: true,
  },
  /**
   * The site used to live under /ru, /uk and /en. It is Russian-only now (readers use browser translation),
   * so old links and search results are permanently redirected to the unprefixed URLs:
   * /ru → /, /en/posts/x → /posts/x, /uk/rss.xml → /rss.xml, … (query strings are kept).
   */
  async redirects() {
    return [
      { source: "/:lang(ru|uk|en)", destination: "/", permanent: true },
      { source: "/:lang(ru|uk|en)/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
