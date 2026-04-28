"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../components/RequireAuth";
import { EmptyState, LoadingPanel, PageHeader, PanelHeader } from "../components/AdminUI";
import { api } from "../lib/api";

const metrics = [
  ["singleKeys", "Single keys"],
  ["enterpriseKeys", "Enterprise keys"],
  ["activations", "Activations"],
  ["activeUniqueDevices", "Active devices"],
  ["templates", "Templates"]
];

export default function Home() {
  const [data, setData] = useState<any>();
  useEffect(() => { api("/admin/overview").then(setData).catch(console.error); }, []);
  return (
    <RequireAuth>
      <PageHeader title="Overview" description="Operational snapshot for licensing, activations, templates, and recent admin activity." />
      {!data ? <LoadingPanel label="Loading overview" /> : (
        <div className="page-stack">
          <div className="grid four">
            {metrics.map(([key, label]) => (
              <div className="card metric-card" key={key}>
                <div className="metric-label">{label}</div>
                <h2 className="metric-value">{data?.[key] ?? "-"}</h2>
              </div>
            ))}
          </div>
          <div className="panel">
            <PanelHeader title="Recent audit" description="Latest license, tenant, config, and template events." />
            {!data?.audits?.length ? <EmptyState title="No audit entries yet" message="Recent admin and activation activity will appear here." /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Action</th><th>Target</th><th>Time</th></tr></thead>
                  <tbody>{data.audits.map((a: any) => <tr key={a.id}><td><b>{a.action}</b></td><td>{a.targetType}</td><td>{new Date(a.createdAt).toLocaleString()}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
