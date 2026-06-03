import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Static export settings
  basePath: "/zai-miniplayer",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
