"use client";

import { Building2, KeyRound, LayoutDashboard, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { appPath, basePath } from "../lib/base-path";
import { AdminSession } from "./AdminSession";

const mainLinks = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/keys", label: "Keys", icon: KeyRound },
  { href: "/configs", label: "Configs", icon: Settings },
  { href: "/templates", label: "Templates", icon: ScrollText }
];

const systemLinks = [
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
  { href: "/users", label: "Users", icon: Users },
  { href: "/audit", label: "Audit", icon: ShieldCheck }
];

export function AdminNav() {
  const pathname = usePathname();
  const currentPath = normalizePath(pathname ?? "/");

  return (
    <nav className="nav">
      <div className="brand">
        <div className="brand-icon">U</div>
        <div className="brand-text">
          <div className="brand-title">Ulfy</div>
          <div className="brand-subtitle">Admin Portal</div>
        </div>
      </div>
      <div className="nav-links">
        <div className="nav-label">Main</div>
        {mainLinks.map((link) => <NavLink key={link.href} currentPath={currentPath} {...link} />)}
        <div className="nav-label">System</div>
        {systemLinks.map((link) => <NavLink key={link.href} currentPath={currentPath} {...link} />)}
      </div>
      <AdminSession />
    </nav>
  );
}

function NavLink({ currentPath, href, label, icon: Icon }: { currentPath: string; href: string; label: string; icon: typeof LayoutDashboard }) {
  const active = currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));

  return (
    <a href={appPath(href)} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      <span className="nav-icon"><Icon size={18} /></span>
      {label}
    </a>
  );
}

function normalizePath(pathname: string) {
  if (basePath && pathname.startsWith(basePath)) {
    const normalized = pathname.slice(basePath.length);
    return normalized || "/";
  }

  return pathname || "/";
}
