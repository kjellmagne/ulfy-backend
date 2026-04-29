import "./globals.css";
import { ReactNode } from "react";
import { AdminNav } from "../components/AdminNav";

export const metadata = { title: "Ulfy Admin", description: "Internal Ulfy control plane" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <AdminNav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
