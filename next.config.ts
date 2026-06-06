import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Static export settings — only use subpath for GitHub Pages deployment
  basePath: process.env.NODE_ENV === "development" ? "" : "/zai-miniplayer",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
