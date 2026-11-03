import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode mounts effects twice in dev, which would create two GPU renderers.
  reactStrictMode: false,
};

export default nextConfig;
