"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, RotateCcw, ShieldX } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { api } from "../../lib/api";

export default function KeysPage() {
  const [single, setSingle] = useState<any[]>([]);
  const [enterprise, setEnterprise] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [generated, setGenerated] = useState("");
  const [form, setForm] = useState({ purchaserFullName: "", purchaserEmail: "", notes: "" });
  const [enterpriseForm, setEnterpriseForm] = useState({ tenantId: "", configProfileId: "", maxDevices: 25 });

  async function load() {
    const [s, e, t, p] = await Promise.all([api("/admin/single-keys"), api("/admin/enterprise-keys"), api("/admin/tenants"), api("/admin/config-profiles")]);
    setSingle(s); setEnterprise(e); setTenants(t); setProfiles(p);
    setEnterpriseForm((v) => ({ ...v, tenantId: v.tenantId || t[0]?.id || "", configProfileId: v.configProfileId || p[0]?.id || "" }));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createSingle(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/admin/single-keys", { method: "POST", body: JSON.stringify(form) });
    setGenerated(res.activationKey); setForm({ purchaserFullName: "", purchaserEmail: "", notes: "" }); load();
  }
  async function createEnterprise(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/admin/enterprise-keys", { method: "POST", body: JSON.stringify(enterpriseForm) });
    setGenerated(res.activationKey); load();
  }

  return (
    <RequireAuth>
      <div className="topbar"><h1>License keys</h1>{generated && <button className="button secondary" onClick={() => navigator.clipboard.writeText(generated)}><Copy size={16} /> {generated}</button>}</div>
      <div className="grid two">
        <form className="panel" onSubmit={createSingle}>
          <h2>Generate single-user key</h2>
          <div className="field"><label>Purchaser full name</label><input className="input" value={form.purchaserFullName} onChange={(e) => setForm({ ...form, purchaserFullName: e.target.value })} required /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={form.purchaserEmail} onChange={(e) => setForm({ ...form, purchaserEmail: e.target.value })} required /></div>
          <div className="field"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="button"><KeyRound size={16} /> Generate</button>
        </form>
        <form className="panel" onSubmit={createEnterprise}>
          <h2>Generate enterprise key</h2>
          <div className="field"><label>Tenant</label><select value={enterpriseForm.tenantId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, tenantId: e.target.value })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field"><label>Config profile</label><select value={enterpriseForm.configProfileId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, configProfileId: e.target.value })}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field"><label>Max devices</label><input className="input" type="number" value={enterpriseForm.maxDevices} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, maxDevices: Number(e.target.value) })} /></div>
          <button className="button"><KeyRound size={16} /> Generate</button>
        </form>
      </div>
      <h2>Single-user keys</h2>
      <table className="table"><thead><tr><th>Purchaser</th><th>Prefix</th><th>Status</th><th>Device</th><th></th></tr></thead><tbody>{single.map((k) => <tr key={k.id}><td>{k.purchaserFullName}<br /><span className="muted">{k.purchaserEmail}</span></td><td>{k.keyPrefix}</td><td><span className="badge">{k.status}</span></td><td>{k.deviceIdentifier ?? "-"}</td><td className="row"><button className="button danger" onClick={() => api(`/admin/single-keys/${k.id}/revoke`, { method: "PATCH" }).then(load)}><ShieldX size={14} /></button><button className="button secondary" onClick={() => api(`/admin/single-keys/${k.id}/reset`, { method: "PATCH" }).then(load)}><RotateCcw size={14} /></button></td></tr>)}</tbody></table>
      <h2>Enterprise keys</h2>
      <table className="table"><thead><tr><th>Tenant</th><th>Prefix</th><th>Status</th><th>Devices</th><th>Config</th></tr></thead><tbody>{enterprise.map((k) => <tr key={k.id}><td>{k.tenant?.name}</td><td>{k.keyPrefix}</td><td><span className="badge">{k.status}</span></td><td>{k.activations?.length ?? 0}/{k.maxDevices ?? "unlimited"}</td><td>{k.configProfile?.name}</td></tr>)}</tbody></table>
    </RequireAuth>
  );
}
