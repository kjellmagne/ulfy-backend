"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import * as yaml from "js-yaml";
import { Archive, Bot, CheckCircle, CopyPlus, Download, FileText, Globe2, GripVertical, Pencil, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, FormSection, IconAction, InfoTip, LoadingPanel, PageHeader, PanelHeader, SidePanel, StatCard, StatusBadge } from "../../components/AdminUI";
import { IconPicker, LanguageCombobox, TagChipList, TagEditor, TemplateIcon, localizeTemplateSectionPresets, presetToTemplateSection } from "../../components/TemplateControls";
import type { TemplateSectionPresetOption, TemplateTagOption } from "../../components/TemplateControls";
import { useToast } from "../../components/ToastProvider";
import { api } from "../../lib/api";
import { appPath } from "../../lib/base-path";

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
type TemplateSection = {
  title?: string;
  purpose?: string;
  format?: string;
  required?: boolean;
  extraction_hints?: string[];
};
type TemplateYamlDoc = {
  identity?: {
    id?: string;
    title?: string;
    icon?: string;
    short_description?: string;
    category?: string;
    tags?: string[];
    language?: string;
    version?: string;
  };
  context?: Record<string, unknown>;
  perspective?: Record<string, unknown>;
  structure?: { sections?: TemplateSection[] };
  content_rules?: Record<string, unknown>;
  llm_prompting?: Record<string, unknown>;
  [key: string]: unknown;
};
type SectionPreset = {
  title: string;
  purpose: string;
  format: string;
  required: boolean;
  extraction_hints: string[];
};
type DragItem = { kind: "preset"; preset: SectionPreset } | { kind: "section"; index: number };

const blankFamily = { id: "", title: "", shortDescription: "", categoryId: "", icon: "doc.text", tags: [] as string[], isGlobal: false };

function IconLink({ label, href, children, tone = "secondary" }: { label: string; href: string; children: ReactNode; tone?: "primary" | "secondary" | "danger" }) {
  return (
    <a className={`icon-action tone-${tone}`} href={href} aria-label={label} title={label}>
      <span className="sr-only">{label}</span>
      {children}
    </a>
  );
}

const fallbackSectionPresets: SectionPreset[] = [
  {
    title: "Summary",
    purpose: "Summarize the transcript into a short, useful overview.",
    format: "prose",
    required: true,
    extraction_hints: ["main topic", "important context", "outcome"]
  },
  {
    title: "Decisions",
    purpose: "List clear decisions that were made during the conversation.",
    format: "bullets",
    required: false,
    extraction_hints: ["decision", "owner", "reason"]
  },
  {
    title: "Action items",
    purpose: "Extract follow-up tasks with owner and due date when available.",
    format: "table",
    required: false,
    extraction_hints: ["owner", "action", "due date"]
  },
  {
    title: "Open questions",
    purpose: "Capture unresolved questions or topics that need clarification.",
    format: "bullets",
    required: false,
    extraction_hints: ["question", "missing information", "next step"]
  },
  {
    title: "Risks and concerns",
    purpose: "Highlight risks, concerns or blockers mentioned in the transcript.",
    format: "bullets",
    required: false,
    extraction_hints: ["risk", "impact", "mitigation"]
  },
  {
    title: "Follow-up plan",
    purpose: "Describe recommended next steps based only on the transcript.",
    format: "numbered_list",
    required: false,
    extraction_hints: ["next step", "priority", "responsible party"]
  }
];

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000999";
}

