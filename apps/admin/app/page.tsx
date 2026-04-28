"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, Building2, KeyRound, ScrollText, Smartphone } from "lucide-react";
import { RequireAuth } from "../components/RequireAuth";
import { EmptyState, LoadingPanel, PageHeader, PanelHeader } from "../components/AdminUI";
import { api } from "../lib/api";

const metrics = [
  { key: "singleKeys", label: "Single keys", icon: KeyRound },
  { key: "enterpriseKeys", label: "Enterprise keys", icon: Building2 },
  { key: "activations", label: "Activations", icon: Activity },
  { key: "activeUniqueDevices", label: "Active devices", icon: Smartphone },
  { key: "templates", label: "Templates", icon: ScrollText }
];

export default function Home() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    Promise.all([api("/admin/overview"), api("/admin/license-usage")])
      .then(([overview, licenseUsage]) => setData({ ...overview, licenseUsage }))
      .catch(console.error);
  }, []);

  const totalKeys = (data?.singleKeys ?? 0) + (data?.enterpriseKeys ?? 0);
  const singlePct = totalKeys ? Math.round(((data?.singleKeys ?? 0) / totalKeys) * 100) : 0;
  const tenantUsage = data?.licenseUsage?.tenants ?? [];

  return (
    <RequireAuth>
      <PageHeader title="Overview" description="Operational snapshot for licensing, activations, tenant usage, and templates." />
      {!data ? <LoadingPanel label="Loading overview" /> : (
        <div className="page-stack">
          <div className="dashboard-hero">
            <div>
              <span className="metric-label">Active device footprint</span>
              <h2>{data.activeUniqueDevices ?? 0}</h2>
              <p>{data.activations ?? 0} total activations across single-user and enterprise licenses.</p>
            </div>
            <div className="hero-sparkline" aria-hidden="true">
              {[data.singleKeys, data.enterpriseKeys, data.activations, data.activeUniqueDevices, data.templates].map((value: number, index: number) => (
                <span key={index} style={{ height: `${Math.max(18, Math.min(100, (value ?? 0) * 12))}%` }} />
              ))}
            </div>
          </div>

          <div className="grid four">
            {metrics.map(({ key, label, icon: Icon }) => (
              <div className="card metric-card" key={key}>
                <div className="metric-topline">
                  <div className="metric-label">{label}</div>
                  <span className="metric-icon"><Icon size={18} /></span>
                </div>
                <h2 className="metric-value">{data?.[key] ?? 0}</h2>
              </div>
            ))}
          </div>

          <div className="grid two">
            <div className="panel">
              <PanelHeader title="License mix" description="Generated activation keys by type." />
              <div className="donut-layout">
                <div className="donut" style={{ "--single": `${singlePct}%` } as CSSProperties}>
                  <strong>{totalKeys}</strong>
                  <span>keys</span>
                </div>
                <div className="chart-legend">
                  <div><span className="legend-dot accent" /> Single-user <b>{data.singleKeys ?? 0}</b></div>
                  <div><span className="legend-dot blue" /> Enterprise <b>{data.enterpriseKeys ?? 0}</b></div>
                </div>
              </div>
            </div>

            <div className="panel">
              <PanelHeader title="Tenant device usage" description="Active unique devices against enterprise license allowance." />
              {!tenantUsage.length ? <EmptyState title="No tenant usage yet" message="Enterprise device usage appears after activations." /> : (
                <div className="usage-list">
                  {tenantUsage.slice(0, 8).map((tenant: any) => (
                    <div className="usage-row" key={tenant.tenantId}>
                      <div className="usage-label">
                        <strong>{tenant.name}</strong>
                        <span>{tenant.activeDevices} active / {tenant.unlimited ? "unlimited" : tenant.licensedDevices ?? 0}</span>
                      </div>
                      <div className="usage-track">
                        <span style={{ width: `${usagePercent(tenant)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <PanelHeader title="Operational coverage" description="Current control-plane content and device reach." />
            <div className="coverage-grid">
              <div>
                <span className="metric-label">Activation coverage</span>
                <strong>{coveragePercent(data.activeUniqueDevices, data.activations)}%</strong>
                <p className="muted">Unique active devices compared with total activation records.</p>
              </div>
              <div>
                <span className="metric-label">Template availability</span>
                <strong>{data.templates ?? 0}</strong>
                <p className="muted">Templates available for app manifests and enterprise profiles.</p>
              </div>
              <div>
                <span className="metric-label">Enterprise usage</span>
                <strong>{data.licenseUsage?.activeUniqueDevices ?? 0}</strong>
                <p className="muted">Active unique enterprise devices across visible tenants.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}

function usagePercent(tenant: any) {
  if (tenant.unlimited) return tenant.activeDevices > 0 ? 100 : 0;
  const licensed = tenant.licensedDevices || 0;
  if (!licensed) return 0;
  return Math.min(100, Math.round((tenant.activeDevices / licensed) * 100));
}

function coveragePercent(activeDevices: number, activations: number) {
  if (!activations) return 0;
  return Math.min(100, Math.round((activeDevices / activations) * 100));
}
