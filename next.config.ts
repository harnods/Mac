import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["machitori.local"],
  compress: true,
  experimental: {
    // Keep already-rendered pages in the client router cache so navigating
    // back to a visited page is instant instead of re-fetching. Mutations
    // call revalidatePath, so data still refreshes when it actually changes.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