function starterYaml(family?: Partial<Family>, language = "nb-NO") {
  const title = family?.title || "New Ulfy template";
  const category = family?.category?.slug || "annet";
  const firstSection = localizeTemplateSectionPresets([fallbackSectionPresets[0]], language)[0];
  return `identity:
  id: ${uuid()}
  title: ${title}
  icon: ${family?.icon || "doc.text"}
  short_description: ${family?.shortDescription || "Short description for the template."}
  category: ${category}
  tags:
    - draft
  language: ${language}
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
    - title: ${firstSection.title}
      purpose: ${firstSection.purpose}
      format: ${firstSection.format}
      required: ${firstSection.required}
      extraction_hints:
${firstSection.extraction_hints.map((hint) => `        - ${hint}`).join("\n")}
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

function parseTemplateYaml(content: string): TemplateYamlDoc | null {
  const parsed = yaml.load(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as TemplateYamlDoc;
}

function ensureTemplateDoc(content: string, family?: Partial<Family> | null, language = "nb-NO") {
  const fallback = parseTemplateYaml(starterYaml(family ?? undefined, language)) ?? {};
  const parsed = parseTemplateYaml(content) ?? fallback;
  parsed.identity = { ...(parsed.identity ?? {}) };
  parsed.identity.id = parsed.identity.id || uuid();
  parsed.identity.title = parsed.identity.title || family?.title || "New Ulfy template";
  parsed.identity.short_description = parsed.identity.short_description || family?.shortDescription || "";
  parsed.identity.icon = parsed.identity.icon || family?.icon || "doc.text";
  parsed.identity.category = parsed.identity.category || family?.category?.slug || "annet";
  parsed.identity.tags = Array.isArray(parsed.identity.tags) ? parsed.identity.tags : [];
  parsed.identity.language = parsed.identity.language || language;
  parsed.identity.version = parsed.identity.version || "1.0.0";
  parsed.structure = { ...(parsed.structure ?? {}) };
  parsed.structure.sections = Array.isArray(parsed.structure.sections) ? parsed.structure.sections : [];
  return parsed;
}

function dumpTemplateYaml(doc: TemplateYamlDoc) {
  return yaml.dump(doc, { noRefs: true, lineWidth: 100, sortKeys: false });
}

function textToList(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function listToText(value?: string[]) {
  return (value ?? []).join("\n");
}

export default function TemplatesPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sectionPresetRows, setSectionPresetRows] = useState<TemplateSectionPresetOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TemplateTagOption[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const { notify } = useToast();
  const templateDoc = useMemo(() => {
    try {
      return parseTemplateYaml(variantForm.yamlContent);
    } catch {
      return null;
    }
  }, [variantForm.yamlContent]);
  const templateIdentity = templateDoc?.identity ?? {};
  const templateSections = templateDoc?.structure?.sections ?? [];
  const baseSectionPresets = sectionPresetRows.length ? sectionPresetRows.map(presetToTemplateSection) : fallbackSectionPresets;
  const sectionPresets = localizeTemplateSectionPresets(baseSectionPresets, variantForm.language);
  const requiredSectionCount = templateSections.filter((section) => section.required !== false).length;
  const optionalSectionCount = Math.max(templateSections.length - requiredSectionCount, 0);
  const latestSelectedVersion = selectedFamily?.variants.find((variant) => variant.id === variantForm.variantId)?.publishedVersions?.[0]?.version ?? "Draft only";

  function setNotice(message: string) {
    if (message) notify({ tone: "success", title: message });
  }

  function setError(message: string) {
    if (message) notify({ tone: "danger", title: "Action failed", message });
  }

  function updateTemplate(mutator: (doc: TemplateYamlDoc) => void) {
    try {
      setVariantForm((current) => {
        const doc = ensureTemplateDoc(current.yamlContent, selectedFamily, current.language);
        mutator(doc);
        return { ...current, yamlContent: dumpTemplateYaml(doc) };
      });
    } catch (err: any) {
      setError(err.message ?? "Template YAML could not be updated.");
    }
  }

  function updateIdentity(field: keyof NonNullable<TemplateYamlDoc["identity"]>, value: string | string[]) {
    updateTemplate((doc) => {
      doc.identity = { ...(doc.identity ?? {}), [field]: value };
    });
  }

  function updateLanguage(language: string) {
    try {
      setVariantForm((current) => {
        const doc = ensureTemplateDoc(current.yamlContent, selectedFamily, language);
        doc.identity = { ...(doc.identity ?? {}), language };
        return { ...current, language, yamlContent: dumpTemplateYaml(doc) };
      });
    } catch (err: any) {
      setError(err.message ?? "Template YAML could not be updated.");
    }
  }

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    updateTemplate((doc) => {
      const sections = doc.structure?.sections ?? [];
      sections[index] = { ...(sections[index] ?? {}), ...patch };
      doc.structure = { ...(doc.structure ?? {}), sections };
    });
  }

  function addSection(preset: SectionPreset, index = templateSections.length) {
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      sections.splice(index, 0, {
        title: preset.title,
        purpose: preset.purpose,
        format: preset.format,
        required: preset.required,
        extraction_hints: preset.extraction_hints
      });
      doc.structure = { ...(doc.structure ?? {}), sections };
    });
    notify({ tone: "success", title: `${preset.title} section added` });
  }

  function duplicateSection(index: number) {
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      const source = sections[index];
      if (!source) return;
      sections.splice(index + 1, 0, { ...source, title: `${source.title ?? "Section"} copy` });
      doc.structure = { ...(doc.structure ?? {}), sections };
    });
  }

  function removeSection(index: number) {
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      sections.splice(index, 1);
      doc.structure = { ...(doc.structure ?? {}), sections };
    });
  }

  function moveSection(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      const [item] = sections.splice(fromIndex, 1);
      if (!item) return;
      const nextIndex = Math.max(0, Math.min(toIndex, sections.length));
      sections.splice(nextIndex, 0, item);
      doc.structure = { ...(doc.structure ?? {}), sections };
    });
  }

  function dropOnSection(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    if (!dragItem) return;
    if (dragItem.kind === "preset") addSection(dragItem.preset, index);
    else moveSection(dragItem.index, index);
    setDragItem(null);
  }

  function dropOnCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!dragItem) return;
    if (dragItem.kind === "preset") addSection(dragItem.preset, templateSections.length);
    else moveSection(dragItem.index, templateSections.length);
    setDragItem(null);
  }

  async function load() {
    setLoading(true);
    try {
      const [familyRows, categoryRows, tenantRows, sectionRows, tagRows] = await Promise.all([
        api("/admin/template-families"),
        api("/admin/template-categories"),
        api("/admin/tenants"),
        api("/admin/template-section-presets"),
        api("/admin/template-tags")
      ]);
      setFamilies(familyRows);
      setCategories(categoryRows);
      setTenants(tenantRows);
      setSectionPresetRows(sectionRows);
      setTagOptions(tagRows);
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

  function designerPath(family: Family, variant?: Variant) {
    return appPath(`/templates/designer?familyId=${encodeURIComponent(family.id)}&variantId=${encodeURIComponent(variant?.id ?? "new")}`);
  }

  function openDesignerRoute(family: Family, variant?: Variant) {
    window.location.href = designerPath(family, variant);
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
      tags: family.tags ?? [],
      isGlobal: family.isGlobal
    } : { ...blankFamily, categoryId: categories[0]?.id ?? "" });
    setFamilyPanel(true);
  }

  function openDesigner(family: Family, variant?: Variant) {
    const draft = variant?.draft;
    const language = variant?.language ?? "nb-NO";
    setError(""); setNotice("");
    setSelectedFamily(family);
    setVariantForm({
      familyId: family.id,
      variantId: variant?.id ?? "",
      draftId: draft?.id ?? "",
      language,
      yamlContent: draft?.yamlContent ?? starterYaml(family, language),
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
        tags: familyForm.tags,
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

  async function createTemplateTag(name: string) {
    try {
      const tag = await api("/admin/template-tags", { method: "POST", body: JSON.stringify({ name }) });
      setTagOptions((current) => [...current.filter((item) => item.slug !== tag.slug), tag].sort((a, b) => a.name.localeCompare(b.name)));
      notify({ tone: "success", title: "Tag created", message: `${tag.name} was added to the shared catalog.` });
      return tag;
    } catch (err: any) {
      setError(err.message);
      return null;
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
        meta={<IconAction label="New template family" tone="primary" onClick={() => openFamilyEditor()}><Plus size={16} /></IconAction>}
      />
      {loading ? <LoadingPanel label="Loading templates" /> : (
        <div className="page-stack">
          <div className="grid four">
            <StatCard label="Families" value={stats.families} icon={<FileText size={18} />} sub="logical use cases" />
            <StatCard label="Variants" value={stats.variants} icon={<Globe2 size={18} />} sub="language YAML tracks" />
            <StatCard label="Published" value={stats.published} icon={<CheckCircle size={18} />} sub="visible to mobile" />
            <StatCard label="Assigned" value={stats.entitled} icon={<FileText size={18} />} sub="global or tenant-entitled" />
          </div>

          <div className="panel">
            <PanelHeader title="Template repository" description="Families are the shared template concepts. Language variants under each family are the actual YAML files opened in the designer." />
            {!families.length ? <EmptyState title="No template families" message="Create a family, add a language variant, then publish it." /> : (
              <div className="template-family-list">
                {families.map((family) => (
                  <section key={family.id} className="template-family-card">
                    <div className="template-family-header">
                      <div className="template-family-title">
                        <span className="sf-symbol-tile" title={`Web preview for ${family.icon}`}><TemplateIcon symbol={family.icon} /></span>
                        <div>
                          <h3>{family.title}</h3>
                          <p>{family.shortDescription || "No description yet."}</p>
                          <div className="template-family-meta">
                            {family.isGlobal ? (
                              <span className="badge status-active">Global</span>
                            ) : family.entitlements.length ? (
                              family.entitlements.map((entitlement) => (
                                <span key={entitlement.id} className="badge">{entitlement.tenant.name}</span>
                              ))
                            ) : (
                              <span className="badge status-draft">No assigned tenants</span>
                            )}
                          </div>
                          <TagChipList tags={family.tags} options={tagOptions} />
                        </div>
                      </div>
                      <div className="template-family-actions">
                        <IconAction label="Edit family metadata" onClick={() => openFamilyEditor(family)}><Pencil size={14} /></IconAction>
                        <IconLink label="Add language variant" href={designerPath(family)}><Globe2 size={14} /></IconLink>
                        <IconAction label="Archive family" tone="danger" onClick={() => archiveFamily(family)}><Archive size={14} /></IconAction>
                      </div>
                    </div>

                    <div className="template-variant-section">
                      <div className="template-variant-heading">
                        <span className="template-variant-title">
                          Language variants
                          <InfoTip text="Each row is one YAML draft or published language track. Open a row in the designer to edit its YAML, preview, and publish a new version." />
                        </span>
                      </div>
                      {family.variants.length ? (
                        <div className="template-variant-list">
                          {family.variants.map((variant) => {
                            const published = latest(variant);
                            return (
                              <div key={variant.id} className="template-variant-row">
                                <div className="variant-language">
                                  <strong>{variant.language}</strong>
                                </div>
                                <div className="variant-status">
                                  {published ? <span className="badge status-published">Published v{published.version}</span> : <span className="badge status-draft">Draft only</span>}
                                  <span className="badge">{variant.publishedVersions.length} version{variant.publishedVersions.length === 1 ? "" : "s"}</span>
                                </div>
                                <div className="variant-date">
                                  <span>Latest</span>
                                  <strong>{published ? new Date(published.publishedAt).toLocaleDateString() : "Not published"}</strong>
                                </div>
                                <div className="row actions">
                                  <IconLink label="Open designer" href={designerPath(family, variant)}><FileText size={14} /></IconLink>
                                  {published && <IconAction label="Download YAML" onClick={() => downloadYaml(variant)}><Download size={14} /></IconAction>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="template-variant-empty">
                          <span>No language variants yet.</span>
                          <IconLink label="Add first language variant" href={designerPath(family)} tone="primary"><Globe2 size={14} /></IconLink>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
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
        <div className="form-stack">
          <FormSection title="Family metadata" description="Repository-level information shared by all language variants.">
            <div className="grid two">
              <div className="field"><FieldLabel>Title</FieldLabel><input className="input" value={familyForm.title} onChange={(e) => setFamilyForm({ ...familyForm, title: e.target.value })} /></div>
              <div className="field"><FieldLabel>Category</FieldLabel><select value={familyForm.categoryId} onChange={(e) => setFamilyForm({ ...familyForm, categoryId: e.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></div>
            </div>
            <div className="field"><FieldLabel>Short Description</FieldLabel><input className="input" value={familyForm.shortDescription} onChange={(e) => setFamilyForm({ ...familyForm, shortDescription: e.target.value })} /></div>
          </FormSection>
          <FormSection title="Catalog presentation" description="How this family appears in admin lists and tenant catalogs.">
            <div className="field">
              <FieldLabel help="These are SF Symbol names used by the iOS app. The admin stores the symbol name, for example waveform.and.mic.">Icon</FieldLabel>
              <IconPicker value={familyForm.icon} onChange={(icon) => setFamilyForm({ ...familyForm, icon })} />
            </div>
            <div className="field">
              <FieldLabel>Tags</FieldLabel>
              <TagEditor value={familyForm.tags} options={tagOptions} onChange={(tags) => setFamilyForm({ ...familyForm, tags })} onCreateTag={createTemplateTag} />
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={familyForm.isGlobal} onChange={(e) => setFamilyForm({ ...familyForm, isGlobal: e.target.checked })} /> Global template family for all enterprise tenants</label>
          </FormSection>

          {selectedFamily && (
            <FormSection title="Tenant entitlements" description="Assign this family directly to tenants. Global families do not need assignments.">
              <div className="row">
                <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                  <option value="">Select tenant</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </select>
                <IconAction label="Assign tenant" onClick={addEntitlement} disabled={!selectedTenantId || saving}><Plus size={15} /></IconAction>
              </div>
              <div className="tag-cloud">
                {selectedFamily.entitlements.map((entitlement) => (
                  <button key={entitlement.id} className="badge" onClick={() => removeEntitlement(entitlement.tenantId)}>{entitlement.tenant.name} x</button>
                ))}
                {!selectedFamily.entitlements.length && <span className="muted">No tenant-specific assignments.</span>}
              </div>
            </FormSection>
          )}
        </div>
      </SidePanel>

      <SidePanel
        open={variantPanel}
        wide
        title={variantForm.variantId ? "Template Designer" : "New Language Variant"}
        description="Edit the current draft, sample transcript and preview. Publish writes an immutable version for the mobile manifest."
        onClose={() => setVariantPanel(false)}
        footer={<><button className="button secondary" onClick={() => setVariantPanel(false)}>Close</button><button className="button secondary" onClick={validateYaml}>Validate YAML</button><button className="button" disabled={saving} onClick={saveDraft}><Save size={16} /> Save draft</button><button className="button" disabled={saving || !variantForm.variantId} onClick={publishDraft}><CheckCircle size={16} /> Publish</button></>}
      >
        <div className="template-designer-shell">
          <section className="designer-summary">
            <div>
              <span className="eyebrow">Current draft</span>
              <h3>{templateIdentity.title || selectedFamily?.title || "Untitled template"}</h3>
              <p>{templateIdentity.short_description || "No short description yet."}</p>
            </div>
            <div className="designer-summary-metrics">
              <span><strong>{variantForm.language || templateIdentity.language || "-"}</strong>Language</span>
              <span><strong>{templateSections.length}</strong>Sections</span>
              <span><strong>{requiredSectionCount}</strong>Required</span>
              <span><strong>{latestSelectedVersion}</strong>Published</span>
            </div>
          </section>

          <div className="template-designer">
            <section className="designer-editor">
              <section className="designer-card">
                <div className="designer-card-header">
                  <div>
                    <span className="eyebrow">1. Identity</span>
                    <h3>Template basics</h3>
                  </div>
                  <span className="badge">{variantForm.bump} bump</span>
                </div>
                <div className="designer-card-body">
                  <div className="grid three">
                    <div className="field"><FieldLabel>Family</FieldLabel><input className="input" value={selectedFamily?.title ?? ""} disabled /></div>
                    <div className="field"><FieldLabel>Template title</FieldLabel><input className="input" value={templateIdentity.title ?? ""} onChange={(e) => updateIdentity("title", e.target.value)} /></div>
                    <div className="field"><FieldLabel>Language</FieldLabel><LanguageCombobox value={variantForm.language} onChange={updateLanguage} /></div>
                    <div className="field"><FieldLabel>Short description</FieldLabel><input className="input" value={templateIdentity.short_description ?? ""} onChange={(e) => updateIdentity("short_description", e.target.value)} /></div>
                    <div className="field"><FieldLabel>Category</FieldLabel><select value={templateIdentity.category ?? ""} onChange={(e) => updateIdentity("category", e.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.slug}>{category.title}</option>)}</select></div>
                    <div className="field wide"><FieldLabel>Icon</FieldLabel><IconPicker value={templateIdentity.icon ?? "doc.text"} onChange={(icon) => updateIdentity("icon", icon)} /></div>
                    <div className="field wide"><FieldLabel>Tags</FieldLabel><TagEditor value={templateIdentity.tags ?? []} options={tagOptions} onChange={(tags) => updateIdentity("tags", tags)} onCreateTag={createTemplateTag} /></div>
                    <div className="field"><FieldLabel>Publish bump</FieldLabel><select value={variantForm.bump} onChange={(e) => setVariantForm({ ...variantForm, bump: e.target.value as any })}><option value="patch">Patch</option><option value="minor">Minor</option><option value="major">Major</option></select></div>
                  </div>
                </div>
              </section>

              <section className="designer-card builder-card">
                <div className="designer-card-header builder-main-header">
                  <div>
                    <span className="eyebrow">2. Builder</span>
                    <h3>Output structure</h3>
                    <p>Arrange the document sections in the order the app should generate them.</p>
                  </div>
                  <div className="builder-status-strip">
                    <span><strong>{templateSections.length}</strong>Total</span>
                    <span><strong>{requiredSectionCount}</strong>Required</span>
                    <span><strong>{optionalSectionCount}</strong>Optional</span>
                  </div>
                </div>
                <div className="designer-card-body">
                  {!templateDoc && <Alert tone="danger">The YAML source cannot be parsed. Fix it in YAML source before using the builder.</Alert>}
                  <div className="builder-workspace">
                    <aside className="section-palette" aria-label="Section palette">
                      <div className="builder-subhead">
                        <h4>Add sections</h4>
                        <p>Drag a block into the canvas or use the plus button.</p>
                      </div>
                      <div className="section-preset-list">
                        {sectionPresets.map((preset) => (
                          <div
                            key={preset.title}
                            className="section-preset"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              setDragItem({ kind: "preset", preset });
                            }}
                            onDragEnd={() => setDragItem(null)}
                          >
                            <div>
                              <strong>{preset.title}</strong>
                              <span>{preset.format.replace("_", " ")} · {preset.required ? "required" : "optional"}</span>
                            </div>
                            <IconAction label={`Add ${preset.title}`} onClick={() => addSection(preset)}><Plus size={14} /></IconAction>
                          </div>
                        ))}
                      </div>
                    </aside>

                    <div className="section-canvas" onDragOver={(event) => event.preventDefault()} onDrop={dropOnCanvas}>
                      <div className="canvas-header">
                        <div>
                          <h4>Document canvas</h4>
                          <p>{templateSections.length ? `${templateSections.length} sections in output order` : "No sections yet"}</p>
                        </div>
                        <span className="badge status-draft">Draft</span>
                      </div>
                      {!templateSections.length ? (
                        <div className="builder-empty">Drop sections here to build the output structure.</div>
                      ) : (
                        <div className="section-card-list">
                          {templateSections.map((section, index) => (
                            <div
                              key={`${section.title ?? "section"}-${index}`}
                              className="section-card"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => dropOnSection(event, index)}
                            >
                              <div className="section-card-header">
                                <div
                                  className="section-drag-handle"
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    setDragItem({ kind: "section", index });
                                  }}
                                  onDragEnd={() => setDragItem(null)}
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={16} />
                                </div>
                                <div className="section-number">{index + 1}</div>
                                <div className="section-heading-fields">
                                  <input className="input section-title-input" value={section.title ?? ""} onChange={(e) => updateSection(index, { title: e.target.value })} placeholder="Section title" />
                                  <div className="section-meta-row">
                                    <span className={`badge ${section.required !== false ? "status-active" : "status-draft"}`}>{section.required !== false ? "Required" : "Optional"}</span>
                                    <span>{section.format ?? "prose"}</span>
                                  </div>
                                </div>
                                <div className="section-card-actions">
                                  <IconAction label="Duplicate section" onClick={() => duplicateSection(index)}><CopyPlus size={14} /></IconAction>
                                  <IconAction label="Remove section" tone="danger" onClick={() => removeSection(index)}><Trash2 size={14} /></IconAction>
                                </div>
                              </div>
                              <div className="section-card-body">
                                <div className="field section-purpose-field"><FieldLabel>Purpose</FieldLabel><textarea value={section.purpose ?? ""} onChange={(e) => updateSection(index, { purpose: e.target.value })} placeholder="What this section should capture" /></div>
                                <div className="section-controls-grid">
                                  <div className="field"><FieldLabel>Format</FieldLabel><select value={section.format ?? "prose"} onChange={(e) => updateSection(index, { format: e.target.value })}><option value="prose">Prose</option><option value="bullets">Bullets</option><option value="numbered_list">Numbered list</option><option value="table">Table</option><option value="checklist">Checklist</option></select></div>
                                  <label className="checkbox-row section-required-toggle"><input type="checkbox" checked={section.required !== false} onChange={(e) => updateSection(index, { required: e.target.checked })} /> Required</label>
                                  <div className="field section-hints-field"><FieldLabel>Extraction hints</FieldLabel><textarea value={listToText(section.extraction_hints)} onChange={(e) => updateSection(index, { extraction_hints: textToList(e.target.value) })} placeholder="One hint per line" /></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <details className="designer-disclosure">
                <summary>Advanced YAML source</summary>
                <div className="designer-disclosure-body">
                  <div className="field"><FieldLabel help="Must use the app schema: identity, context, perspective, structure, content_rules, llm_prompting.">YAML Draft</FieldLabel><textarea className="yaml-editor" value={variantForm.yamlContent} onChange={(e) => setVariantForm({ ...variantForm, yamlContent: e.target.value })} /></div>
                </div>
              </details>
            </section>

            <aside className="designer-preview">
              <section className="preview-panel preview-panel-primary">
                <div className="preview-panel-header">
                  <div>
                    <span className="eyebrow">3. Preview</span>
                    <h3>Generated document</h3>
                    <p>Uses the saved draft and sample transcript.</p>
                  </div>
                  <IconAction label="Generate preview" onClick={generatePreview} disabled={saving || !variantForm.draftId}><Bot size={15} /></IconAction>
                </div>
                {variantForm.preview?.error && <Alert tone="danger">{variantForm.preview.error}</Alert>}
                {variantForm.preview?.markdown ? (
                  <>
                    <div className="preview-meta-grid">
                      <div><span>Provider</span><strong>{variantForm.preview.provider?.type ?? "-"}</strong></div>
                      <div><span>Model</span><strong>{variantForm.preview.provider?.model ?? "-"}</strong></div>
                      <div><span>Generated</span><strong>{variantForm.preview.generatedAt ? new Date(variantForm.preview.generatedAt).toLocaleString() : "-"}</strong></div>
                    </div>
                    <pre className="markdown-preview">{variantForm.preview.markdown}</pre>
                  </>
                ) : (
                  <EmptyState title="No preview yet" message="Save the draft, then generate a preview." />
                )}
              </section>

              <section className="preview-panel">
                <div className="preview-panel-header">
                  <div>
                    <span className="eyebrow">AI assist</span>
                    <h3>Draft proposal</h3>
                  </div>
                  <IconAction label="Propose draft with AI" onClick={aiAssist} disabled={saving}><Wand2 size={15} /></IconAction>
                </div>
                <div className="field"><FieldLabel help="The assistant proposes draft YAML only. Review before saving or publishing.">Use case</FieldLabel><textarea value={variantForm.aiUseCase} onChange={(e) => setVariantForm({ ...variantForm, aiUseCase: e.target.value })} placeholder="Describe the template use case." /></div>
              </section>

              <details className="designer-disclosure" open>
                <summary>Sample transcript</summary>
                <div className="designer-disclosure-body">
                  <div className="field"><FieldLabel>Preview fixture</FieldLabel><textarea value={variantForm.sampleTranscript} onChange={(e) => setVariantForm({ ...variantForm, sampleTranscript: e.target.value })} placeholder="Paste a realistic sample transcript for preview generation." /></div>
                </div>
              </details>

              {selectedFamily?.variants?.length ? (
                <section className="preview-panel">
                  <div className="preview-panel-header">
                    <div>
                      <span className="eyebrow">History</span>
                      <h3>Published versions</h3>
                    </div>
                  </div>
                  {selectedFamily.variants.map((variant) => (
                    <div key={variant.id} className="version-row">
                      <strong>{variant.language}</strong>
                      <span>{variant.publishedVersions.length ? `${variant.publishedVersions.length} versions` : "No published versions"}</span>
                      {latest(variant) && <IconAction label="Download YAML" onClick={() => downloadYaml(variant)}><Download size={14} /></IconAction>}
                    </div>
                  ))}
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </SidePanel>
    </RequireAuth>
  );
}
