"use client";

import { useState } from "react";
import { Alert, FieldLabel, PanelHeader } from "../../components/AdminUI";
import { appPath } from "../../lib/base-path";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@ulfy.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${appPath("/api/v1/auth/login")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        setError("Email or password is incorrect.");
        return;
      }
      const data = await res.json();
      localStorage.setItem("ulfy_admin_token", data.accessToken);
      window.location.href = appPath("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 420 }}>
      <PanelHeader title="Admin login" description="Sign in to manage Ulfy licenses, tenants, configs, and templates." />
      <form onSubmit={submit}>
        <div className="field"><FieldLabel>Email</FieldLabel><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><FieldLabel>Password</FieldLabel><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <Alert tone="danger">{error}</Alert>}
        <button className="button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  );
}
