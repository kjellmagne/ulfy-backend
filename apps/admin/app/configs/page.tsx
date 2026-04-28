"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { api } from "../../lib/api";

const empty = {
  name: "", description: "", speechProviderType: "", speechEndpointUrl: "", speechModelName: "",
  privacyControlEnabled: true, piiControlEnabled: true, presidioEndpointUrl: "", presidioSecretRef: "",
  privacyReviewProviderType: "", privacyReviewEndpointUrl: "", privacyReviewModel: "",
  documentGenerationProviderType: "", documentGenerationEndpointUrl: "", documentGenerationModel: "",
  templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest", telemetryEndpointUrl: "",
  featureFlagsText: "{\n  \"enterpriseTemplates\": true\n}", allowedProviderRestrictionsText: "[\"openai-compatible\"]"
};

export default function ConfigsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");

  async function load() { setProfiles(await api("/admin/config-profiles")); }
  useEffect(() => { load().catch(console.error); }, []);

  function edit(profile: any) {
    setSelected(profile.id);
    setForm({ ...empty, ...profile, featureFlagsText: JSON.stringify(profile.featureFlags ?? {}, null, 2), allowedProviderRestrictionsText: JSON.stringify(profile.allowedProviderRestrictions ?? [], null, 2) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, featureFlags: JSON.parse(form.featureFlagsText || "{}"), allowedProviderRestrictions: JSON.parse(form.allowedProviderRestrictionsText || "[]") };
    delete payload.featureFlagsText; delete payload.allowedProviderRestrictionsText;
    await api(selected ? `/admin/config-profiles/${selected}` : "/admin/config-profiles", { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
    setMessage("Saved"); setSelected(""); setForm(empty); load();
  }

  return (
    <RequireAuth>
      <div className="topbar"><h1>Config profiles</h1><span className="muted">{message}</span></div>
      <div className="page-stack">
        <form className="panel" onSubmit={save}>
          <h2>{selected ? "Edit profile" : "Create profile"}</h2>
          <div className="grid three">
            {["name", "description", "speechProviderType", "speechEndpointUrl", "speechModelName", "presidioEndpointUrl", "presidioSecretRef", "privacyReviewProviderType", "privacyReviewEndpointUrl", "privacyReviewModel", "documentGenerationProviderType", "documentGenerationEndpointUrl", "documentGenerationModel", "templateRepositoryUrl", "telemetryEndpointUrl"].map((key) => (
              <div className="field" key={key}><label>{key}</label><input className="input" value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key === "name"} /></div>
            ))}
          </div>
          <div className="row">
            <label><input type="checkbox" checked={form.privacyControlEnabled} onChange={(e) => setForm({ ...form, privacyControlEnabled: e.target.checked })} /> Privacy control</label>
            <label><input type="checkbox" checked={form.piiControlEnabled} onChange={(e) => setForm({ ...form, piiControlEnabled: e.target.checked })} /> PII control</label>
          </div>
          <div className="grid two">
            <div className="field"><label>Feature flags JSON</label><textarea value={form.featureFlagsText} onChange={(e) => setForm({ ...form, featureFlagsText: e.target.value })} /></div>
            <div className="field"><label>Allowed providers JSON</label><textarea value={form.allowedProviderRestrictionsText} onChange={(e) => setForm({ ...form, allowedProviderRestrictionsText: e.target.value })} /></div>
          </div>
          <button className="button"><Save size={16} /> Save</button>
        </form>
        <div className="panel">
          <h2>Profiles</h2>
          <table className="table"><tbody>{profiles.map((p) => <tr key={p.id}><td><b>{p.name}</b><br /><span className="muted">{p.description}</span></td><td><button className="button secondary" onClick={() => edit(p)}>Edit</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </RequireAuth>
  );
}
