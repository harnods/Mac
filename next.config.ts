import type { NextConfig } from "next";

// In dev, the app talks to the local Supabase stack (http://127.0.0.1:54321),
// which the production CSP (*.supabase.co only) would block. Allow it in dev only.
const isDev = process.env.NODE_ENV !== "production";
const devSupabase = (() => {
  if (!isDev || !process.env.NEXT_PUBLIC_SUPABASE_URL) return "";
  const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (u.hostname.endsWith(".supabase.co")) return "";
  return ` ${u.origin} ${u.origin.replace(/^http/, "ws")}`;
})();

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): allow the app's OWN origin to use the browser
  // geolocation API (attendance geofence / require_location depends on it);
  // third-party iframes stay blocked. "geolocation=()" disabled it for
  // everyone — including us — which broke clock in/out.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob: https://*.supabase.co${devSupabase}`,
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.envoy.mekari.com https://envoy.mekari.com${devSupabase}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["machitori.local"],
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
