"use client";

import { useEffect, useState } from "react";
import * as yaml from "js-yaml";
import { Archive, CheckCircle, Download, Save } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
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

  async function load() {
    const [t, c] = await Promise.all([api("/admin/templates"), api("/admin/template-categories")]);
    setTemplates(t); setCategories(c); if (!form.categoryId && c[0]) setForm((v) => ({ ...v, categoryId: c[0].id }));
  }
  useEffect(() => { load().catch(console.error); }, []);

  function validate() {
    try { yaml.load(form.yamlContent); setValidation("YAML parses correctly"); }
    catch (e: any) { setValidation(e.message); }
  }

  function edit(t: any) {
    const version = t.versions?.[0];
    setSelected(t);
    setForm({ title: t.title, shortDescription: t.shortDescription, categoryId: t.categoryId ?? "", language: t.language, icon: t.icon, tagsText: (t.tags ?? []).join(","), version: version?.version ?? "1.0.0", yamlContent: version?.yamlContent ?? starterYaml });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    validate();
    const payload = { ...form, tags: form.tagsText.split(",").map((x) => x.trim()).filter(Boolean) };
    const path = selected ? `/admin/templates/${selected.id}` : "/admin/templates";
    await api(path, { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
    setSelected(null); setForm({ title: "", shortDescription: "", categoryId: categories[0]?.id ?? "", language: "nb-NO", icon: "doc.text", tagsText: "dictation", version: "1.0.0", yamlContent: starterYaml }); load();
  }

  return (
    <RequireAuth>
      <div className="topbar"><h1>Templates</h1><span className="muted">{validation}</span></div>
      <div className="page-stack">
        <form className="panel" onSubmit={save}>
          <h2>{selected ? "Edit template" : "Create template"}</h2>
          <div className="grid three">
            <div className="field"><label>Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field"><label>Short description</label><input className="input" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} required /></div>
            <div className="field"><label>Category</label><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
            <div className="field"><label>Language</label><input className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
            <div className="field"><label>Icon</label><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
            <div className="field"><label>Version</label><input className="input" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
          </div>
          <div className="field"><label>Tags</label><input className="input" value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} /></div>
          <div className="field"><label>YAML</label><textarea value={form.yamlContent} onChange={(e) => setForm({ ...form, yamlContent: e.target.value })} /></div>
          <div className="row"><button type="button" className="button secondary" onClick={validate}><CheckCircle size={16} /> Validate</button><button className="button"><Save size={16} /> Save</button></div>
        </form>
        <div className="panel">
          <h2>Library</h2>
          <table className="table"><tbody>{templates.map((t) => <tr key={t.id}><td><b>{t.title}</b><br /><span className="muted">{t.shortDescription}</span><br />{t.versions?.map((v: any) => <span key={v.id} className="badge">{v.version} {v.state}</span>)}</td><td className="row"><button className="button secondary" onClick={() => edit(t)}>Edit</button>{t.versions?.[0] && <button className="button" onClick={() => api(`/admin/templates/${t.id}/publish/${t.versions[0].id}`, { method: "POST" }).then(load)}><CheckCircle size={14} /></button>}<a className="button secondary" href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${appPath(`/api/v1/templates/${t.id}/download`)}`}><Download size={14} /></a><button className="button danger" onClick={() => api(`/admin/templates/${t.id}/archive`, { method: "PATCH" }).then(load)}><Archive size={14} /></button></td></tr>)}</tbody></table>
        </div>
      </div>
    </RequireAuth>
  );
}
