"use client";

import { useEffect, useState } from "react";
import { api, getToken } from "../lib/api";
import { appPath } from "../lib/base-path";

export function AdminSession() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!getToken() || window.location.pathname.endsWith(appPath("/login"))) return;
    api("/admin/me").then(setUser).catch(() => setUser(null));
  }, []);

  function logout() {
    localStorage.removeItem("ulfy_admin_token");
    window.location.href = appPath("/login");
  }

  if (!user) return null;

  const initials = (user.fullName ?? user.email ?? 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="nav-session">
      <div className="session-user">
        <div className="session-avatar">{initials}</div>
        <div className="session-info">
          <div className="session-name">{user.fullName ?? user.email}</div>
          <div className="session-email">{user.email}</div>
        </div>
      </div>
      <div className="session-footer">
        <span className="session-role">{roleLabel(user.role)}</span>
        <button type="button" className="nav-logout" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

function roleLabel(role?: string) {
  return (role ?? "admin").replace("_", " ");
}
