"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, KeyRound, Plus, RotateCcw, ShieldX } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, Modal, PageHeader, PanelHeader, StatusBadge } from "../../components/AdminUI";
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
  const [partners, setPartners] = useState<any[]>([]);
  const [generated, setGenerated] = useState<{ key: string; kind: "single-user" | "enterprise"; label: string } | null>(null);
  const [form, setForm] = useState({ purchaserFullName: "", purchaserEmail: "", maintenanceUntil: defaultMaintenanceDate(), partnerId: "", notes: "" });
  const [enterpriseForm, setEnterpriseForm] = useState({ tenantId: "", configProfileId: "", maxDevices: 25, maintenanceUntil: defaultMaintenanceDate() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
  const [details, setDetails] = useState<{ kind: "single" | "enterprise"; key: any } | null>(null);

  async function load() {
    try {
      const [s, e, t, p, partnerData] = await Promise.all([api("/admin/single-keys"), api("/admin/enterprise-keys"), api("/admin/tenants"), api("/admin/config-profiles"), api("/admin/partners")]);
      setSingle(s); setEnterprise(e); setTenants(t); setProfiles(p); setPartners(partnerData);
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
      const res = await api("/admin/single-keys", { method: "POST", body: JSON.stringify({ ...form, partnerId: form.partnerId || undefined }) });
      setGenerated({ key: res.activationKey, kind: "single-user", label: form.purchaserEmail });
      setForm({ purchaserFullName: "", purchaserEmail: "", maintenanceUntil: defaultMaintenanceDate(), partnerId: "", notes: "" });
      setSingleModalOpen(false);
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
      setEnterpriseModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  return (
    <RequireAuth>
      <PageHeader
        title="License keys"
        description="Generate, inspect, revoke, and reset activation keys. Full keys are shown once after generation."
        meta={(
          <>
            <button type="button" className="button" onClick={() => setSingleModalOpen(true)}><Plus size={16} /> Single-user key</button>
            <button type="button" className="button secondary" onClick={() => setEnterpriseModalOpen(true)} disabled={!tenants.length || !profiles.length}><Plus size={16} /> Enterprise key</button>
          </>
        )}
      />
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
        <>
          <div className="page-stack">
            <div className="panel">
              <PanelHeader title="Single-user keys" description="Double-click a row to view all associated details. Full activation keys are hashed and cannot be recovered later." />
              {!single.length ? <EmptyState title="No single-user keys" message="Generate a key above to make it available for activation." /> : (
                <div className="table-wrap"><table className="table"><thead><tr><th>Purchaser</th><th>Partner</th><th>Prefix</th><th>Status</th><th>Maintenance</th><th>Device</th><th>Last seen</th><th className="actions">Actions</th></tr></thead><tbody>{single.map((k) => <tr key={k.id} className="clickable-row" title="Double-click to view license details" onDoubleClick={() => setDetails({ kind: "single", key: k })}><td><b>{k.purchaserFullName}</b><br /><span className="muted">{k.purchaserEmail}</span></td><td>{k.partner?.name ?? <span className="muted">Internal</span>}</td><td>{k.keyPrefix}</td><td><StatusBadge status={k.status} /></td><td>{formatDate(k.maintenanceUntil)}</td><td>{k.deviceIdentifier ?? "-"}</td><td>{formatDateTime(k.lastSeenAt)}</td><td className="row actions"><button type="button" className="button secondary" title="View license details" onClick={() => setDetails({ kind: "single", key: k })}><Eye size={14} /></button><button type="button" className="button danger" title="Revoke license" onClick={() => api(`/admin/single-keys/${k.id}/revoke`, { method: "PATCH" }).then(load)}><ShieldX size={14} /></button><button type="button" className="button secondary" title="Reset device binding" onClick={() => api(`/admin/single-keys/${k.id}/reset`, { method: "PATCH" }).then(load)}><RotateCcw size={14} /></button></td></tr>)}</tbody></table></div>
              )}
            </div>
            <div className="panel">
              <PanelHeader title="Enterprise keys" description="Double-click a row to inspect tenant, config, and device activation details." />
              {!enterprise.length ? <EmptyState title="No enterprise keys" message="Create a tenant and config profile, then generate an enterprise key." /> : (
                <div className="table-wrap"><table className="table"><thead><tr><th>Tenant</th><th>Partner</th><th>Prefix</th><th>Status</th><th>Maintenance</th><th>Devices</th><th>Config</th><th className="actions">Actions</th></tr></thead><tbody>{enterprise.map((k) => <tr key={k.id} className="clickable-row" title="Double-click to view license details" onDoubleClick={() => setDetails({ kind: "enterprise", key: k })}><td><b>{k.tenant?.name}</b></td><td>{k.partner?.name ?? <span className="muted">Internal</span>}</td><td>{k.keyPrefix}</td><td><StatusBadge status={k.status} /></td><td>{formatDate(k.maintenanceUntil)}</td><td>{k.activations?.length ?? 0}/{k.maxDevices ?? "unlimited"}</td><td>{k.configProfile?.name}</td><td className="row actions"><button type="button" className="button secondary" title="View license details" onClick={() => setDetails({ kind: "enterprise", key: k })}><Eye size={14} /></button></td></tr>)}</tbody></table></div>
              )}
            </div>
          </div>
          <Modal
            open={singleModalOpen}
            title="Generate single-user key"
            description="For one purchaser and one bound device in v1."
            onClose={() => saving !== "single" && setSingleModalOpen(false)}
            footer={(
              <>
                <button type="button" className="button secondary" onClick={() => setSingleModalOpen(false)} disabled={saving === "single"}>Cancel</button>
                <button type="submit" form="single-key-form" className="button" disabled={saving === "single"}><KeyRound size={16} /> {saving === "single" ? "Generating..." : "Generate key"}</button>
              </>
            )}
          >
            <form id="single-key-form" onSubmit={createSingle}>
              <div className="field"><FieldLabel>Purchaser full name</FieldLabel><input className="input" placeholder="Ola Nordmann" value={form.purchaserFullName} onChange={(e) => setForm({ ...form, purchaserFullName: e.target.value })} required /></div>
              <div className="field"><FieldLabel>Email</FieldLabel><input className="input" placeholder="ola@example.com" type="email" value={form.purchaserEmail} onChange={(e) => setForm({ ...form, purchaserEmail: e.target.value })} required /></div>
              <div className="field"><FieldLabel help="Shown to the iPhone app as support coverage.">Maintenance until</FieldLabel><input className="input" type="date" value={form.maintenanceUntil} onChange={(e) => setForm({ ...form, maintenanceUntil: e.target.value })} /></div>
              <div className="field"><FieldLabel help="Partner admins assigned to this solution partner can manage this key.">Solution partner</FieldLabel><select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}><option value="">Internal / no partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>
              <div className="field"><FieldLabel>Notes</FieldLabel><input className="input" placeholder="Internal context or purchase reference" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </form>
          </Modal>
          <Modal
            open={enterpriseModalOpen}
            title="Generate enterprise key"
            description="Links a tenant, device allowance, and central config profile."
            onClose={() => saving !== "enterprise" && setEnterpriseModalOpen(false)}
            footer={(
              <>
                <button type="button" className="button secondary" onClick={() => setEnterpriseModalOpen(false)} disabled={saving === "enterprise"}>Cancel</button>
                <button type="submit" form="enterprise-key-form" className="button" disabled={saving === "enterprise" || !tenants.length || !profiles.length}><KeyRound size={16} /> {saving === "enterprise" ? "Generating..." : "Generate key"}</button>
              </>
            )}
          >
            <form id="enterprise-key-form" onSubmit={createEnterprise}>
              <div className="field"><FieldLabel>Tenant</FieldLabel><select value={enterpriseForm.tenantId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, tenantId: e.target.value })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="field"><FieldLabel help="Returned to the app after activation and refresh.">Config profile</FieldLabel><select value={enterpriseForm.configProfileId} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, configProfileId: e.target.value })}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="field"><FieldLabel help="Leave blank in the API for unlimited.">Max devices</FieldLabel><input className="input" type="number" min={1} value={enterpriseForm.maxDevices} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, maxDevices: Number(e.target.value) })} /></div>
              <div className="field"><FieldLabel help="Shown to users as maintenance/support coverage.">Maintenance until</FieldLabel><input className="input" type="date" value={enterpriseForm.maintenanceUntil} onChange={(e) => setEnterpriseForm({ ...enterpriseForm, maintenanceUntil: e.target.value })} /></div>
            </form>
          </Modal>
          <Modal
            open={Boolean(details)}
            title={details?.kind === "single" ? "Single-user license details" : "Enterprise license details"}
            description="Complete stored metadata for this license key. The full activation key cannot be recovered after generation."
            onClose={() => setDetails(null)}
            wide
          >
            {details?.kind === "single" && <SingleLicenseDetails licenseKey={details.key} />}
            {details?.kind === "enterprise" && <EnterpriseLicenseDetails licenseKey={details.key} />}
          </Modal>
        </>
      )}
    </RequireAuth>
  );
}

