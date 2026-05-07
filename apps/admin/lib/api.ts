"use client";

import { appPath } from "./base-path";
import { apiUrl } from "./api-url";

export function getToken() {
  if (typeof window === "undefined") return "";
  const currentToken = localStorage.getItem("skrivdet_admin_token");
  if (currentToken) return currentToken;

  const legacyToken = localStorage.getItem("ulfy_admin_token");
  if (!legacyToken) return "";

  localStorage.setItem("skrivdet_admin_token", legacyToken);
  localStorage.removeItem("ulfy_admin_token");
  return legacyToken;
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { ...init, headers, cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
    window.location.href = appPath("/login");
  }
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

async function readError(res: Response) {
  const text = await res.text();
  try {
    const payload = JSON.parse(text);
    if (payload?.error?.message) return payload.error.message;
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join("; ");
  } catch {
    // Keep the original body below.
  }
  return text || `Request failed (${res.status})`;
}
