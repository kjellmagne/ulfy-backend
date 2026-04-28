import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ulfy/contracts"],
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined
};

export default nextConfig;
