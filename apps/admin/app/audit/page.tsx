"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { EmptyState, LoadingPanel, PageHeader, PanelHeader, StatCard, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { 
    Promise.all([api("/admin/audit-logs"), api("/admin/activations")])
      .then(([l, a]) => { setLogs(l); setActivations(a); })
      .finally(() => setLoading(false)); 
  }, []);

  const activeDevices = activations.filter(a => a.status === 'active').length;
  const recentCheckIns = activations.filter(a => {
    const lastSeen = new Date(a.lastSeenAt ?? a.lastCheckIn);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastSeen > hourAgo;
  }).length;

  return (
    <RequireAuth>
      <PageHeader title="Audit and activations" description="Inspect device activity, last-seen timestamps, and recent control-plane changes." />
      {loading ? <LoadingPanel label="Loading audit data" /> : (
      <div className="page-stack">
        {/* Stats */}
        <div className="grid three">
          <StatCard label="Total activations" value={activations.length} icon={<Activity size={18} />} sub={`${activeDevices} active`} />
          <StatCard label="Recent check-ins" value={recentCheckIns} icon={<Clock size={18} />} sub="in last hour" />
          <StatCard label="Audit events" value={logs.length} icon={<ShieldCheck size={18} />} sub="control plane logs" />
        </div>

        <div className="panel">
          <PanelHeader title="Device activations" description="Most recent check-ins are listed first. Shows all activation records across single-user and enterprise licenses." />
          {!activations.length ? <EmptyState title="No activations yet" message="Activated devices will appear here after the app checks in." /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Kind</th><th>Device</th><th>Serial</th><th>Status</th><th>App version</th><th>Last seen</th></tr></thead><tbody>{activations.map((a) => <tr key={a.id}><td><span className="badge">{a.kind}</span></td><td><span className="code">{a.deviceIdentifier}</span></td><td>{a.deviceSerialNumber ?? "-"}</td><td><StatusBadge status={a.status} /></td><td>{a.appVersion ?? "-"}</td><td>{new Date(a.lastSeenAt ?? a.lastCheckIn).toLocaleString()}</td></tr>)}</tbody></table></div>
          )}
        </div>
        <div className="panel">
          <PanelHeader title="Audit history" description="Latest license, config, tenant, and template events. Records all admin actions for compliance." />
          {!logs.length ? <EmptyState title="No audit entries yet" message="Admin and activation events will appear here." /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>Time</th></tr></thead><tbody>{logs.map((l) => <tr key={l.id}><td><b>{l.action}</b></td><td><span className="muted">{l.targetType}</span><br /><span className="code">{l.targetId}</span></td><td>{l.actorEmail ?? <span className="muted">system</span>}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>
      )}
    </RequireAuth>
  );
}
