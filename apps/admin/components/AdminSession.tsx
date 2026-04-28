"use client";

import { useEffect, useState } from "react";
import { LogOut, UserCircle } from "lucide-react";
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

  return (
    <div className="nav-session">
      <div className="session-user">
        <UserCircle size={20} />
        <div>
          <strong>{user.fullName ?? user.email}</strong>
          <span>{user.email}</span>
          <small>{roleLabel(user.role)}{user.partner?.name ? ` · ${user.partner.name}` : ""}</small>
        </div>
      </div>
      <button type="button" className="nav-logout" onClick={logout}>
        <LogOut size={15} /> Logout
      </button>
    </div>
  );
}

function roleLabel(role?: string) {
  return (role ?? "admin").replace("_", " ");
}
