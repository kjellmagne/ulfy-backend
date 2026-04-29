"use client";

import { useEffect, useState } from "react";
import * as yaml from "js-yaml";
import { Archive, CheckCircle, Download, FileText, Save } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, PageHeader, PanelHeader, StatCard } from "../../components/AdminUI";
import { api } from "../../lib/api";
import { appPath } from "../../lib/base-path";

const starterYaml = `title: New Ulfy template
language: nb-NO
sections:
  - id: summary
    title: Summary
    prompt: Write a concise structured summary.
`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", shortDescription: "", categoryId: "", language: "nb-NO", icon: "doc.text", tagsText: "dictation", version: "1.0.0", yamlContent: starterYaml });
  const [selected, setSelected] = useState<any>(null);
  const [validation, setValidation] = useState("YAML ready");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [t, c] = await Promise.all([api("/admin/templates"), api("/admin/template-categories")]);
      setTemplates(t); setCategories(c); if (!form.categoryId && c[0]) setForm((v) => ({ ...v, categoryId: c[0].id }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load().catch(console.error); }, []);

  function validate() {
    try { yaml.load(form.yamlContent); setValidation("YAML parses correctly"); setError(""); return true; }
    catch (e: any) { setValidation("YAML needs attention"); setError(e.message); return false; }
  }

  function edit(t: any) {
    const version = t.versions?.[0];
    setSelected(t);
    setForm({ title: t.title, shortDescription: t.shortDescription, categoryId: t.categoryId ?? "", language: t.language, icon: t.icon, tagsText: (t.tags ?? []).join(","), version: version?.version ?? "1.0.0", yamlContent: version?.yamlContent ?? starterYaml });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true); setError("");
    const payload = { ...form, tags: form.tagsText.split(",").map((x) => x.trim()).filter(Boolean) };
    const path = selected ? `/admin/templates/${selected.id}` : "/admin/templates";
    try {
      await api(path, { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setSelected(null); setValidation("Template saved"); setForm({ title: "", shortDescription: "", categoryId: categories[0]?.id ?? "", language: "nb-NO", icon: "doc.text", tagsText: "dictation", version: "1.0.0", yamlContent: starterYaml }); await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const published = templates.filter(t => t.versions?.some((v: any) => v.state === 'published')).length;
  const drafts = templates.filter(t => !t.versions?.some((v: any) => v.state === 'published')).length;

  return (
    <RequireAuth>
      <PageHeader title="Templates" description="Create, validate, publish, archive, and download YAML templates for app consumption." meta={<span className="badge">{validation}</span>} />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading ? <LoadingPanel label="Loading templates" /> : (
      <div className="page-stack">
        {/* Stats */}
        <div className="grid three">
          <StatCard label="Total templates" value={templates.length} icon={<FileText size={18} />} sub={`${categories.length} categories`} />
          <StatCard label="Published" value={published} icon={<CheckCircle size={18} />} sub="available in app" />
          <StatCard label="Drafts" value={drafts} icon={<FileText size={18} />} sub="unpublished versions" />
        </div>

        <div className="panel">
          <PanelHeader title="Template library" description="Published versions are available in the mobile manifest and download endpoint." />
          {!templates.length ? <EmptyState title="No templates yet" message="Create a template draft below, then publish a version." /> : (
            <div className="table-wrap"><table className="table"><thead><tr><th>Template</th><th>Category</th><th>Language</th><th>Versions</th><th className="actions">Actions</th></tr></thead><tbody>{templates.map((t) => <tr key={t.id}><td><b>{t.title}</b><br /><span className="muted">{t.shortDescription}</span></td><td>{categories.find(c => c.id === t.categoryId)?.title ?? "-"}</td><td>{t.language}</td><td className="row">{t.versions?.map((v: any) => <span key={v.id} className={`badge status-${v.state}`}>{v.version}</span>)}</td><td className="row actions"><button className="button secondary" onClick={() => edit(t)}>Edit</button>{t.versions?.[0] && <button className="button" title="Publish latest version" onClick={() => api(`/admin/templates/${t.id}/publish/${t.versions[0].id}`, { method: "POST" }).then(load)}><CheckCircle size={14} /></button>}<a className="button secondary" title="Download YAML" href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${appPath(`/api/v1/templates/${t.id}/download`)}`}><Download size={14} /></a><button className="button danger" title="Archive template" onClick={() => api(`/admin/templates/${t.id}/archive`, { method: "PATCH" }).then(load)}><Archive size={14} /></button></td></tr>)}</tbody></table></div>
          )}
        </div>
        <form className="panel" onSubmit={save}>
          <PanelHeader title={selected ? "Edit template" : "Create template"} description="Edit metadata first, then validate YAML before saving or publishing." />
          <div className="grid three">
            <div className="field"><FieldLabel>Title</FieldLabel><input className="input" placeholder="Personlig diktat / logg" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field"><FieldLabel>Short description</FieldLabel><input className="input" placeholder="Kort beskrivelse" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} required /></div>
            <div className="field"><FieldLabel>Category</FieldLabel><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
            <div className="field"><FieldLabel>Language</FieldLabel><input className="input" placeholder="nb-NO" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
            <div className="field"><FieldLabel help="SF Symbol name shown by the iPhone app.">Icon</FieldLabel><input className="input" placeholder="waveform.and.mic" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
            <div className="field"><FieldLabel help="Semantic version saved as immutable history.">Version</FieldLabel><input className="input" placeholder="1.0.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
          </div>
          <div className="field"><FieldLabel>Tags</FieldLabel><input className="input" placeholder="dictation, personal" value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} /></div>
          <div className="field"><FieldLabel help="Must parse as YAML and include title, language, and sections.">YAML</FieldLabel><textarea value={form.yamlContent} onChange={(e) => setForm({ ...form, yamlContent: e.target.value })} style={{ minHeight: '200px' }} /></div>
          <div className="row"><button type="button" className="button secondary" onClick={validate}><CheckCircle size={16} /> Validate</button><button className="button" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save template"}</button></div>
        </form>
      </div>
      )}
    </RequireAuth>
  );
}
