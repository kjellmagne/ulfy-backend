import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ulfy/contracts"],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined
};

export default nextConfig;
