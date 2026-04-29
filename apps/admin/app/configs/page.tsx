"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatCard, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

const speechProviders = [
  { value: "", label: "Not managed", privacy: "Local setting kept", endpoint: false, model: false, diarization: false, ready: true },
  { value: "local", label: "Local", privacy: "Safe", endpoint: false, model: false, diarization: false, ready: true },
  { value: "apple_online", label: "Apple Online", privacy: "Use with caution", endpoint: false, model: false, diarization: false, ready: true },
  { value: "openai", label: "OpenAI Speech", privacy: "Use with caution", endpoint: true, model: true, diarization: true, ready: true, endpointDefault: "https://api.openai.com/v1", modelDefault: "gpt-4o-transcribe" },
  { value: "azure", label: "Azure / on-prem speech", privacy: "Safe", endpoint: true, model: false, diarization: false, ready: true, endpointDefault: "http://192.168.222.171:5000" },
  { value: "gemini", label: "Gemini Speech", privacy: "Use with caution", endpoint: true, model: true, diarization: false, ready: false, endpointDefault: "https://generativelanguage.googleapis.com", modelDefault: "gemini-live-2.5-flash-preview" }
];

const formatterProviders = [
  { value: "", label: "Not managed", ready: true, endpoint: false, model: false, privacy: "Local setting kept" },
  { value: "apple_intelligence", label: "Apple Intelligence", ready: true, endpoint: false, model: false, privacy: "Safe" },
  { value: "openai", label: "OpenAI", ready: true, endpoint: true, model: true, privacy: "Unsafe by default", endpointDefault: "https://api.openai.com/v1", modelDefault: "gpt-5-mini" },
  { value: "ollama", label: "Ollama", ready: true, endpoint: true, model: true, privacy: "Managed by default", endpointDefault: "http://localhost:11434", modelDefault: "llama3.1:8b" },
  { value: "vllm", label: "vLLM", ready: true, endpoint: true, model: true, privacy: "Managed by deployment", endpointDefault: "http://localhost:8000/v1", modelDefault: "meta-llama/Meta-Llama-3.1-8B-Instruct" },
  { value: "openai_compatible", label: "OpenAI-compatible", ready: true, endpoint: true, model: true, privacy: "Managed by default" },
  { value: "gemini", label: "Gemini", ready: false, endpoint: true, model: true, privacy: "Unsafe by default", endpointDefault: "https://generativelanguage.googleapis.com", modelDefault: "gemini-2.5-flash" },
  { value: "claude", label: "Claude", ready: false, endpoint: true, model: true, privacy: "Unsafe by default", endpointDefault: "https://api.anthropic.com/v1", modelDefault: "claude-sonnet-4-6" }
];

const privacyReviewProviders = [
  { value: "", label: "Not managed", ready: true, privacy: "Local setting kept" },
  { value: "local_heuristic", label: "Local heuristic", ready: true, privacy: "Safe" },
  { value: "ollama", label: "Ollama", ready: true, privacy: "Safe only when explicitly approved", endpointDefault: "http://localhost:11434", modelDefault: "llama3.1:8b" },
  { value: "openai_compatible", label: "OpenAI-compatible", ready: true, privacy: "Safe only when explicitly approved" },
  { value: "openai", label: "OpenAI", ready: false, privacy: "Not recommended for privacy review" },
  { value: "gemini", label: "Gemini", ready: false, privacy: "Coming soon / not recommended" },
  { value: "claude", label: "Claude", ready: false, privacy: "Coming soon / not recommended" }
];

