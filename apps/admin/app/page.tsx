"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, Building2, KeyRound, ScrollText, Smartphone } from "lucide-react";
import { RequireAuth } from "../components/RequireAuth";
import { EmptyState, LoadingPanel, PageHeader, PanelHeader, StatCard, ProgressBar } from "../components/AdminUI";
import { api } from "../lib/api";

export default function Home() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    Promise.all([api("/admin/overview"), api("/admin/license-usage")])
      .then(([overview, licenseUsage]) => setData({ ...overview, licenseUsage }))
      .catch(console.error);
  }, []);

  const totalKeys = (data?.singleKeys ?? 0) + (data?.enterpriseKeys ?? 0);
  const tenantUsage = data?.licenseUsage?.tenants ?? [];

  return (
    <RequireAuth>
      <PageHeader title="Overview" description="Operational snapshot for licensing, activations, tenant usage, and templates." />
      {!data ? <LoadingPanel label="Loading overview" /> : (
        <div className="page-stack">
          {/* Hero card */}
          <div className="dashboard-hero">
            <div>
              <span className="metric-label">Active device footprint</span>
              <h2>{data.activeUniqueDevices ?? 0}</h2>
              <p>{data.activations ?? 0} total activations across single-user and enterprise licenses.</p>
            </div>
            <div className="hero-sparkline">
              {[0, 1, 1, 0, 0, 1, 1].map((v, i) => (
                <span key={i} style={{ height: `${v ? 100 : 18}%` }} />
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid four">
            <StatCard label="Single keys" value={data.singleKeys ?? 0} icon={<KeyRound size={18} />} sub={`${data.singleKeys ?? 0} active`} />
            <StatCard label="Enterprise keys" value={data.enterpriseKeys ?? 0} icon={<Building2 size={18} />} sub={`${data.enterpriseKeys ?? 0} active`} />
            <StatCard label="Activations" value={data.activations ?? 0} icon={<Activity size={18} />} sub="total across all keys" />
            <StatCard label="Templates" value={data.templates ?? 0} icon={<ScrollText size={18} />} sub={`${data.templates ?? 0} published`} />
          </div>

          {/* Charts */}
          <div className="grid two">
            <div className="panel">
              <PanelHeader title="License mix" description="Generated activation keys by type." />
              <div className="donut-layout">
                <svg className="donut" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="58" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                  <circle cx="80" cy="80" r="58" fill="none" stroke="#0d9488" strokeWidth="20"
                    strokeDasharray={`${totalKeys > 0 ? ((data.singleKeys ?? 0) / totalKeys) * 365 : 0} 365`}
                    strokeDashoffset="91.25"
                    style={{ transition: 'stroke-dasharray 0.5s' }} />
                  <circle cx="80" cy="80" r="58" fill="none" stroke="#64748b" strokeWidth="20"
                    strokeDasharray={`${totalKeys > 0 ? ((data.enterpriseKeys ?? 0) / totalKeys) * 365 : 0} 365`}
                    strokeDashoffset={`${91.25 - (totalKeys > 0 ? ((data.singleKeys ?? 0) / totalKeys) * 365 : 0)}`}
                    style={{ transition: 'stroke-dasharray 0.5s' }} />
                  <text x="80" y="74" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">{totalKeys}</text>
                  <text x="80" y="92" textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="600" letterSpacing="1">KEYS</text>
                </svg>
                <div className="chart-legend">
                  <div>
                    <span><span className="legend-dot accent" />Single-user</span>
                    <strong style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{data.singleKeys ?? 0}</strong>
                  </div>
                  <div>
                    <span><span className="legend-dot gray" />Enterprise</span>
                    <strong style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{data.enterpriseKeys ?? 0}</strong>
                  </div>
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
                      <ProgressBar value={tenant.activeDevices} max={tenant.unlimited ? tenant.activeDevices || 1 : tenant.licensedDevices ?? 1} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="panel">
            <PanelHeader title="Recent activity" description="Last 5 admin actions." />
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '12px', border: 'none' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0d9488' }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500, color: '#0f172a' }}>Created tenant</span>
                        <span style={{ color: '#64748b' }}> — Alta kommune</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>admin@ulfy.local</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', minWidth: '150px', textAlign: 'right' }}>29/04/2026, 02:17:56</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
