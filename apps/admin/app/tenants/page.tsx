"use client";

import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { api } from "../../lib/api";

const empty = {
  name: "",
  slug: "",
  legalName: "",
  organizationNumber: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  billingEmail: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "NO",
  status: "active",
  notes: "",
  configProfileId: ""
};

function tenantToForm(tenant: any) {
  return {
    ...empty,
    name: tenant.name ?? "",
    slug: tenant.slug ?? "",
    legalName: tenant.legalName ?? "",
    organizationNumber: tenant.organizationNumber ?? "",
    contactName: tenant.contactName ?? "",
    contactEmail: tenant.contactEmail ?? "",
    contactPhone: tenant.contactPhone ?? "",
    billingEmail: tenant.billingEmail ?? "",
    addressLine1: tenant.addressLine1 ?? "",
    addressLine2: tenant.addressLine2 ?? "",
    postalCode: tenant.postalCode ?? "",
    city: tenant.city ?? "",
    country: tenant.country ?? "NO",
    status: tenant.status ?? "active",
    notes: tenant.notes ?? "",
    configProfileId: tenant.configProfileId ?? ""
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [tenantData, profileData] = await Promise.all([api("/admin/tenants"), api("/admin/config-profiles")]);
    setTenants(tenantData);
    setProfiles(profileData);
    setForm((current: any) => ({ ...current, configProfileId: current.configProfileId || profileData[0]?.id || "" }));
  }

  useEffect(() => { load().catch(console.error); }, []);

  function edit(tenant: any) {
    setSelected(tenant.id);
    setForm(tenantToForm(tenant));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? undefined : value]));
    await api(selected ? `/admin/tenants/${selected}` : "/admin/tenants", { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
    setMessage("Saved");
    setSelected("");
    setForm({ ...empty, configProfileId: profiles[0]?.id || "" });
    load();
  }

  return (
    <RequireAuth>
      <div className="topbar"><h1>Tenants</h1><span className="muted">{message || "Enterprise customer register and license usage"}</span></div>
      <div className="page-stack">
        <form className="panel" onSubmit={save}>
          <h2>{selected ? "Edit tenant" : "Create tenant"}</h2>
          <div className="grid three">
            <div className="field"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
            <div className="field"><label>Legal name</label><input className="input" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
            <div className="field"><label>Organization number</label><input className="input" value={form.organizationNumber} onChange={(e) => setForm({ ...form, organizationNumber: e.target.value })} /></div>
            <div className="field"><label>Contact name</label><input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div className="field"><label>Contact email</label><input className="input" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="field"><label>Contact phone</label><input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="field"><label>Billing email</label><input className="input" type="email" value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} /></div>
            <div className="field"><label>Address</label><input className="input" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
            <div className="field"><label>Address 2</label><input className="input" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></div>
            <div className="field"><label>Postal code</label><input className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
            <div className="field"><label>City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label>Country</label><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="field"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="disabled">disabled</option><option value="prospect">prospect</option></select></div>
            <div className="field"><label>Config profile</label><select value={form.configProfileId} onChange={(e) => setForm({ ...form, configProfileId: e.target.value })}><option value="">None</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="button"><Save size={16} /> Save tenant</button>
        </form>
        <div className="panel">
          <h2>Enterprise customers</h2>
          <table className="table">
            <thead><tr><th>Customer</th><th>Contact</th><th>License usage</th><th></th></tr></thead>
            <tbody>{tenants.map((tenant) => {
              const usage = tenant.licenseUsage ?? {};
              const capacity = usage.unlimited ? "unlimited" : usage.licensedDevices ?? 0;
              return (
                <tr key={tenant.id}>
                  <td><b>{tenant.name}</b><br /><span className="muted">{tenant.legalName || tenant.slug}</span><br /><span className="badge">{tenant.status}</span></td>
                  <td>{tenant.contactName || "-"}<br /><span className="muted">{tenant.contactEmail || tenant.billingEmail || ""}</span></td>
                  <td><b>{usage.activeDevices ?? 0}</b> active / {capacity}<br /><span className="muted">{usage.totalDevices ?? 0} total unique devices</span></td>
                  <td><button className="button secondary" onClick={() => edit(tenant)}><Building2 size={14} /> Edit</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </RequireAuth>
  );
}
