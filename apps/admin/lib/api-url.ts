"use client";

import { appPath } from "./base-path";

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const versionedPath = normalizedPath.startsWith("/api/v1") ? normalizedPath : `/api/v1${normalizedPath}`;

  if (configuredBaseUrl) {
    return `${trimTrailingSlash(configuredBaseUrl)}${versionedPath}`;
  }

  return appPath(versionedPath);
}
