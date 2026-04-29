import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  transpilePackages: ["@ulfy/contracts"],
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
