"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { api } from "../../lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  useEffect(() => { Promise.all([api("/admin/audit-logs"), api("/admin/activations")]).then(([l, a]) => { setLogs(l); setActivations(a); }); }, []);
  return (
    <RequireAuth>
      <div className="topbar"><h1>Audit and activations</h1></div>
      <div className="panel">
        <h2>Device activations</h2>
        <table className="table"><thead><tr><th>Kind</th><th>Device</th><th>Status</th><th>Last check-in</th></tr></thead><tbody>{activations.map((a) => <tr key={a.id}><td>{a.kind}</td><td>{a.deviceIdentifier}</td><td>{a.status}</td><td>{new Date(a.lastCheckIn).toLocaleString()}</td></tr>)}</tbody></table>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Audit history</h2>
        <table className="table"><thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>Time</th></tr></thead><tbody>{logs.map((l) => <tr key={l.id}><td>{l.action}</td><td>{l.targetType}<br /><span className="muted">{l.targetId}</span></td><td>{l.actorEmail ?? "system"}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
      </div>
    </RequireAuth>
  );
}
