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
            <div className="brand">Ulfy Admin</div>
            <div className="nav-links">
              <a href={appPath("/")}><LayoutDashboard size={17} /> Overview</a>
              <a href={appPath("/tenants")}><Building2 size={17} /> Tenants</a>
              <a href={appPath("/keys")}><KeyRound size={17} /> Keys</a>
              <a href={appPath("/configs")}><Settings size={17} /> Configs</a>
              <a href={appPath("/templates")}><ScrollText size={17} /> Templates</a>
              <a href={appPath("/users")}><Users size={17} /> Users</a>
              <a href={appPath("/audit")}><ShieldCheck size={17} /> Audit</a>
            </div>
            <AdminSession />
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
