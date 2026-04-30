"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Edit3, KeyRound, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Alert, EmptyState, FieldLabel, FormSection, IconAction, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatCard } from "../../components/AdminUI";
import { RequireAuth } from "../../components/RequireAuth";
import { getErrorMessage, useToast } from "../../components/ToastProvider";
import { api } from "../../lib/api";

type Category = { id: string; slug: string; title: string; description?: string | null };
type SectionPreset = {
  id: string;
  slug: string;
  title: string;
  purpose: string;
  format: string;
  required: boolean;
  extractionHints: string[];
  sortOrder: number;
};
type PreviewProviderSetting = {
  providerType: string;
  endpointUrl?: string | null;
  model?: string | null;
  apiKeyConfigured: boolean;
  apiKeyPreview?: string | null;
};

const blankCategory = { id: "", slug: "", title: "", description: "" };
const blankSection = { id: "", slug: "", title: "", purpose: "", format: "prose", required: false, extractionHintsText: "", sortOrder: 0 };
const blankPreviewProvider = { providerType: "openai-compatible", endpointUrl: "", model: "", apiKey: "" };

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sections, setSections] = useState<SectionPreset[]>([]);
  const [previewProvider, setPreviewProvider] = useState<PreviewProviderSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryPanel, setCategoryPanel] = useState(false);
  const [sectionPanel, setSectionPanel] = useState(false);
  const [categoryForm, setCategoryForm] = useState(blankCategory);
  const [sectionForm, setSectionForm] = useState(blankSection);
  const [previewProviderForm, setPreviewProviderForm] = useState(blankPreviewProvider);
  const { notify } = useToast();

  async function load() {
    setLoading(true);
    try {
      const current = await api("/admin/me");
      const canReadPreviewProvider = isSuperadminRole(current?.role);
      const [categoryRows, sectionRows, previewSetting] = await Promise.all([
        api("/admin/template-categories"),
        api("/admin/template-section-presets"),
        canReadPreviewProvider ? api("/admin/settings/template-preview-provider") : Promise.resolve(null)
      ]);
      setMe(current);
      setCategories(categoryRows);
      setSections(sectionRows);
      setPreviewProvider(previewSetting);
      setPreviewProviderForm(previewSetting ? {
        providerType: previewSetting.providerType ?? "openai-compatible",
        endpointUrl: previewSetting.endpointUrl ?? "",
        model: previewSetting.model ?? "",
        apiKey: ""
      } : blankPreviewProvider);
    } catch (err) {
      notify({ title: "Settings failed to load", message: getErrorMessage(err), tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    categories: categories.length,
    sections: sections.length,
    required: sections.filter((section) => section.required).length
  }), [categories, sections]);
  const canManageSettings = isSuperadminRole(me?.role);

  function openCategory(category?: Category) {
    setCategoryForm(category ? {
      id: category.id,
      slug: category.slug,
      title: category.title,
      description: category.description ?? ""
    } : blankCategory);
    setCategoryPanel(true);
  }

  function openSection(section?: SectionPreset) {
    setSectionForm(section ? {
      id: section.id,
      slug: section.slug,
      title: section.title,
      purpose: section.purpose,
      format: section.format,
      required: section.required,
      extractionHintsText: (section.extractionHints ?? []).join("\n"),
      sortOrder: section.sortOrder ?? 0
    } : blankSection);
    setSectionPanel(true);
  }

  async function saveCategory() {
    setSaving(true);
    try {
      const payload = { slug: categoryForm.slug, title: categoryForm.title, description: categoryForm.description || undefined };
      const path = categoryForm.id ? `/admin/template-categories/${categoryForm.id}` : "/admin/template-categories";
      await api(path, { method: categoryForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      notify({ title: "Category saved", tone: "success" });
      setCategoryPanel(false);
      await load();
    } catch (err) {
      notify({ title: "Category was not saved", message: getErrorMessage(err), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`Delete category "${category.title}"?`)) return;
    try {
      await api(`/admin/template-categories/${category.id}`, { method: "DELETE" });
      notify({ title: "Category deleted", tone: "success" });
      await load();
    } catch (err) {
      notify({ title: "Category was not deleted", message: getErrorMessage(err), tone: "danger" });
    }
  }

  async function saveSection() {
    setSaving(true);
    try {
      const payload = {
        slug: sectionForm.slug,
        title: sectionForm.title,
        purpose: sectionForm.purpose,
        format: sectionForm.format,
        required: sectionForm.required,
        extractionHints: textToList(sectionForm.extractionHintsText),
        sortOrder: Number(sectionForm.sortOrder) || 0
      };
      const path = sectionForm.id ? `/admin/template-section-presets/${sectionForm.id}` : "/admin/template-section-presets";
      await api(path, { method: sectionForm.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      notify({ title: "Section preset saved", tone: "success" });
      setSectionPanel(false);
      await load();
    } catch (err) {
      notify({ title: "Section preset was not saved", message: getErrorMessage(err), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(section: SectionPreset) {
    if (!confirm(`Delete section preset "${section.title}"? Existing templates will not be changed.`)) return;
    try {
      await api(`/admin/template-section-presets/${section.id}`, { method: "DELETE" });
      notify({ title: "Section preset deleted", tone: "success" });
      await load();
    } catch (err) {
      notify({ title: "Section preset was not deleted", message: getErrorMessage(err), tone: "danger" });
    }
  }

  async function savePreviewProvider() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        providerType: previewProviderForm.providerType,
        endpointUrl: previewProviderForm.endpointUrl,
        model: previewProviderForm.model
      };
      if (previewProviderForm.apiKey.trim()) payload.apiKey = previewProviderForm.apiKey.trim();
      const setting = await api("/admin/settings/template-preview-provider", { method: "PATCH", body: JSON.stringify(payload) });
      setPreviewProvider(setting);
      setPreviewProviderForm({
        providerType: setting.providerType ?? "openai-compatible",
        endpointUrl: setting.endpointUrl ?? "",
        model: setting.model ?? "",
        apiKey: ""
      });
      notify({ title: "AI preview provider saved", tone: "success" });
    } catch (err) {
      notify({ title: "AI preview provider was not saved", message: getErrorMessage(err), tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <PageHeader
        title="Settings"
        description="Shared admin portal settings for the template repository. Categories and section presets shape the template builder, without changing already published YAML."
      />
      {loading ? <LoadingPanel label="Loading settings" /> : (
        <div className="page-stack">
          {!canManageSettings && <Alert tone="info">Only superadmins can create, edit or delete shared settings. AI preview provider configuration is hidden from non-superadmins.</Alert>}
          <div className="grid three">
            <StatCard label="Categories" value={stats.categories} icon={<Edit3 size={18} />} sub="template groups" />
            <StatCard label="Sections" value={stats.sections} icon={<Edit3 size={18} />} sub="builder presets" />
            <StatCard label="Required" value={stats.required} icon={<Edit3 size={18} />} sub="default required sections" />
          </div>

          {canManageSettings && (
            <section className="panel">
              <PanelHeader
                title="AI preview provider"
                description="Superadmin-only provider used when admins manually generate template previews from a draft and sample transcript."
                actions={<span className={`badge ${previewProvider?.apiKeyConfigured ? "status-active" : "status-draft"}`}>{previewProvider?.apiKeyConfigured ? "API key saved" : "No API key"}</span>}
              />
              <div className="settings-provider-panel">
                <div className="settings-provider-summary">
                  <div className="settings-provider-icon"><Bot size={20} /></div>
                  <div>
                    <strong>Manual preview generation</strong>
                    <span>The template designer calls this one central provider only when Preview/Refresh is pressed. The raw API key is never shown after saving.</span>
                  </div>
                </div>
                <div className="grid three">
                  <div className="field">
                    <FieldLabel help="Metadata label for the provider. The current preview runner expects an OpenAI-compatible chat-completions endpoint.">Provider type</FieldLabel>
                    <select value={previewProviderForm.providerType} onChange={(event) => setPreviewProviderForm({ ...previewProviderForm, providerType: event.target.value })}>
                      <option value="openai-compatible">OpenAI-compatible</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                  <div className="field">
                    <FieldLabel help="Full chat-completions URL used by the backend preview runner. For OpenAI this is normally https://api.openai.com/v1/chat/completions.">Endpoint URL</FieldLabel>
                    <input className="input" value={previewProviderForm.endpointUrl} onChange={(event) => setPreviewProviderForm({ ...previewProviderForm, endpointUrl: event.target.value })} placeholder="https://api.openai.com/v1/chat/completions" />
                  </div>
                  <div className="field">
                    <FieldLabel help="Model used for preview generation only. This does not affect tenant runtime policies.">Model</FieldLabel>
                    <input className="input" value={previewProviderForm.model} onChange={(event) => setPreviewProviderForm({ ...previewProviderForm, model: event.target.value })} placeholder="gpt-5-mini" />
                  </div>
                </div>
                <div className="grid two">
                  <div className="field">
                    <FieldLabel help="Write-only secret for the preview provider. Leave blank to keep the saved key; enter a new value to replace it.">API key</FieldLabel>
                    <input className="input" type="password" value={previewProviderForm.apiKey} onChange={(event) => setPreviewProviderForm({ ...previewProviderForm, apiKey: event.target.value })} placeholder={previewProvider?.apiKeyPreview ? `Saved: ${previewProvider.apiKeyPreview}` : "Paste preview provider API key"} />
                  </div>
                  <div className="settings-provider-safe">
                    <ShieldCheck size={16} />
                    <span>Visible and editable by superadmins only.</span>
                    {previewProvider?.apiKeyConfigured && <span><KeyRound size={14} /> Saved key is masked.</span>}
                  </div>
                </div>
                <div className="form-actions">
                  <button className="button" type="button" onClick={savePreviewProvider} disabled={saving}><Save size={15} /> Save preview provider</button>
                </div>
              </div>
            </section>
          )}

          <div className="settings-grid">
            <section className="panel">
              <PanelHeader
                title="Template categories"
                description="Used by template families and the designer category dropdown."
                actions={<IconAction label="New category" tone="primary" onClick={() => openCategory()} disabled={!canManageSettings}><Plus size={15} /></IconAction>}
              />
              {!categories.length ? <EmptyState title="No categories" message="Create categories for template families." /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Category</th><th>Slug</th><th className="actions">Actions</th></tr></thead>
                    <tbody>{categories.map((category) => (
                      <tr key={category.id}>
                        <td><b>{category.title}</b><br /><span className="muted">{category.description || "No description"}</span></td>
                        <td><span className="code">{category.slug}</span></td>
                        <td className="actions">
                          <IconAction label="Edit category" onClick={() => openCategory(category)} disabled={!canManageSettings}><Edit3 size={14} /></IconAction>
                          <IconAction label="Delete category" tone="danger" onClick={() => deleteCategory(category)} disabled={!canManageSettings}><Trash2 size={14} /></IconAction>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <PanelHeader
                title="Template sections"
                description="Reusable blocks admins drag or add into templates."
                actions={<IconAction label="New section preset" tone="primary" onClick={() => openSection()} disabled={!canManageSettings}><Plus size={15} /></IconAction>}
              />
              {!sections.length ? <EmptyState title="No section presets" message="Create reusable sections for the designer." /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Section</th><th>Format</th><th>Order</th><th className="actions">Actions</th></tr></thead>
                    <tbody>{sections.map((section) => (
                      <tr key={section.id}>
                        <td><b>{section.title}</b><br /><span className="muted">{section.purpose}</span></td>
                        <td><span className="badge">{section.format}</span> {section.required && <span className="badge status-active">Required</span>}</td>
                        <td>{section.sortOrder}</td>
                        <td className="actions">
                          <IconAction label="Edit section preset" onClick={() => openSection(section)} disabled={!canManageSettings}><Edit3 size={14} /></IconAction>
                          <IconAction label="Delete section preset" tone="danger" onClick={() => deleteSection(section)} disabled={!canManageSettings}><Trash2 size={14} /></IconAction>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <SidePanel
        open={categoryPanel}
        title={categoryForm.id ? "Edit Category" : "New Category"}
        description="Categories become dropdown choices in template family and designer metadata."
        onClose={() => setCategoryPanel(false)}
        footer={<><button className="button secondary" onClick={() => setCategoryPanel(false)}>Cancel</button><button className="button" onClick={saveCategory} disabled={saving}><Save size={15} /> Save</button></>}
      >
        <FormSection title="Category details">
          <div className="grid two">
            <div className="field"><FieldLabel>Title</FieldLabel><input className="input" value={categoryForm.title} onChange={(event) => setCategoryForm({ ...categoryForm, title: event.target.value })} /></div>
            <div className="field"><FieldLabel>Slug</FieldLabel><input className="input" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} placeholder="oppfolgingssamtale" /></div>
          </div>
          <div className="field"><FieldLabel>Description</FieldLabel><textarea value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></div>
        </FormSection>
      </SidePanel>

      <SidePanel
        open={sectionPanel}
        title={sectionForm.id ? "Edit Section Preset" : "New Section Preset"}
        description="Section presets are builder blocks. Existing template YAML is not changed when these are edited."
        onClose={() => setSectionPanel(false)}
        footer={<><button className="button secondary" onClick={() => setSectionPanel(false)}>Cancel</button><button className="button" onClick={saveSection} disabled={saving}><Save size={15} /> Save</button></>}
      >
        <FormSection title="Section details">
          <div className="grid two">
            <div className="field"><FieldLabel>Title</FieldLabel><input className="input" value={sectionForm.title} onChange={(event) => setSectionForm({ ...sectionForm, title: event.target.value })} /></div>
            <div className="field"><FieldLabel>Slug</FieldLabel><input className="input" value={sectionForm.slug} onChange={(event) => setSectionForm({ ...sectionForm, slug: event.target.value })} /></div>
          </div>
          <div className="field"><FieldLabel>Purpose</FieldLabel><textarea value={sectionForm.purpose} onChange={(event) => setSectionForm({ ...sectionForm, purpose: event.target.value })} /></div>
          <div className="grid three">
            <div className="field"><FieldLabel>Format</FieldLabel><select value={sectionForm.format} onChange={(event) => setSectionForm({ ...sectionForm, format: event.target.value })}><option value="prose">Prose</option><option value="bullets">Bullets</option><option value="numbered_list">Numbered list</option><option value="table">Table</option><option value="checklist">Checklist</option><option value="fields">Fields</option></select></div>
            <div className="field"><FieldLabel>Sort order</FieldLabel><input className="input" type="number" value={sectionForm.sortOrder} onChange={(event) => setSectionForm({ ...sectionForm, sortOrder: Number(event.target.value) })} /></div>
            <label className="checkbox-row"><input type="checkbox" checked={sectionForm.required} onChange={(event) => setSectionForm({ ...sectionForm, required: event.target.checked })} /> Required by default</label>
          </div>
          <div className="field"><FieldLabel>Extraction hints</FieldLabel><textarea value={sectionForm.extractionHintsText} onChange={(event) => setSectionForm({ ...sectionForm, extractionHintsText: event.target.value })} placeholder="One hint per line" /></div>
        </FormSection>
      </SidePanel>
    </RequireAuth>
  );
}

function textToList(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function isSuperadminRole(role?: string | null) {
  return String(role ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "") === "superadmin";
}
