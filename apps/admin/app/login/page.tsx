"use client";

import { useState } from "react";
import { appPath } from "../../lib/base-path";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@ulfy.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${appPath("/api/v1/auth/login")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      setError("Login failed");
      return;
    }
    const data = await res.json();
    localStorage.setItem("ulfy_admin_token", data.accessToken);
    window.location.href = appPath("/");
  }

  return (
    <div className="panel" style={{ maxWidth: 420 }}>
      <h2>Admin login</h2>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="button">Sign in</button>
      </form>
    </div>
  );
}
