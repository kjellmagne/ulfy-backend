"use client";

import { useEffect, useMemo, useState } from "react";
import * as yaml from "js-yaml";
import { Archive, Bot, CheckCircle, Download, FileText, Globe2, Plus, Save, Wand2 } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatCard, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

type Category = { id: string; slug: string; title: string };
type Tenant = { id: string; name: string; slug: string };
type Draft = {
  id: string;
  yamlContent: string;
  sampleTranscript?: string | null;
  previewMarkdown?: string | null;
  previewStructured?: unknown;
  previewProviderType?: string | null;
  previewProviderModel?: string | null;
  previewGeneratedAt?: string | null;
  previewError?: string | null;
};
type PublishedVersion = { id: string; version: string; yamlContent: string; publishedAt: string };
type Variant = { id: string; language: string; templateIdentityId: string; draft?: Draft | null; publishedVersions: PublishedVersion[] };
type Family = {
  id: string;
  title: string;
  shortDescription: string;
  categoryId?: string | null;
  category?: Category | null;
  icon: string;
  tags: string[];
  isGlobal: boolean;
  state: string;
  variants: Variant[];
  entitlements: Array<{ id: string; tenantId: string; tenant: Tenant }>;
};

const blankFamily = { id: "", title: "", shortDescription: "", categoryId: "", icon: "doc.text", tagsText: "", isGlobal: false };

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000999";
}

function starterYaml(family?: Partial<Family>) {
  const title = family?.title || "New Ulfy template";
  const category = family?.category?.slug || "annet";
  return `identity:
  id: ${uuid()}
  title: ${title}
  icon: ${family?.icon || "doc.text"}
  short_description: ${family?.shortDescription || "Short description for the template."}
  category: ${category}
  tags:
    - draft
  language: nb-NO
  version: 1.0.0
context:
  purpose: Create a clear structured document from the transcript.
  typical_setting: ""
  typical_participants:
    - role: speaker
  goals:
    - Capture useful information without inventing facts.
  related_processes: []
perspective:
  voice: third_person
  audience: self
  tone: semi_formell
  style_rules:
    - Write clearly and concisely.
    - Do not invent facts.
  preserve_original_voice: false
structure:
  sections:
    - title: Summary
      purpose: Summarize the transcript.
      format: prose
      required: true
      extraction_hints: []
content_rules:
  required_elements:
    - Include only information supported by the transcript.
  exclusions:
    - Do not include irrelevant details.
  uncertainty_handling: Mark unclear or missing information instead of guessing.
  action_item_format: Use owner, action, and due date when available.
  decision_marker: Mark clear decisions explicitly.
  speaker_attribution: none
llm_prompting:
  system_prompt_additions: ""
  fallback_behavior: If a required section has no transcript support, write that it was not covered.
  post_processing:
    extract_action_items: true
`;
}

function previewFromDraft(draft?: Draft | null) {
  return draft ? {
    markdown: draft.previewMarkdown ?? null,
    renderedMarkdown: draft.previewMarkdown ?? null,
    extractedFields: draft.previewStructured ?? null,
    provider: draft.previewProviderType ? { type: draft.previewProviderType, model: draft.previewProviderModel } : null,
    generatedAt: draft.previewGeneratedAt ?? null,
    error: draft.previewError ?? null
  } : null;
}

