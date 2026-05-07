import type { NextConfig } from "next";

const publicBasePath = normalizePath(process.env.NEXT_PUBLIC_BASE_PATH);
const apiProxyTarget = trimTrailingSlash(process.env.API_PROXY_TARGET || "http://127.0.0.1:4000");

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePath(value?: string) {
  if (!value) return "";
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const nextConfig: NextConfig = {
  transpilePackages: ["@skrivdet/contracts"],
  assetPrefix: publicBasePath || undefined,
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
