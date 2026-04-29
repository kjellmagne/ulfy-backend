import "./globals.css";
import { ReactNode } from "react";
import { Building2, KeyRound, LayoutDashboard, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import { appPath } from "../lib/base-path";
import { AdminSession } from "../components/AdminSession";

export const metadata = { title: "Ulfy Admin", description: "Internal Ulfy control plane" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
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
              <a href={appPath("/")}><span className="nav-icon"><LayoutDashboard size={18} /></span> Overview</a>
              <a href={appPath("/tenants")}><span className="nav-icon"><Building2 size={18} /></span> Tenants</a>
              <a href={appPath("/keys")}><span className="nav-icon"><KeyRound size={18} /></span> Keys</a>
              <a href={appPath("/configs")}><span className="nav-icon"><Settings size={18} /></span> Configs</a>
              <a href={appPath("/templates")}><span className="nav-icon"><ScrollText size={18} /></span> Templates</a>
              <div className="nav-label">System</div>
              <a href={appPath("/users")}><span className="nav-icon"><Users size={18} /></span> Users</a>
              <a href={appPath("/audit")}><span className="nav-icon"><ShieldCheck size={18} /></span> Audit</a>
            </div>
            <AdminSession />
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