export default function TemplatesPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [familyPanel, setFamilyPanel] = useState(false);
  const [variantPanel, setVariantPanel] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [familyForm, setFamilyForm] = useState(blankFamily);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [variantForm, setVariantForm] = useState({
    familyId: "",
    variantId: "",
    draftId: "",
    language: "nb-NO",
    yamlContent: starterYaml(),
    sampleTranscript: "",
    bump: "patch" as "patch" | "minor" | "major",
    aiUseCase: "",
    preview: null as any
  });

  async function load() {
    setLoading(true);
    try {
      const [familyRows, categoryRows, tenantRows] = await Promise.all([
        api("/admin/template-families"),
        api("/admin/template-categories"),
        api("/admin/tenants")
      ]);
      setFamilies(familyRows);
      setCategories(categoryRows);
      setTenants(tenantRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const stats = useMemo(() => {
    const variants = families.flatMap((family) => family.variants);
    return {
      families: families.length,
      variants: variants.length,
      published: variants.filter((variant) => variant.publishedVersions?.length).length,
      entitled: families.filter((family) => family.isGlobal || family.entitlements.length).length
    };
  }, [families]);

  function latest(variant: Variant) {
    return variant.publishedVersions?.[0];
  }

  function openFamilyEditor(family?: Family) {
    setError(""); setNotice("");
    setSelectedFamily(family ?? null);
    setSelectedTenantId("");
    setFamilyForm(family ? {
      id: family.id,
      title: family.title,
      shortDescription: family.shortDescription,
      categoryId: family.categoryId ?? "",
      icon: family.icon,
      tagsText: (family.tags ?? []).join(", "),
      isGlobal: family.isGlobal
    } : { ...blankFamily, categoryId: categories[0]?.id ?? "" });
    setFamilyPanel(true);
  }

  function openDesigner(family: Family, variant?: Variant) {
    const draft = variant?.draft;
    setError(""); setNotice("");
    setSelectedFamily(family);
    setVariantForm({
      familyId: family.id,
      variantId: variant?.id ?? "",
      draftId: draft?.id ?? "",
      language: variant?.language ?? "nb-NO",
      yamlContent: draft?.yamlContent ?? starterYaml(family),
      sampleTranscript: draft?.sampleTranscript ?? "",
      bump: "patch",
      aiUseCase: family.title,
      preview: previewFromDraft(draft)
    });
    setVariantPanel(true);
  }

  function validateYaml() {
    try {
      yaml.load(variantForm.yamlContent);
      setNotice("YAML parses correctly. Server schema validation runs when you save or publish.");
      setError("");
      return true;
    } catch (err: any) {
      setNotice("");
      setError(err.message);
      return false;
    }
  }

  async function saveFamily() {
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = {
        title: familyForm.title,
        shortDescription: familyForm.shortDescription,
        categoryId: familyForm.categoryId || undefined,
        icon: familyForm.icon || "doc.text",
        tags: familyForm.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        isGlobal: familyForm.isGlobal
      };
      const path = familyForm.id ? `/admin/template-families/${familyForm.id}` : "/admin/template-families";
      const family = await api(path, { method: familyForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setSelectedFamily(family);
      setFamilyForm((current) => ({ ...current, id: family.id }));
      setNotice("Template family saved.");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!validateYaml()) return null;
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { language: variantForm.language, yamlContent: variantForm.yamlContent, sampleTranscript: variantForm.sampleTranscript };
      const result = variantForm.variantId
        ? await api(`/admin/template-variants/${variantForm.variantId}/draft`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api(`/admin/template-families/${variantForm.familyId}/variants`, { method: "POST", body: JSON.stringify(payload) });

      const nextVariantId = variantForm.variantId || result.id;
      const nextDraftId = variantForm.variantId ? result.id : result.draft?.id;
      setVariantForm((current) => ({ ...current, variantId: nextVariantId, draftId: nextDraftId ?? current.draftId }));
      setNotice("Draft saved. Mobile users will not see it until you publish.");
      await load();
      return { variantId: nextVariantId, draftId: nextDraftId };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (!variantForm.variantId) {
      setError("Save the draft before publishing it.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/admin/template-variants/${variantForm.variantId}/publish`, {
        method: "POST",
        body: JSON.stringify({ bump: variantForm.bump })
      });
      setNotice("Published a new immutable version.");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function aiAssist() {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api("/admin/template-drafts/ai-assist", {
        method: "POST",
        body: JSON.stringify({
          useCase: variantForm.aiUseCase || selectedFamily?.title || "Template draft",
          language: variantForm.language,
          category: selectedFamily?.category?.slug,
          title: selectedFamily?.title,
          icon: selectedFamily?.icon
        })
      });
      setVariantForm((current) => ({ ...current, yamlContent: result.yamlContent, sampleTranscript: result.sampleTranscript }));
      setNotice("AI-assisted proposal inserted. Review and save before publishing.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function generatePreview() {
    if (!variantForm.draftId) {
      setError("Save the draft before generating a preview.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const preview = await api(`/admin/template-drafts/${variantForm.draftId}/preview`, { method: "POST" });
      setVariantForm((current) => ({ ...current, preview }));
      if (preview.error) setError(preview.error);
      else setNotice("Preview generated from the current saved draft and sample transcript.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addEntitlement() {
    if (!selectedFamily || !selectedTenantId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const entitlement = await api(`/admin/template-families/${selectedFamily.id}/entitlements`, { method: "POST", body: JSON.stringify({ tenantId: selectedTenantId }) });
      setNotice("Tenant assignment added.");
      setSelectedFamily((current) => current ? { ...current, entitlements: [...current.entitlements.filter((item) => item.tenantId !== entitlement.tenantId), entitlement] } : current);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntitlement(tenantId: string) {
    if (!selectedFamily) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/admin/template-families/${selectedFamily.id}/entitlements/${tenantId}`, { method: "DELETE" });
      setNotice("Tenant assignment removed.");
      setSelectedFamily((current) => current ? { ...current, entitlements: current.entitlements.filter((item) => item.tenantId !== tenantId) } : current);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveFamily(family: Family) {
    if (!confirm(`Archive ${family.title}? It will be hidden from mobile manifests.`)) return;
    await api(`/admin/template-families/${family.id}/archive`, { method: "PATCH" });
    await load();
  }

  function downloadYaml(variant: Variant) {
    const published = latest(variant);
    if (!published) return;
    const blob = new Blob([published.yamlContent], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${variant.templateIdentityId}-${published.version}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequireAuth>
      <PageHeader
        title="Templates"
        description="Authoritative repository for enterprise YAML templates. Drafts are private until published, and mobile access is filtered by tenant entitlement."
        meta={<button className="button" onClick={() => openFamilyEditor()}><Plus size={16} /> New family</button>}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {loading ? <LoadingPanel label="Loading templates" /> : (
        <div className="page-stack">
          <div className="grid four">
            <StatCard label="Families" value={stats.families} icon={<FileText size={18} />} sub="logical use cases" />
            <StatCard label="Variants" value={stats.variants} icon={<Globe2 size={18} />} sub="language YAML tracks" />
            <StatCard label="Published" value={stats.published} icon={<CheckCircle size={18} />} sub="visible to mobile" />
            <StatCard label="Assigned" value={stats.entitled} icon={<FileText size={18} />} sub="global or tenant-entitled" />
          </div>

          <div className="panel">
            <PanelHeader title="Template repository" description="List first, designer in a slide-in panel. Double-click a row to open the first variant." />
            {!families.length ? <EmptyState title="No template families" message="Create a family, add a language variant, then publish it." /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Family</th><th>Availability</th><th>Variants</th><th>Latest</th><th className="actions">Actions</th></tr></thead>
                  <tbody>{families.map((family) => (
                    <tr key={family.id} onDoubleClick={() => openDesigner(family, family.variants[0])}>
                      <td><b>{family.title}</b><br /><span className="muted">{family.shortDescription}</span></td>
                      <td>
                        <div className="row">
                          <StatusBadge status={family.state} />
                          <span className="badge">{family.isGlobal ? "Global" : `${family.entitlements.length} tenants`}</span>
                        </div>
                      </td>
                      <td>{family.variants.length ? family.variants.map((variant) => <span key={variant.id} className="badge">{variant.language}</span>) : <span className="muted">No variants</span>}</td>
                      <td>{family.variants.map((variant) => latest(variant) ? <span key={variant.id} className="badge status-published">{variant.language} {latest(variant)?.version}</span> : <span key={variant.id} className="badge status-draft">{variant.language} draft</span>)}</td>
                      <td className="row actions">
                        <button className="button secondary" onClick={() => openDesigner(family, family.variants[0])}>Designer</button>
                        <button className="button secondary" onClick={() => openDesigner(family)}>New variant</button>
                        <button className="button secondary" onClick={() => openFamilyEditor(family)}>Edit</button>
                        <button className="button danger" onClick={() => archiveFamily(family)}><Archive size={14} /> Archive</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <SidePanel
        open={familyPanel}
        title={familyForm.id ? "Edit Template Family" : "New Template Family"}
        description="Family metadata stays in the repository database; YAML remains one file per language variant."
        onClose={() => setFamilyPanel(false)}
        footer={<><button className="button secondary" onClick={() => setFamilyPanel(false)}>Close</button><button className="button" disabled={saving} onClick={saveFamily}><Save size={16} /> Save</button></>}
      >
        <div className="grid two">
          <div className="field"><FieldLabel>Title</FieldLabel><input className="input" value={familyForm.title} onChange={(e) => setFamilyForm({ ...familyForm, title: e.target.value })} /></div>
          <div className="field"><FieldLabel>Category</FieldLabel><select value={familyForm.categoryId} onChange={(e) => setFamilyForm({ ...familyForm, categoryId: e.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></div>
          <div className="field"><FieldLabel>Icon</FieldLabel><input className="input" value={familyForm.icon} onChange={(e) => setFamilyForm({ ...familyForm, icon: e.target.value })} /></div>
          <div className="field"><FieldLabel>Tags</FieldLabel><input className="input" value={familyForm.tagsText} onChange={(e) => setFamilyForm({ ...familyForm, tagsText: e.target.value })} placeholder="dictation, personal" /></div>
        </div>
        <div className="field"><FieldLabel>Short Description</FieldLabel><input className="input" value={familyForm.shortDescription} onChange={(e) => setFamilyForm({ ...familyForm, shortDescription: e.target.value })} /></div>
        <label className="checkbox-row"><input type="checkbox" checked={familyForm.isGlobal} onChange={(e) => setFamilyForm({ ...familyForm, isGlobal: e.target.checked })} /> Global template family for all enterprise tenants</label>

        {selectedFamily && (
          <div className="panel-subsection">
            <PanelHeader title="Tenant entitlements" description="Assign this family directly to tenants. Global families do not need assignments." />
            <div className="row">
              <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                <option value="">Select tenant</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
              <button className="button secondary" onClick={addEntitlement} disabled={!selectedTenantId || saving}>Assign</button>
            </div>
            <div className="tag-cloud">
              {selectedFamily.entitlements.map((entitlement) => (
                <button key={entitlement.id} className="badge" onClick={() => removeEntitlement(entitlement.tenantId)}>{entitlement.tenant.name} x</button>
              ))}
              {!selectedFamily.entitlements.length && <span className="muted">No tenant-specific assignments.</span>}
            </div>
          </div>
        )}
      </SidePanel>

      <SidePanel
        open={variantPanel}
        wide
        title={variantForm.variantId ? "Template Designer" : "New Language Variant"}
        description="Edit the current draft, sample transcript and preview. Publish writes an immutable version for the mobile manifest."
        onClose={() => setVariantPanel(false)}
        footer={<><button className="button secondary" onClick={() => setVariantPanel(false)}>Close</button><button className="button secondary" onClick={validateYaml}>Validate YAML</button><button className="button" disabled={saving} onClick={saveDraft}><Save size={16} /> Save draft</button><button className="button" disabled={saving || !variantForm.variantId} onClick={publishDraft}><CheckCircle size={16} /> Publish</button></>}
      >
        <div className="template-designer">
          <section className="designer-editor">
            <div className="grid three">
              <div className="field"><FieldLabel>Family</FieldLabel><input className="input" value={selectedFamily?.title ?? ""} disabled /></div>
              <div className="field"><FieldLabel>Language</FieldLabel><input className="input" value={variantForm.language} onChange={(e) => setVariantForm({ ...variantForm, language: e.target.value })} /></div>
              <div className="field"><FieldLabel>Publish bump</FieldLabel><select value={variantForm.bump} onChange={(e) => setVariantForm({ ...variantForm, bump: e.target.value as any })}><option value="patch">Patch</option><option value="minor">Minor</option><option value="major">Major</option></select></div>
            </div>
            <div className="field"><FieldLabel help="The assistant proposes draft YAML only. Review before saving or publishing.">AI assist use case</FieldLabel><div className="row"><input className="input" value={variantForm.aiUseCase} onChange={(e) => setVariantForm({ ...variantForm, aiUseCase: e.target.value })} /><button className="button secondary" onClick={aiAssist} disabled={saving}><Wand2 size={15} /> Propose</button></div></div>
            <div className="field"><FieldLabel help="Must use the app schema: identity, context, perspective, structure, content_rules, llm_prompting.">YAML Draft</FieldLabel><textarea className="yaml-editor" value={variantForm.yamlContent} onChange={(e) => setVariantForm({ ...variantForm, yamlContent: e.target.value })} /></div>
            <div className="field"><FieldLabel>Sample Transcript</FieldLabel><textarea value={variantForm.sampleTranscript} onChange={(e) => setVariantForm({ ...variantForm, sampleTranscript: e.target.value })} placeholder="Paste a realistic sample transcript for preview generation." /></div>
          </section>

          <aside className="designer-preview">
            <div className="panel-header compact">
              <div><h2>AI Preview</h2><p>Generated manually from the saved draft and sample transcript.</p></div>
              <button className="button secondary" onClick={generatePreview} disabled={saving || !variantForm.draftId}><Bot size={15} /> Preview</button>
            </div>
            {variantForm.preview?.error && <Alert tone="danger">{variantForm.preview.error}</Alert>}
            {variantForm.preview?.markdown ? (
              <>
                <div className="detail-grid">
                  <div><span>Provider</span><strong>{variantForm.preview.provider?.type ?? "-"}</strong></div>
                  <div><span>Model</span><strong>{variantForm.preview.provider?.model ?? "-"}</strong></div>
                  <div><span>Generated</span><strong>{variantForm.preview.generatedAt ? new Date(variantForm.preview.generatedAt).toLocaleString() : "-"}</strong></div>
                </div>
                <pre className="markdown-preview">{variantForm.preview.markdown}</pre>
              </>
            ) : (
              <EmptyState title="No preview yet" message="Save the draft, then generate a preview when you want to inspect the output." />
            )}
            {selectedFamily?.variants?.length ? (
              <div className="panel-subsection">
                <PanelHeader title="Version history" description="Published snapshots are immutable." />
                {selectedFamily.variants.map((variant) => (
                  <div key={variant.id} className="version-row">
                    <strong>{variant.language}</strong>
                    <span>{variant.publishedVersions.length ? `${variant.publishedVersions.length} versions` : "No published versions"}</span>
                    {latest(variant) && <button className="button secondary" onClick={() => downloadYaml(variant)}><Download size={14} /> YAML</button>}
                  </div>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </SidePanel>
    </RequireAuth>
  );
}
