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
    // Candidate résumés (PDF) are uploaded through a server action; raise the
    // default 1MB body cap to fit the 5MB resumes bucket limit.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