const empty = {
  name: "",
  description: "",
  partnerId: "",
  speechProviderType: "",
  speechEndpointUrl: "",
  speechModelName: "",
  speechDiarizationEnabled: false,
  privacyControlEnabled: true,
  piiControlEnabled: true,
  presidioEndpointUrl: "",
  presidioSecretRef: "",
  piiScoreThreshold: "0.70",
  detectEmail: true,
  detectPhone: true,
  detectPerson: true,
  detectLocation: true,
  detectIdentifier: true,
  fullPersonNamesOnly: false,
  privacyReviewProviderType: "local_heuristic",
  privacyReviewEndpointUrl: "",
  privacyReviewModel: "",
  privacyReviewPrivacyEmphasis: "safe",
  documentGenerationProviderType: "apple_intelligence",
  documentGenerationEndpointUrl: "",
  documentGenerationModel: "",
  formatterPrivacyEmphasis: "safe",
  templateRepositoryUrl: "http://localhost:4000/api/v1/templates/manifest",
  telemetryEndpointUrl: "",
  developerMode: false,
  allowExternalProviders: false,
  userMayChangeSpeechProvider: false,
  userMayChangeFormatter: false,
  userMayChangePrivacyReviewProvider: false,
  externalFormattersAllowed: false,
  defaultTemplateId: "",
  allowedProviderRestrictionsText: "[\"openai_compatible\"]"
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
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load().catch(console.error); }, []);

  const stats = useMemo(() => ({
    total: profiles.length,
    speechManaged: profiles.filter((profile) => profile.speechProviderType).length,
    privacyEnabled: profiles.filter((profile) => profile.privacyControlEnabled).length,
    safeReview: profiles.filter((profile) => ["local_heuristic", "ollama", "openai_compatible"].includes(profile.privacyReviewProviderType)).length
  }), [profiles]);

  function edit(profile: any) {
    const providerProfiles = profile.providerProfiles ?? {};
    const managedPolicy = profile.managedPolicy ?? {};
    setSelected(profile.id);
    setForm({
      ...empty,
      ...profile,
      partnerId: profile.partnerId ?? "",
      speechDiarizationEnabled: providerProfiles?.speech?.speakerDiarizationEnabled ?? false,
      piiScoreThreshold: String(providerProfiles?.presidio?.scoreThreshold ?? "0.70"),
      detectEmail: providerProfiles?.presidio?.detectEmail ?? true,
      detectPhone: providerProfiles?.presidio?.detectPhone ?? true,
      detectPerson: providerProfiles?.presidio?.detectPerson ?? true,
      detectLocation: providerProfiles?.presidio?.detectLocation ?? true,
      detectIdentifier: providerProfiles?.presidio?.detectIdentifier ?? true,
      fullPersonNamesOnly: providerProfiles?.presidio?.fullPersonNamesOnly ?? false,
      formatterPrivacyEmphasis: providerProfiles?.formatter?.privacyEmphasis ?? "managed",
      privacyReviewPrivacyEmphasis: providerProfiles?.privacyReview?.privacyEmphasis ?? "safe",
      developerMode: profile.featureFlags?.developerMode ?? false,
      allowExternalProviders: profile.featureFlags?.allowExternalProviders ?? false,
      userMayChangeSpeechProvider: managedPolicy?.userMayChangeSpeechProvider ?? false,
      userMayChangeFormatter: managedPolicy?.userMayChangeFormatter ?? false,
      userMayChangePrivacyReviewProvider: managedPolicy?.userMayChangePrivacyReviewProvider ?? false,
      externalFormattersAllowed: managedPolicy?.externalFormattersAllowed ?? false,
      allowedProviderRestrictionsText: JSON.stringify(profile.allowedProviderRestrictions ?? [], null, 2),
      defaultTemplateId: profile.defaultTemplateId ?? ""
    });
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

  function applyProviderDefault(kind: "speech" | "formatter" | "review", value: string) {
    if (kind === "speech") {
      const provider = speechProviders.find((item) => item.value === value);
      setForm((current: any) => ({
        ...current,
        speechProviderType: value,
        speechEndpointUrl: provider?.endpoint ? (provider?.endpointDefault && !current.speechEndpointUrl ? provider.endpointDefault : current.speechEndpointUrl) : "",
        speechModelName: provider?.model ? (provider?.modelDefault && !current.speechModelName ? provider.modelDefault : current.speechModelName) : "",
        speechDiarizationEnabled: value === "openai" ? current.speechDiarizationEnabled : false
      }));
      return;
    }
    if (kind === "formatter") {
      const provider = formatterProviders.find((item) => item.value === value);
      setForm((current: any) => ({
        ...current,
        documentGenerationProviderType: value,
        documentGenerationEndpointUrl: provider?.endpoint ? (provider?.endpointDefault && !current.documentGenerationEndpointUrl ? provider.endpointDefault : current.documentGenerationEndpointUrl) : "",
        documentGenerationModel: provider?.model ? (provider?.modelDefault && !current.documentGenerationModel ? provider.modelDefault : current.documentGenerationModel) : "",
        formatterPrivacyEmphasis: value === "apple_intelligence" ? "safe" : current.formatterPrivacyEmphasis
      }));
      return;
    }
    const provider = privacyReviewProviders.find((item) => item.value === value);
    setForm((current: any) => ({
      ...current,
      privacyReviewProviderType: value,
      privacyReviewEndpointUrl: value && value !== "local_heuristic" ? (provider?.endpointDefault && !current.privacyReviewEndpointUrl ? provider.endpointDefault : current.privacyReviewEndpointUrl) : "",
      privacyReviewModel: value && value !== "local_heuristic" ? (provider?.modelDefault && !current.privacyReviewModel ? provider.modelDefault : current.privacyReviewModel) : "",
      privacyReviewPrivacyEmphasis: ["local_heuristic", "ollama", "openai_compatible"].includes(value) ? "safe" : current.privacyReviewPrivacyEmphasis
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const allowedProviderRestrictions = JSON.parse(form.allowedProviderRestrictionsText || "[]");
      const featureFlags = {
        enterpriseTemplates: true,
        developerMode: Boolean(form.developerMode),
        allowExternalProviders: Boolean(form.allowExternalProviders)
      };
      const providerProfiles = {
        speech: {
          selected: form.speechProviderType || null,
          speakerDiarizationEnabled: Boolean(form.speechDiarizationEnabled),
          privacyClass: speechProviders.find((item) => item.value === form.speechProviderType)?.privacy ?? null
        },
        formatter: {
          selected: form.documentGenerationProviderType || null,
          privacyEmphasis: form.formatterPrivacyEmphasis,
          privacyClass: formatterProviders.find((item) => item.value === form.documentGenerationProviderType)?.privacy ?? null
        },
        presidio: {
          scoreThreshold: Number(form.piiScoreThreshold || 0.7),
          detectEmail: Boolean(form.detectEmail),
          detectPhone: Boolean(form.detectPhone),
          detectPerson: Boolean(form.detectPerson),
          detectLocation: Boolean(form.detectLocation),
          detectIdentifier: Boolean(form.detectIdentifier),
          fullPersonNamesOnly: Boolean(form.fullPersonNamesOnly)
        },
        privacyReview: {
          selected: form.privacyReviewProviderType || null,
          privacyEmphasis: form.privacyReviewPrivacyEmphasis,
          eligibleForReview: ["local_heuristic", "ollama", "openai_compatible"].includes(form.privacyReviewProviderType) && form.privacyReviewPrivacyEmphasis === "safe"
        }
      };
      const managedPolicy = {
        userMayChangeSpeechProvider: Boolean(form.userMayChangeSpeechProvider),
        userMayChangeFormatter: Boolean(form.userMayChangeFormatter),
        userMayChangePrivacyReviewProvider: Boolean(form.userMayChangePrivacyReviewProvider),
        externalFormattersAllowed: Boolean(form.externalFormattersAllowed),
        privacyControlRequired: Boolean(form.privacyControlEnabled),
        piiRequired: Boolean(form.piiControlEnabled)
      };
      const speechProvider = speechProviders.find((item) => item.value === form.speechProviderType);
      const formatterProvider = formatterProviders.find((item) => item.value === form.documentGenerationProviderType);
      const reviewProvider = privacyReviewProviders.find((item) => item.value === form.privacyReviewProviderType);
      const payload = {
        name: form.name,
        description: form.description,
        partnerId: form.partnerId || null,
        speechProviderType: form.speechProviderType || null,
        speechEndpointUrl: speechProvider?.endpoint ? form.speechEndpointUrl || null : null,
        speechModelName: speechProvider?.model ? form.speechModelName || null : null,
        privacyControlEnabled: Boolean(form.privacyControlEnabled),
        piiControlEnabled: Boolean(form.piiControlEnabled),
        presidioEndpointUrl: form.presidioEndpointUrl || null,
        presidioSecretRef: form.presidioSecretRef || null,
        privacyReviewProviderType: form.privacyReviewProviderType || null,
        privacyReviewEndpointUrl: reviewProvider && form.privacyReviewProviderType !== "local_heuristic" ? form.privacyReviewEndpointUrl || null : null,
        privacyReviewModel: reviewProvider && form.privacyReviewProviderType !== "local_heuristic" ? form.privacyReviewModel || null : null,
        documentGenerationProviderType: form.documentGenerationProviderType || null,
        documentGenerationEndpointUrl: formatterProvider?.endpoint ? form.documentGenerationEndpointUrl || null : null,
        documentGenerationModel: formatterProvider?.model ? form.documentGenerationModel || null : null,
        templateRepositoryUrl: form.templateRepositoryUrl || null,
        telemetryEndpointUrl: form.telemetryEndpointUrl || null,
        featureFlags,
        allowedProviderRestrictions,
        providerProfiles,
        managedPolicy,
        defaultTemplateId: form.defaultTemplateId || null
      };

      await api(selected ? `/admin/config-profiles/${selected}` : "/admin/config-profiles", { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(selected ? "Profile updated" : "Profile created");
      setSelected("");
      setForm(empty);
      setEditorOpen(false);
      await load();
    } catch (err: any) {
      setError(err instanceof SyntaxError ? "Allowed providers must be valid JSON." : err.message);
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

  return (
    <RequireAuth>
      <PageHeader title="Config profiles" description="Enterprise app settings with speech, formatter, Presidio and privacy review kept as separate provider domains." meta={message && <span className="badge status-active">{message}</span>} />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading ? <LoadingPanel label="Loading config profiles" /> : (
        <>
          <div className="page-stack">
            <div className="grid four">
              <StatCard label="Profiles" value={stats.total} icon={<Settings size={18} />} sub="enterprise configs" />
              <StatCard label="Speech managed" value={stats.speechManaged} icon={<Settings size={18} />} sub="selected centrally" />
              <StatCard label="Privacy enabled" value={stats.privacyEnabled} icon={<ShieldCheck size={18} />} sub="guardrail master toggle" />
              <StatCard label="Safe review" value={stats.safeReview} icon={<ShieldCheck size={18} />} sub="eligible providers" />
            </div>

            <div className="panel">
              <PanelHeader title="Configuration profiles" description="List first. Open a profile to edit provider selections and policy in a slide-in panel." actions={<button type="button" className="button" onClick={createNew}><Plus size={16} /> New profile</button>} />
              {!profiles.length ? <EmptyState title="No config profiles" message="Create the first profile before generating enterprise keys." /> : (
                <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Partner</th><th>Speech</th><th>Formatter</th><th>Privacy review</th><th className="actions">Actions</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id} onDoubleClick={() => edit(profile)}><td><b>{profile.name}</b><br /><span className="muted">{profile.description || "No description"}</span></td><td>{profile.partner?.name ?? <span className="muted">Internal</span>}</td><td>{profile.speechProviderType ? <span className="badge">{profile.speechProviderType}</span> : <span className="muted">Local</span>}</td><td>{profile.documentGenerationProviderType ? <span className="badge">{profile.documentGenerationProviderType}</span> : <span className="muted">Local</span>}</td><td><div className="row"><StatusBadge status={profile.privacyControlEnabled ? "active" : "draft"} />{profile.privacyReviewProviderType && <span className="badge">{profile.privacyReviewProviderType}</span>}</div></td><td className="row actions"><button type="button" className="button secondary" onClick={() => edit(profile)}>Edit</button><button type="button" className="button danger" onClick={() => deleteProfile(profile)}><Trash2 size={14} /> Delete</button></td></tr>)}</tbody></table></div>
              )}
            </div>
          </div>

          <SidePanel
            open={editorOpen}
            wide
            title={selected ? "Edit Config Profile" : "Create Config Profile"}
            description="Only fields set here are sent in the mobile config. Provider-profile metadata is stored for backend/admin policy."
            onClose={() => !saving && setEditorOpen(false)}
            footer={<><button type="button" className="button secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button><button type="submit" form="config-editor-form" className="button" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save profile"}</button></>}
          >
            <form id="config-editor-form" onSubmit={save} className="config-form">
              <section className="config-section">
                <PanelHeader title="Profile" description="Ownership and plain-language description." />
                <div className="grid three">
                  <div className="field"><FieldLabel>Name</FieldLabel><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div className="field"><FieldLabel>Description</FieldLabel><input className="input" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="field"><FieldLabel help="Partner admins assigned to this solution partner can manage this profile.">Solution partner</FieldLabel><select value={form.partnerId ?? ""} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}><option value="">Internal / no partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>
                </div>
              </section>

              <section className="config-section">
                <PanelHeader title="Speech Provider" description="One selected speech source. This is separate from document generation and privacy review." />
                <ProviderHint provider={speechProviders.find((item) => item.value === form.speechProviderType)} />
                <div className="grid three">
                  <div className="field"><FieldLabel>Selected speech provider</FieldLabel><select value={form.speechProviderType ?? ""} onChange={(e) => applyProviderDefault("speech", e.target.value)}>{speechProviders.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}{provider.ready ? "" : " (coming soon)"}</option>)}</select></div>
                  <div className="field"><FieldLabel>Endpoint URL</FieldLabel><input className="input" value={form.speechEndpointUrl ?? ""} onChange={(e) => setForm({ ...form, speechEndpointUrl: e.target.value })} disabled={!speechProviders.find((item) => item.value === form.speechProviderType)?.endpoint} /></div>
                  <div className="field"><FieldLabel>Model name</FieldLabel><input className="input" value={form.speechModelName ?? ""} onChange={(e) => setForm({ ...form, speechModelName: e.target.value })} disabled={!speechProviders.find((item) => item.value === form.speechProviderType)?.model} /></div>
                </div>
                <label className="checkbox-row"><input type="checkbox" checked={form.speechDiarizationEnabled} disabled={form.speechProviderType !== "openai"} onChange={(e) => setForm({ ...form, speechDiarizationEnabled: e.target.checked })} /> OpenAI saved-recording diarization enabled</label>
              </section>

              <section className="config-section">
                <PanelHeader title="Document Generation Formatter" description="The formatter creates the final document. It is not the speech provider and not the privacy review provider." />
                <ProviderHint provider={formatterProviders.find((item) => item.value === form.documentGenerationProviderType)} />
                <div className="grid four">
                  <div className="field"><FieldLabel>Selected formatter</FieldLabel><select value={form.documentGenerationProviderType ?? ""} onChange={(e) => applyProviderDefault("formatter", e.target.value)}>{formatterProviders.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}{provider.ready ? "" : " (coming soon)"}</option>)}</select></div>
                  <div className="field"><FieldLabel>Endpoint URL</FieldLabel><input className="input" value={form.documentGenerationEndpointUrl ?? ""} onChange={(e) => setForm({ ...form, documentGenerationEndpointUrl: e.target.value })} disabled={!formatterProviders.find((item) => item.value === form.documentGenerationProviderType)?.endpoint} /></div>
                  <div className="field"><FieldLabel>Model name</FieldLabel><input className="input" value={form.documentGenerationModel ?? ""} onChange={(e) => setForm({ ...form, documentGenerationModel: e.target.value })} disabled={!formatterProviders.find((item) => item.value === form.documentGenerationProviderType)?.model} /></div>
                  <div className="field"><FieldLabel help="Stored for admin policy. Current mobile payload does not centrally inject provider secrets.">Privacy classification</FieldLabel><select value={form.formatterPrivacyEmphasis} onChange={(e) => setForm({ ...form, formatterPrivacyEmphasis: e.target.value })}><option value="safe">safe</option><option value="managed">managed</option><option value="caution">caution</option><option value="unsafe">unsafe</option></select></div>
                </div>
              </section>

              <section className="config-section">
                <PanelHeader title="Privacy Control" description="Master guardrail switch plus two independent substeps: Presidio PII and privacy review." />
                <div className="row checkbox-group">
                  <label className="checkbox-row"><input type="checkbox" checked={form.privacyControlEnabled} onChange={(e) => setForm({ ...form, privacyControlEnabled: e.target.checked })} /> Privacy control enabled</label>
                  <label className="checkbox-row"><input type="checkbox" checked={form.piiControlEnabled} onChange={(e) => setForm({ ...form, piiControlEnabled: e.target.checked })} /> Presidio PII enabled</label>
                </div>
                <div className="config-subsection">
                  <PanelHeader title="Presidio PII Analyzer" description="The app appends /health and /analyze to this base URL." />
                  <div className="grid three">
                    <div className="field"><FieldLabel>Presidio endpoint URL</FieldLabel><input className="input" value={form.presidioEndpointUrl ?? ""} onChange={(e) => setForm({ ...form, presidioEndpointUrl: e.target.value })} /></div>
                    <div className="field"><FieldLabel>Secret reference</FieldLabel><input className="input" value={form.presidioSecretRef ?? ""} onChange={(e) => setForm({ ...form, presidioSecretRef: e.target.value })} placeholder="secret://ulfy/presidio" /></div>
                    <div className="field"><FieldLabel>Score threshold</FieldLabel><input className="input" type="number" min="0" max="1" step="0.05" value={form.piiScoreThreshold} onChange={(e) => setForm({ ...form, piiScoreThreshold: e.target.value })} /></div>
                  </div>
                  <div className="row checkbox-group">
                    {["detectEmail", "detectPhone", "detectPerson", "detectLocation", "detectIdentifier", "fullPersonNamesOnly"].map((key) => <label key={key} className="checkbox-row"><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} /> {labelFor(key)}</label>)}
                  </div>
                </div>
                <div className="config-subsection">
                  <PanelHeader title="Privacy Review / Guardrail" description="Custom review providers are eligible only when explicitly classified as safe." />
                  <ProviderHint provider={privacyReviewProviders.find((item) => item.value === form.privacyReviewProviderType)} />
                  {form.privacyReviewProviderType && !["local_heuristic", "ollama", "openai_compatible"].includes(form.privacyReviewProviderType) && <Alert tone="danger">This provider is decoded by the app, but is not a good v1 privacy-review choice. Prefer local_heuristic, ollama, or openai_compatible.</Alert>}
                  <div className="grid four">
                    <div className="field"><FieldLabel>Selected review provider</FieldLabel><select value={form.privacyReviewProviderType ?? ""} onChange={(e) => applyProviderDefault("review", e.target.value)}>{privacyReviewProviders.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}{provider.ready ? "" : " (not recommended)"}</option>)}</select></div>
                    <div className="field"><FieldLabel>Endpoint URL</FieldLabel><input className="input" value={form.privacyReviewEndpointUrl ?? ""} onChange={(e) => setForm({ ...form, privacyReviewEndpointUrl: e.target.value })} disabled={form.privacyReviewProviderType === "local_heuristic" || !form.privacyReviewProviderType} /></div>
                    <div className="field"><FieldLabel>Model name</FieldLabel><input className="input" value={form.privacyReviewModel ?? ""} onChange={(e) => setForm({ ...form, privacyReviewModel: e.target.value })} disabled={form.privacyReviewProviderType === "local_heuristic" || !form.privacyReviewProviderType} /></div>
                    <div className="field"><FieldLabel>Privacy classification</FieldLabel><select value={form.privacyReviewPrivacyEmphasis} onChange={(e) => setForm({ ...form, privacyReviewPrivacyEmphasis: e.target.value })}><option value="safe">safe</option><option value="managed">managed</option><option value="caution">caution</option><option value="unsafe">unsafe</option></select></div>
                  </div>
                </div>
              </section>

              <section className="config-section">
                <PanelHeader title="Repository, Telemetry & Policy" description="Sparse managed config: leave fields blank when the tenant should keep local settings." />
                <div className="grid three">
                  <div className="field"><FieldLabel>Template repository URL</FieldLabel><input className="input" value={form.templateRepositoryUrl ?? ""} onChange={(e) => setForm({ ...form, templateRepositoryUrl: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Telemetry endpoint URL</FieldLabel><input className="input" value={form.telemetryEndpointUrl ?? ""} onChange={(e) => setForm({ ...form, telemetryEndpointUrl: e.target.value })} /></div>
                  <div className="field"><FieldLabel>Default template ID</FieldLabel><input className="input" value={form.defaultTemplateId ?? ""} onChange={(e) => setForm({ ...form, defaultTemplateId: e.target.value })} /></div>
                </div>
                <div className="row checkbox-group">
                  <label className="checkbox-row"><input type="checkbox" checked={form.developerMode} onChange={(e) => setForm({ ...form, developerMode: e.target.checked })} /> Developer mode</label>
                  <label className="checkbox-row"><input type="checkbox" checked={form.allowExternalProviders} onChange={(e) => setForm({ ...form, allowExternalProviders: e.target.checked })} /> Allow external providers</label>
                  <label className="checkbox-row"><input type="checkbox" checked={form.externalFormattersAllowed} onChange={(e) => setForm({ ...form, externalFormattersAllowed: e.target.checked })} /> External formatters allowed by policy</label>
                </div>
                <div className="row checkbox-group">
                  <label className="checkbox-row"><input type="checkbox" checked={form.userMayChangeSpeechProvider} onChange={(e) => setForm({ ...form, userMayChangeSpeechProvider: e.target.checked })} /> User may change speech</label>
                  <label className="checkbox-row"><input type="checkbox" checked={form.userMayChangeFormatter} onChange={(e) => setForm({ ...form, userMayChangeFormatter: e.target.checked })} /> User may change formatter</label>
                  <label className="checkbox-row"><input type="checkbox" checked={form.userMayChangePrivacyReviewProvider} onChange={(e) => setForm({ ...form, userMayChangePrivacyReviewProvider: e.target.checked })} /> User may change privacy review</label>
                </div>
                <div className="field"><FieldLabel help="Decoded by the app but not fully enforced yet. Keep this as canonical backend provider values.">Allowed provider restrictions JSON</FieldLabel><textarea value={form.allowedProviderRestrictionsText} onChange={(e) => setForm({ ...form, allowedProviderRestrictionsText: e.target.value })} /></div>
              </section>
            </form>
          </SidePanel>
        </>
      )}
    </RequireAuth>
  );
}

function ProviderHint({ provider }: { provider?: { privacy?: string; ready?: boolean } }) {
  if (!provider) return null;
  return <div className="config-hint"><span>{provider.privacy}</span>{provider.ready === false && <strong>Coming soon / not production ready</strong>}</div>;
}

function labelFor(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
