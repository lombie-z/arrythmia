import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Album folded into isaacrozsa.com/arrhythmia — 301 the old subdomain there.
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://www.isaacrozsa.com/arrhythmia/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
