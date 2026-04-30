"use client";

import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "../../components/AdminUI";
import { getErrorMessage, useToast } from "../../components/ToastProvider";
import { apiUrl } from "../../lib/api-url";
import { appPath } from "../../lib/base-path";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error("Email or password is incorrect.");
      const data = await res.json();
      localStorage.setItem("ulfy_admin_token", data.accessToken);
      window.location.href = appPath("/");
    } catch (err: any) {
      const message = getErrorMessage(err);
      setError(message);
      notify({ tone: "danger", title: "Could not sign in", message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-intro" aria-label="Ulfy Admin">
          <div className="login-brand">
            <div className="login-logo">U</div>
            <div>
              <div className="login-product">Ulfy</div>
              <div className="login-subtitle">Admin Portal</div>
            </div>
          </div>
          <div className="login-intro-copy">
            <span className="login-kicker">Internal access only</span>
            <h1>Control plane sign-in</h1>
            <p>Licenses, tenants, policies, and templates are managed from one protected workspace.</p>
          </div>
          <div className="login-assurance">
            <span><ShieldCheck size={15} /> Admin accounts only</span>
            <span><LockKeyhole size={15} /> No public registration</span>
          </div>
        </section>

        <section className="login-card" aria-label="Sign in form">
          <div className="login-card-header">
            <div className="login-card-icon"><LockKeyhole size={18} /></div>
            <div>
              <h2>Sign in</h2>
              <p>Use your assigned Ulfy admin account.</p>
            </div>
          </div>
          <form onSubmit={submit} className="login-form">
            <div className="field">
              <FieldLabel>Email</FieldLabel>
              <input
                className="input"
                type="email"
                value={email}
                autoComplete="email"
                placeholder="admin@ulfy.local"
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="field">
              <FieldLabel>Password</FieldLabel>
              <input
                className="input"
                type="password"
                value={password}
                autoComplete="current-password"
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="button login-submit" disabled={loading || !email.trim() || !password}>
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
