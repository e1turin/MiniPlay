import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
  // Static export settings
  basePath: "/zai-miniplayer",
  // trailingSlash: false,
};

export default nextConfig;
