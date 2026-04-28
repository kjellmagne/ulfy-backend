import "./globals.css";
import { ReactNode } from "react";
import { KeyRound, LayoutDashboard, ScrollText, Settings, ShieldCheck } from "lucide-react";

export const metadata = { title: "Ulfy Admin", description: "Internal Ulfy control plane" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="nav">
            <div className="brand">Ulfy Admin</div>
            <a href="/"><LayoutDashboard size={17} /> Overview</a>
            <a href="/keys"><KeyRound size={17} /> Keys</a>
            <a href="/configs"><Settings size={17} /> Configs</a>
            <a href="/templates"><ScrollText size={17} /> Templates</a>
            <a href="/audit"><ShieldCheck size={17} /> Audit</a>
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
