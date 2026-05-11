import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack filesystem cache writes 1.7GB+ to SSD during dev,
    // causing I/O saturation and thermal issues. Disable to trade
    // faster restarts for lower disk I/O and CPU load.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
