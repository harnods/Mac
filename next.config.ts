import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["machitori.local"],
  compress: true,
  images: {
    // Product photos live in Supabase Storage; let next/image resize + serve
    // WebP/AVIF per device (big win on mobile).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Keep already-rendered pages in the client router cache so navigating
    // back to a visited page is instant instead of re-fetching. Mutations
    // call revalidatePath, so data still refreshes when it actually changes.
    staleTimes: { dynamic: 30, static: 180 },
  },
  // Server Actions keep Next's default 1MB body cap: none of them carry a file
  // payload — résumés, candidate photos and crew/product photos all upload
  // straight from the browser to Supabase Storage.
};

export default nextConfig;
