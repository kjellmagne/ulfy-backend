"use client";

import { appPath } from "./base-path";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ulfy_admin_token") ?? "";
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${baseUrl}${appPath(`/api/v1${path}`)}`, { ...init, headers, cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
    window.location.href = appPath("/login");
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
