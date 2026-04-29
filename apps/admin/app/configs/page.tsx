"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Settings, Trash2 } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatCard } from "../../components/AdminUI";
import { api } from "../../lib/api";

const empty = {
  name: "", description: "", partnerId: "", speechProviderType: "", speechEndpointUrl: "", speechModelName: "",
  privacyControlEnabled: true, piiControlEnabled: true, presidioEndpointUrl: "", presidioSecretRef: "",
  privacyReviewProviderType: "", privacyReviewEndpointUrl: "", privacyReviewModel: "",
  documentGenerationProviderType: "", documentGenerationEndpointUrl: "", documentGenerationModel: "",
  templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest", telemetryEndpointUrl: "",
  featureFlagsText: `{
  "enterpriseTemplates": true
}`, allowedProviderRestrictionsText: "[\"openai-compatible\"]"
};

export default function ConfigsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  async function load() {
    try {
      const [profileData, partnerData] = await Promise.all([api("/admin/config-profiles"), api("/admin/partners")]);
      setProfiles(profileData);
      setPartners(partnerData);
    }
    finally { setLoading(false); }
  }
  useEffect(() => { load().catch(console.error); }, []);

  function edit(profile: any) {
    setSelected(profile.id);
    setForm({ ...empty, ...profile, featureFlagsText: JSON.stringify(profile.featureFlags ?? {}, null, 2), allowedProviderRestrictionsText: JSON.stringify(profile.allowedProviderRestrictions ?? [], null, 2) });
    setMessage(`Editing ${profile.name}`);
    setError("");
    setEditorOpen(true);
  }

  function createNew() {
    setSelected("");
    setForm(empty);
    setMessage("Creating new profile");
    setError("");
    setEditorOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { ...form, partnerId: form.partnerId || null, featureFlags: JSON.parse(form.featureFlagsText || "{}"), allowedProviderRestrictions: JSON.parse(form.allowedProviderRestrictionsText || "[]") };
      delete payload.featureFlagsText; delete payload.allowedProviderRestrictionsText;
      await api(selected ? `/admin/config-profiles/${selected}` : "/admin/config-profiles", { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(selected ? "Profile updated" : "Profile created"); setSelected(""); setForm(empty); setEditorOpen(false); await load();
    } catch (err: any) {
      setError(err instanceof SyntaxError ? "Feature flags and allowed providers must be valid JSON." : err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(profile: any) {
    if (!window.confirm(`Delete ${profile.name}? This cannot be undone.`)) return;
    setError("");
    try {
      await api(`/admin/config-profiles/${profile.id}`, { method: "DELETE" });
      if (selected === profile.id) {
        setSelected("");
        setForm(empty);
        setEditorOpen(false);
      }
      setMessage("Profile deleted");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const internalProfiles = profiles.filter(p => !p.partnerId);
  const partnerProfiles = profiles.filter(p => p.partnerId);

  return (
    <RequireAuth>
      <PageHeader title="Config profiles" description="Central app settings returned to enterprise activations and refresh checks." meta={message && <span className="badge status-active">{message}</span>} />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading ? <LoadingPanel label="Loading config profiles" /> : (
        <>
          <div className="page-stack">
            {/* Stats */}
            <div className="grid three">
              <StatCard label="Total profiles" value={profiles.length} icon={<Settings size={18} />} sub={`${internalProfiles.length} internal`} />
              <StatCard label="Partner profiles" value={partnerProfiles.length} icon={<Settings size={18} />} sub="managed by partners" />
              <StatCard label="Privacy enabled" value={profiles.filter(p => p.privacyControlEnabled).length} icon={<Settings size={18} />} sub="profiles with privacy" />
            </div>

            <div className="panel">
              <PanelHeader title="Configuration profiles" description="Select a profile to edit or assign it when generating enterprise keys." actions={<button type="button" className="button" onClick={createNew}><Plus size={16} /> New profile</button>} />
              {!profiles.length ? <EmptyState title="No config profiles" message="Create the first profile before generating enterprise keys." /> : (
                <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Partner</th><th>Speech provider</th><th>Privacy</th><th>Template manifest</th><th className="actions">Actions</th></tr></thead><tbody>{profiles.map((p) => <tr key={p.id}><td><b>{p.name}</b><br /><span className="muted">{p.description || "No description"}</span></td><td>{p.partner?.name ?? <span className="muted">Internal</span>}</td><td>{p.speechProviderType || "-"}</td><td>{p.privacyControlEnabled ? "✓ Enabled" : <span className="muted">Disabled</span>}</td><td className="code" style={{ fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.templateRepositoryUrl || "-"}</td><td className="row actions"><button type="button" className="button secondary" onClick={() => edit(p)}>Edit</button><button type="button" className="button danger" onClick={() => deleteProfile(p)}><Trash2 size={14} /> Delete</button></td></tr>)}</tbody></table></div>
              )}
            </div>
          </div>
          <SidePanel
            open={editorOpen}
            title={selected ? "Edit profile" : "Create profile"}
            description="Keep provider endpoints, privacy controls, and mobile feature flags together."
            onClose={() => !saving && setEditorOpen(false)}
            footer={(
              <>
                <button type="button" className="button secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" form="config-editor-form" className="button" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save profile"}</button>
              </>
            )}
          >
            <form id="config-editor-form" onSubmit={save}>
              <div className="grid three">
                <div className="field"><FieldLabel help="Partner admins assigned to this solution partner can manage this profile.">Solution partner</FieldLabel><select value={form.partnerId ?? ""} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}><option value="">Internal / no partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>
                {["name", "description", "speechProviderType", "speechEndpointUrl", "speechModelName", "presidioEndpointUrl", "presidioSecretRef", "privacyReviewProviderType", "privacyReviewEndpointUrl", "privacyReviewModel", "documentGenerationProviderType", "documentGenerationEndpointUrl", "documentGenerationModel", "templateRepositoryUrl", "telemetryEndpointUrl"].map((key) => (
                  <div className="field" key={key}><FieldLabel>{labelFor(key)}</FieldLabel><input className="input" placeholder={placeholderFor(key)} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key === "name"} /></div>
                ))}
              </div>
              <div className="row" style={{ gap: '16px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={form.privacyControlEnabled} onChange={(e) => setForm({ ...form, privacyControlEnabled: e.target.checked })} /> Privacy control</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked={form.piiControlEnabled} onChange={(e) => setForm({ ...form, piiControlEnabled: e.target.checked })} /> PII control</label>
              </div>
              <details style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>Advanced JSON settings</summary>
                <div className="grid two">
                  <div className="field"><FieldLabel help="Object of mobile feature flags, for example enterpriseTemplates.">Feature flags JSON</FieldLabel><textarea value={form.featureFlagsText} onChange={(e) => setForm({ ...form, featureFlagsText: e.target.value })} /></div>
                  <div className="field"><FieldLabel help="Array of provider identifiers allowed for this customer.">Allowed providers JSON</FieldLabel><textarea value={form.allowedProviderRestrictionsText} onChange={(e) => setForm({ ...form, allowedProviderRestrictionsText: e.target.value })} /></div>
                </div>
              </details>
            </form>
          </SidePanel>
        </>
      )}
    </RequireAuth>
  );
}

function labelFor(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function placeholderFor(key: string) {
  if (key.endsWith("Url")) return "https://...";
  if (key === "name") return "Default Enterprise Profile";
  if (key.includes("Provider")) return "openai-compatible";
  if (key.includes("Model")) return "model-name";
  return "";
}
