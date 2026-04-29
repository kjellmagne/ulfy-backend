import "./globals.css";
import { ReactNode } from "react";
import { AdminNav } from "../components/AdminNav";
import { ToastProvider } from "../components/ToastProvider";

export const metadata = { title: "Ulfy Admin", description: "Internal Ulfy control plane" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="shell">
            <AdminNav />
            <main className="main">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
