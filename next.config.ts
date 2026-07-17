import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: { unoptimized: true }
};

export default nextConfig;