function SingleLicenseDetails({ licenseKey }: { licenseKey: any }) {
  return (
    <div className="page-stack">
      <section>
        <h3>License</h3>
        <div className="detail-grid">
          <Detail label="ID" value={licenseKey.id} mono />
          <Detail label="Key prefix" value={licenseKey.keyPrefix} mono />
          <Detail label="Status" value={<StatusBadge status={licenseKey.status} />} />
          <Detail label="Purchaser" value={licenseKey.purchaserFullName} />
          <Detail label="Email" value={licenseKey.purchaserEmail} />
          <Detail label="Partner" value={licenseKey.partner?.name} />
          <Detail label="Purchase date" value={formatDate(licenseKey.purchaseDate)} />
          <Detail label="Generated at" value={formatDateTime(licenseKey.generatedAt)} />
          <Detail label="Activated at" value={formatDateTime(licenseKey.activatedAt)} />
          <Detail label="Maintenance until" value={formatDate(licenseKey.maintenanceUntil)} />
          <Detail label="Expires at" value={formatDateTime(licenseKey.expiresAt)} />
          <Detail label="Created at" value={formatDateTime(licenseKey.createdAt)} />
          <Detail label="Updated at" value={formatDateTime(licenseKey.updatedAt)} />
        </div>
      </section>
      <section>
        <h3>Bound device</h3>
        <div className="detail-grid">
          <Detail label="Device identifier" value={licenseKey.deviceIdentifier} mono />
          <Detail label="Serial number" value={licenseKey.deviceSerialNumber} mono />
          <Detail label="App version" value={licenseKey.appVersion} />
          <Detail label="Last check-in" value={formatDateTime(licenseKey.lastCheckIn)} />
          <Detail label="Last seen" value={formatDateTime(licenseKey.lastSeenAt)} />
        </div>
      </section>
      <Notes value={licenseKey.notes} />
      <ActivationDetails activations={licenseKey.activations ?? []} />
    </div>
  );
}

