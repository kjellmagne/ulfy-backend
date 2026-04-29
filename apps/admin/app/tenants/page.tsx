"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Save, Trash2 } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { EmptyState, FieldLabel, FormSection, IconAction, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatusBadge } from "../../components/AdminUI";
import { getErrorMessage, useToast } from "../../components/ToastProvider";
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
  partnerId: "",
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
    partnerId: tenant.partnerId ?? "",
    configProfileId: tenant.configProfileId ?? ""
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { notify } = useToast();

  async function load() {
    try {
      const [tenantData, profileData, partnerData] = await Promise.all([api("/admin/tenants"), api("/admin/config-profiles"), api("/admin/partners")]);
      setTenants(tenantData);
      setProfiles(profileData);
      setPartners(partnerData);
      setForm((current: any) => ({ ...current, configProfileId: current.configProfileId || profileData[0]?.id || "" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch((err) => notify({ tone: "danger", title: "Could not load tenants", message: getErrorMessage(err) })); }, []);

  function edit(tenant: any) {
    setSelected(tenant.id);
    setForm(tenantToForm(tenant));
    setEditorOpen(true);
  }

  function createNew() {
    setSelected("");
    setForm({ ...empty, configProfileId: profiles[0]?.id || "" });
    setEditorOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = { ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? undefined : value])), partnerId: form.partnerId || null, configProfileId: form.configProfileId || null };
    try {
      await api(selected ? `/admin/tenants/${selected}` : "/admin/tenants", { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
      notify({ tone: "success", title: selected ? "Tenant updated" : "Tenant created" });
      setSelected("");
      setForm({ ...empty, configProfileId: profiles[0]?.id || "" });
      setEditorOpen(false);
      await load();
    } catch (err: any) {
      notify({ tone: "danger", title: "Could not save tenant", message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant(tenant: any) {
    if (!window.confirm(`Delete ${tenant.name}? This cannot be undone.`)) return;
    try {
      await api(`/admin/tenants/${tenant.id}`, { method: "DELETE" });
      if (selected === tenant.id) {
        setSelected("");
        setForm({ ...empty, configProfileId: profiles[0]?.id || "" });
        setEditorOpen(false);
      }
      notify({ tone: "success", title: "Tenant deleted" });
      await load();
    } catch (err: any) {
      notify({ tone: "danger", title: "Could not delete tenant", message: getErrorMessage(err) });
    }
  }

  return (
    <RequireAuth>
      <PageHeader title="Tenants" description="Enterprise customer register, contact details, assigned config profile, and license usage." />
      {loading ? <LoadingPanel label="Loading tenants" /> : (
        <>
          <div className="page-stack">
            <div className="panel">
              <PanelHeader title="Enterprise customers" description="Usage counts are based on unique active device identifiers." actions={<IconAction label="New tenant" tone="primary" onClick={createNew}><Plus size={16} /></IconAction>} />
              {!tenants.length ? <EmptyState title="No tenants yet" message="Create a tenant before generating enterprise keys." /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Customer</th><th>Contact</th><th>Partner</th><th>License usage</th><th className="actions">Actions</th></tr></thead>
                <tbody>{tenants.map((tenant) => {
                  const usage = tenant.licenseUsage ?? {};
                  const capacity = usage.unlimited ? "unlimited" : usage.licensedDevices ?? 0;
                  return (
                    <tr key={tenant.id}>
                      <td><b>{tenant.name}</b><br /><span className="muted">{tenant.legalName || tenant.slug}</span><br /><StatusBadge status={tenant.status} /></td>
                      <td>{tenant.contactName || "-"}<br /><span className="muted">{tenant.contactEmail || tenant.billingEmail || ""}</span></td>
                      <td>{tenant.partner?.name ?? <span className="muted">Internal</span>}</td>
                      <td><b>{usage.activeDevices ?? 0}</b> active / {capacity}<br /><span className="muted">{usage.totalDevices ?? 0} total unique devices</span></td>
                      <td className="row actions"><IconAction label="Edit tenant" onClick={() => edit(tenant)}><Building2 size={14} /></IconAction><IconAction label="Delete tenant" tone="danger" onClick={() => deleteTenant(tenant)}><Trash2 size={14} /></IconAction></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
              )}
            </div>
          </div>
          <SidePanel
            open={editorOpen}
            wide
            title={selected ? "Edit tenant" : "Create tenant"}
            description="Keep customer identity, contacts, and default app configuration in one place."
            onClose={() => !saving && setEditorOpen(false)}
            footer={(
              <>
                <button type="button" className="button secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" form="tenant-editor-form" className="button" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save tenant"}</button>
              </>
            )}
          >
            <form id="tenant-editor-form" onSubmit={save} className="form-stack">
              <FormSection title="Customer identity" description="Core tenant identifiers used in admin lists and API responses.">
                <div className="grid three">
                  <div className="field"><FieldLabel>Name</FieldLabel><input className="input" placeholder="Acme Health" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div className="field"><FieldLabel help="Stable internal identifier used in API responses.">Slug</FieldLabel><input className="input" placeholder="acme-health" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
                  <div className="field"><FieldLabel>Status</FieldLabel><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="disabled">disabled</option><option value="prospect">prospect</option></select></div>
                  <div className="field"><FieldLabel>Legal name</FieldLabel><input className="input" placeholder="Acme Health AS" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Organization number</FieldLabel><input className="input" placeholder="999888777" value={form.organizationNumber} onChange={(e) => setForm({ ...form, organizationNumber: e.target.value })} /></div>
                </div>
              </FormSection>
              <FormSection title="Contacts" description="People and inboxes used for support, deployment and billing follow-up.">
                <div className="grid three">
                  <div className="field"><FieldLabel>Contact name</FieldLabel><input className="input" placeholder="Kari Nordmann" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Contact email</FieldLabel><input className="input" placeholder="kari@example.no" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Contact phone</FieldLabel><input className="input" placeholder="+47 900 00 000" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Billing email</FieldLabel><input className="input" placeholder="billing@example.no" type="email" value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} /></div>
                </div>
              </FormSection>
              <FormSection title="Address" description="Optional customer address metadata for internal records.">
                <div className="grid three">
                  <div className="field"><FieldLabel>Address</FieldLabel><input className="input" placeholder="Storgata 1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Address 2</FieldLabel><input className="input" placeholder="Floor 4" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Postal code</FieldLabel><input className="input" placeholder="0155" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
                  <div className="field"><FieldLabel>City</FieldLabel><input className="input" placeholder="Oslo" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Country</FieldLabel><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                </div>
              </FormSection>
              <FormSection title="Access and configuration" description="Partner scoping and default configuration returned to enterprise activations.">
                <div className="grid two">
                  <div className="field"><FieldLabel help="Partner admins assigned to this solution partner can manage this tenant.">Solution partner</FieldLabel><select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}><option value="">Internal / no partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>
                  <div className="field"><FieldLabel help="Default configuration returned to enterprise devices.">Config profile</FieldLabel><select value={form.configProfileId} onChange={(e) => setForm({ ...form, configProfileId: e.target.value })}><option value="">None</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div>
                </div>
              </FormSection>
              <FormSection title="Internal notes" description="Visible only in the admin portal.">
                <div className="field"><FieldLabel>Notes</FieldLabel><textarea placeholder="Internal notes for staff admins" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </FormSection>
            </form>
          </SidePanel>
        </>
      )}
    </RequireAuth>
  );
}
