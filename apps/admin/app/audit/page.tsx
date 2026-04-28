"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { EmptyState, LoadingPanel, PageHeader, PanelHeader, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api("/admin/audit-logs"), api("/admin/activations")]).then(([l, a]) => { setLogs(l); setActivations(a); }).finally(() => setLoading(false)); }, []);
  return (
    <RequireAuth>
      <PageHeader title="Audit and activations" description="Inspect device activity, last-seen timestamps, and recent control-plane changes." />
      {loading ? <LoadingPanel label="Loading audit data" /> : (
      <div className="page-stack">
      <div className="panel">
        <PanelHeader title="Device activations" description="Most recent check-ins are listed first." />
        {!activations.length ? <EmptyState title="No activations yet" message="Activated devices will appear here after the app checks in." /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Kind</th><th>Device</th><th>Serial</th><th>Status</th><th>Last seen</th></tr></thead><tbody>{activations.map((a) => <tr key={a.id}><td>{a.kind}</td><td>{a.deviceIdentifier}</td><td>{a.deviceSerialNumber ?? "-"}</td><td><StatusBadge status={a.status} /></td><td>{new Date(a.lastSeenAt ?? a.lastCheckIn).toLocaleString()}</td></tr>)}</tbody></table></div>
        )}
      </div>
      <div className="panel">
        <PanelHeader title="Audit history" description="Latest license, config, tenant, and template events." />
        {!logs.length ? <EmptyState title="No audit entries yet" message="Admin and activation events will appear here." /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>Time</th></tr></thead><tbody>{logs.map((l) => <tr key={l.id}><td><b>{l.action}</b></td><td>{l.targetType}<br /><span className="muted">{l.targetId}</span></td><td>{l.actorEmail ?? "system"}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
        )}
      </div>
      </div>
      )}
    </RequireAuth>
  );
}