function EnterpriseLicenseDetails({ licenseKey }: { licenseKey: any }) {
  return (
    <div className="page-stack">
      <section>
        <h3>License</h3>
        <div className="detail-grid">
          <Detail label="ID" value={licenseKey.id} mono />
          <Detail label="Key prefix" value={licenseKey.keyPrefix} mono />
          <Detail label="Status" value={<StatusBadge status={licenseKey.status} />} />
          <Detail label="Max devices" value={licenseKey.maxDevices ?? "unlimited"} />
          <Detail label="Registered devices" value={licenseKey.activations?.length ?? 0} />
          <Detail label="Maintenance until" value={formatDate(licenseKey.maintenanceUntil)} />
          <Detail label="Expires at" value={formatDateTime(licenseKey.expiresAt)} />
          <Detail label="Generated at" value={formatDateTime(licenseKey.generatedAt)} />
          <Detail label="Created at" value={formatDateTime(licenseKey.createdAt)} />
          <Detail label="Updated at" value={formatDateTime(licenseKey.updatedAt)} />
          <Detail label="Partner" value={licenseKey.partner?.name} />
        </div>
      </section>
      <section>
        <h3>Tenant</h3>
        <div className="detail-grid">
          <Detail label="Tenant ID" value={licenseKey.tenant?.id} mono />
          <Detail label="Name" value={licenseKey.tenant?.name} />
          <Detail label="Slug" value={licenseKey.tenant?.slug} mono />
          <Detail label="Legal name" value={licenseKey.tenant?.legalName} />
          <Detail label="Contact" value={licenseKey.tenant?.contactName} />
          <Detail label="Contact email" value={licenseKey.tenant?.contactEmail} />
          <Detail label="Billing email" value={licenseKey.tenant?.billingEmail} />
          <Detail label="Status" value={licenseKey.tenant?.status} />
        </div>
      </section>
      <section>
        <h3>Config profile</h3>
        <div className="detail-grid">
          <Detail label="Config ID" value={licenseKey.configProfile?.id} mono />
          <Detail label="Name" value={licenseKey.configProfile?.name} />
          <Detail label="Speech provider" value={licenseKey.configProfile?.speechProviderType} />
          <Detail label="Speech model" value={licenseKey.configProfile?.speechModelName} />
          <Detail label="Privacy control" value={yesNo(licenseKey.configProfile?.privacyControlEnabled)} />
          <Detail label="PII control" value={yesNo(licenseKey.configProfile?.piiControlEnabled)} />
          <Detail label="Template repository" value={licenseKey.configProfile?.templateRepositoryUrl} />
          <Detail label="Telemetry endpoint" value={licenseKey.configProfile?.telemetryEndpointUrl} />
        </div>
      </section>
      <Notes value={licenseKey.notes} />
      <ActivationDetails activations={licenseKey.activations ?? []} />
    </div>
  );
}

function ActivationDetails({ activations }: { activations: any[] }) {
  return (
    <section>
      <h3>Device activations</h3>
      {!activations.length ? <EmptyState title="No activations" message="This key has not been used by a device yet." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Device</th><th>Serial</th><th>Status</th><th>App</th><th>Activated</th><th>Last seen</th></tr></thead>
            <tbody>{activations.map((activation) => (
              <tr key={activation.id}>
                <td><span className="code">{activation.deviceIdentifier}</span></td>
                <td>{activation.deviceSerialNumber ?? "-"}</td>
                <td><StatusBadge status={activation.status} /></td>
                <td>{activation.appVersion ?? "-"}</td>
                <td>{formatDateTime(activation.activatedAt)}</td>
                <td>{formatDateTime(activation.lastSeenAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Notes({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <section>
      <h3>Notes</h3>
      <div className="code">{value}</div>
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  const content = value == null || value === "" ? "-" : value;
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong className={mono ? "code" : undefined}>{content}</strong>
    </div>
  );
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function yesNo(value?: boolean | null) {
  if (value == null) return "-";
  return value ? "Yes" : "No";
}
