"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, RotateCcw, ShieldX } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, PageHeader, PanelHeader, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

function defaultMaintenanceDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export default function KeysPage() {
  const [single, setSingle] = useState<any[]>([]);
  const [enterprise, setEnterprise] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [generated, setGenerated] = useState<{ key: string; kind: "single-user" | "enterprise"; label: string } | null>(null);
  const [form, setForm] = useState({ purchaserFullName: "", purchaserEmail: "", maintenanceUntil: defaultMaintenanceDate(), notes: "" });
  const [enterpriseForm, setEnterpriseForm] = useState({ tenantId: "", configProfileId: "", maxDevices: 25, maintenanceUntil: defaultMaintenanceDate() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [s, e, t, p] = await Promise.all([api("/admin/single-keys"), api("/admin/enterprise-keys"), api("/admin/tenants"), api("/admin/config-profiles")]);
      setSingle(s); setEnterprise(e); setTenants(t); setProfiles(p);
      setEnterpriseForm((v) => ({ ...v, tenantId: v.tenantId || t[0]?.id || "", configProfileId: v.configProfileId || p[0]?.id || "" }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createSingle(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving("single");
    try {
      const res = await api("/admin/single-keys", { method: "POST", body: JSON.stringify(form) });
      setGenerated({ key: res.activationKey, kind: "single-user", label: form.purchaserEmail });
      setForm({ purchaserFullName: "", purchaserEmail: "", maintenanceUntil: defaultMaintenanceDate(), notes: "" });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }
  async function createEnterprise(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving("enterprise");
    try {
      const res = await api("/admin/enterprise-keys", { method: "POST", body: JSON.stringify(enterpriseForm) });
      setGenerated({ key: res.activationKey, kind: "enterprise", label: res.tenant?.name ?? "Enterprise tenant" });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  return (
    <RequireAuth>
      <PageHeader title="License keys" description="Generate, inspect, revoke, and reset activation keys. Full keys are shown once after generation." />
      {error && <Alert tone="danger">{error}</Alert>}
      {generated && (
        <div className="panel" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
          <PanelHeader
            title="Activation key generated"
            description={`${generated.kind} key for ${generated.label}. Store it now; the full key is not saved in plain text.`}
            actions={<button className="button" onClick={() => navigator.clipboard.writeText(generated.key)}><Copy size={16} /> Copy key</button>}
          />
          <input className="input" readOnly value={generated.key} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800 }} />
        </div>
      )}
      {loading ? <LoadingPanel label="Loading license keys" /> : (
      <div className="page-stack">
      <div className="grid two">
        <form className="panel" onSubmit={createSingle}>
          <PanelHeader title="Generate single-user key" description="For one purchaser and one bound device in v1." />
          <div className="field"><FieldLabel>Purchaser full name</FieldLabel><input className="input" placeholder="Ola Nordmann" value={form.purchaserFullName} onChange={(e) => setForm({ ...form, purchaserFullName: e.target.value })} required /></div>
          <div className="field"><FieldLabel>Email</FieldLabel><input className="input" placeholder="ola@example.com" type="email" value={form.purchaserEmail} onChange={(e) => setForm({ ...form, purchaserEmail: e.target.value })} required /></div>
          <div className="field"><FieldLabel help="Shown to the iPhone app as support coverage.">Maintenance until</FieldLabel><input className="input" type="date" value={form.maintenanceUntil} onChange={(e) => setForm({ ...form, maintenanceUntil: e.target.value })} /></div>
          <div className="field"><FieldLabel>Notes</FieldLabel><input className="input" placeholder="Internal context or purchase reference" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="button" disabled={saving === "single"}><KeyRound size={16} /> {saving === "single" ? "Generating..." : "Generate key"}</button>
        </form>
        <form className="panel" onSubmit={createEnterprise}>
          <PanelHeader title="Generate enterprise key" description="Links a tenant, device allowance, and central config profile." />
          <div className="field"><FieldLabel>Tenant</FieldLabel><select value={enterpriseForm.tenantId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, tenantId: e.target.value })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field"><FieldLabel help="Returned to the app after activation and refresh.">Config profile</FieldLabel><select value={enterpriseForm.configProfileId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, configProfileId: e.target.value })}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field"><FieldLabel help="Leave blank in the API for unlimited.">Max devices</FieldLabel><input className="input" type="number" min={1} value={enterpriseForm.maxDevices} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, maxDevices: Number(e.target.value) })} /></div>
          <div className="field"><FieldLabel help="Shown to users as maintenance/support coverage.">Maintenance until</FieldLabel><input className="input" type="date" value={enterpriseForm.maintenanceUntil} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, maintenanceUntil: e.target.value })} /></div>
          <button className="button" disabled={saving === "enterprise" || !tenants.length || !profiles.length}><KeyRound size={16} /> {saving === "enterprise" ? "Generating..." : "Generate key"}</button>
        </form>
      </div>
      <div className="panel">
        <PanelHeader title="Single-user keys" description="Only prefixes are listed. Full activation keys are hashed and cannot be recovered later." />
        {!single.length ? <EmptyState title="No single-user keys" message="Generate a key above to make it available for activation." /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Purchaser</th><th>Prefix</th><th>Status</th><th>Maintenance</th><th>Device</th><th>Serial</th><th>Last seen</th><th className="actions">Actions</th></tr></thead><tbody>{single.map((k) => <tr key={k.id}><td><b>{k.purchaserFullName}</b><br /><span className="muted">{k.purchaserEmail}</span></td><td>{k.keyPrefix}</td><td><StatusBadge status={k.status} /></td><td>{k.maintenanceUntil ? new Date(k.maintenanceUntil).toLocaleDateString() : "-"}</td><td>{k.deviceIdentifier ?? "-"}</td><td>{k.deviceSerialNumber ?? "-"}</td><td>{k.lastSeenAt ? new Date(k.lastSeenAt).toLocaleString() : "-"}</td><td className="row actions"><button className="button danger" title="Revoke license" onClick={() => api(`/admin/single-keys/${k.id}/revoke`, { method: "PATCH" }).then(load)}><ShieldX size={14} /></button><button className="button secondary" title="Reset device binding" onClick={() => api(`/admin/single-keys/${k.id}/reset`, { method: "PATCH" }).then(load)}><RotateCcw size={14} /></button></td></tr>)}</tbody></table></div>
        )}
      </div>
      <div className="panel">
        <PanelHeader title="Enterprise keys" description="Device counts show registered activations against the configured allowance." />
        {!enterprise.length ? <EmptyState title="No enterprise keys" message="Create a tenant and config profile, then generate an enterprise key." /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Tenant</th><th>Prefix</th><th>Status</th><th>Maintenance</th><th>Devices</th><th>Config</th></tr></thead><tbody>{enterprise.map((k) => <tr key={k.id}><td><b>{k.tenant?.name}</b></td><td>{k.keyPrefix}</td><td><StatusBadge status={k.status} /></td><td>{k.maintenanceUntil ? new Date(k.maintenanceUntil).toLocaleDateString() : "-"}</td><td>{k.activations?.length ?? 0}/{k.maxDevices ?? "unlimited"}</td><td>{k.configProfile?.name}</td></tr>)}</tbody></table></div>
        )}
      </div>
      </div>
      )}
    </RequireAuth>
  );
}
