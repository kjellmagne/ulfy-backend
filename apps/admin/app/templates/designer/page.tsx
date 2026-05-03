"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import * as yaml from "js-yaml";
import { ArrowLeft, Bot, ChevronDown, CopyPlus, FileCode2, FileText, GripVertical, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Alert, EmptyState, FieldLabel, IconAction, InfoTip, LoadingPanel, Modal } from "../../../components/AdminUI";
import { IconPicker, LanguageCombobox, TagEditor, localizeTemplateSectionPresets, presetToTemplateSection } from "../../../components/TemplateControls";
import type { TemplateCategoryOption, TemplateSectionPresetOption, TemplateTagOption } from "../../../components/TemplateControls";
import { RequireAuth } from "../../../components/RequireAuth";
import { getErrorMessage, useToast } from "../../../components/ToastProvider";
import { api } from "../../../lib/api";
import { appPath } from "../../../lib/base-path";

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
  category?: { id: string; slug: string; title: string } | null;
  icon: string;
  tags: string[];
  isGlobal: boolean;
  state: string;
  variants: Variant[];
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

type DraftPreview = {
  markdown?: string | null;
  structured?: unknown;
  providerType?: string | null;
  providerModel?: string | null;
  generatedAt?: string | null;
  error?: string | null;
};

type PreviewProviderStatus = {
  configured: boolean;
  providerType?: string | null;
  model?: string | null;
  endpointConfigured?: boolean;
  apiKeyConfigured?: boolean;
  missingFields?: string[];
};

type VariantForm = {
  familyId: string;
  variantId: string;
  draftId: string;
  language: string;
  yamlContent: string;
  sampleTranscript: string;
  bump: "patch" | "minor" | "major";
  aiUseCase: string;
  preview: DraftPreview | null;
};

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
    purpose: "Extract follow-up tasks with owner and deadline when present.",
    format: "table",
    required: false,
    extraction_hints: ["task", "owner", "deadline"]
  },
  {
    title: "Risks",
    purpose: "Capture blockers, uncertainty, or sensitive issues mentioned.",
    format: "bullets",
    required: false,
    extraction_hints: ["risk", "blocker", "dependency"]
  }
];

const blankVariantForm: VariantForm = {
  familyId: "",
  variantId: "",
  draftId: "",
  language: "nb-NO",
  yamlContent: "",
  sampleTranscript: "",
  bump: "patch",
  aiUseCase: "",
  preview: null
};

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `template-${Math.random().toString(36).slice(2, 10)}`;
}

function previewFromDraft(draft?: Draft | null): DraftPreview | null {
  if (!draft) return null;
  return {
    markdown: draft.previewMarkdown,
    structured: draft.previewStructured,
    providerType: draft.previewProviderType,
    providerModel: draft.previewProviderModel,
    generatedAt: draft.previewGeneratedAt,
    error: draft.previewError
  };
}

function starterYaml(family: Family, presets: SectionPreset[] = fallbackSectionPresets, language = "nb-NO"): string {
  const doc: TemplateYamlDoc = {
    identity: {
      id: uuid(),
      title: family.title || "New template",
      icon: family.icon || "doc.text",
      short_description: family.shortDescription || "Describe what this template is for.",
      category: family.category?.slug || "general",
      tags: family.tags?.length ? family.tags : ["draft"],
      language,
      version: "0.1.0"
    },
    context: {
      use_case: family.title || "New template",
      output_language: language
    },
    perspective: {
      voice: "professional",
      audience: "internal"
    },
    structure: {
      sections: presets.slice(0, 3)
    },
    content_rules: {
      preserve_facts: true,
      avoid_hallucinations: true,
      flag_uncertainty: true
    },
    llm_prompting: {
      system: "You create a structured note from the transcript using the template sections.",
      user: "Transform the transcript into the requested document."
    }
  };
  return dumpTemplateYaml(doc);
}

function parseTemplateYaml(content: string): TemplateYamlDoc | null {
  try {
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as TemplateYamlDoc;
  } catch {
    return null;
  }
}

function ensureTemplateDoc(content: string): TemplateYamlDoc {
  const parsed = yaml.load(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Template YAML must be an object.");
  const doc = parsed as TemplateYamlDoc;
  doc.identity ??= {};
  doc.identity.id ??= uuid();
  doc.identity.title ??= "New template";
  doc.identity.short_description ??= "";
  doc.identity.icon ??= "doc.text";
  doc.identity.category ??= "general";
  doc.identity.tags ??= [];
  doc.identity.language ??= "nb-NO";
  doc.identity.version ??= "0.1.0";
  doc.structure ??= {};
  doc.structure.sections ??= [];
  return doc;
}

function dumpTemplateYaml(doc: TemplateYamlDoc): string {
  return yaml.dump(doc, { lineWidth: 100, noRefs: true, sortKeys: false });
}

function textToList(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function listToText(value?: string[]) {
  return (value ?? []).join("\n");
}

function publishedVersion(variant?: Variant | null) {
  return variant?.publishedVersions?.[0];
}

function previewBumpedVersion(version: string | undefined, bump: VariantForm["bump"]) {
  if (!version) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function formatTime(value?: string | null) {
  if (!value) return "Not generated";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function TemplateDesignerRoute() {
  const { notify } = useToast();
  const [routeParams, setRouteParams] = useState({ familyId: "", variantId: "new" });
  const { familyId, variantId } = routeParams;

  const [family, setFamily] = useState<Family | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [categories, setCategories] = useState<TemplateCategoryOption[]>([]);
  const [sectionPresetRows, setSectionPresetRows] = useState<TemplateSectionPresetOption[]>([]);
  const [tagOptions, setTagOptions] = useState<TemplateTagOption[]>([]);
  const [variantForm, setVariantForm] = useState<VariantForm>(blankVariantForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [previewTab, setPreviewTab] = useState<"document" | "yaml" | "sample">("document");
  const [previewProviderStatus, setPreviewProviderStatus] = useState<PreviewProviderStatus | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [pendingRestoreVersion, setPendingRestoreVersion] = useState<PublishedVersion | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setRouteParams({
      familyId: searchParams.get("familyId") ?? "",
      variantId: searchParams.get("variantId") ?? "new"
    });
  }, []);

  const load = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    setError("");
    try {
      const [families, categoryRows, sectionRows, tagRows, previewStatus] = await Promise.all([
        api("/admin/template-families"),
        api("/admin/template-categories"),
        api("/admin/template-section-presets"),
        api("/admin/template-tags"),
        api("/admin/settings/template-preview-provider/status")
      ]) as [Family[], TemplateCategoryOption[], TemplateSectionPresetOption[], TemplateTagOption[], PreviewProviderStatus];
      const nextFamily = families.find((item) => item.id === familyId) ?? null;
      if (!nextFamily) {
        setFamily(null);
        setVariant(null);
        setError("Template family was not found.");
        return;
      }

      const nextVariant = variantId === "new"
        ? null
        : nextFamily.variants.find((item) => item.id === variantId) ?? null;
      const draft = nextVariant?.draft;
      const nextLanguage = nextVariant?.language ?? "nb-NO";
      const basePresetSections = sectionRows.length ? sectionRows.map(presetToTemplateSection) : fallbackSectionPresets;
      const presetSections = localizeTemplateSectionPresets(basePresetSections, nextLanguage);

      setCategories(categoryRows);
      setSectionPresetRows(sectionRows);
      setTagOptions(tagRows);
      setPreviewProviderStatus(previewStatus);
      setFamily(nextFamily);
      setVariant(nextVariant);
      setVariantForm({
        familyId: nextFamily.id,
        variantId: nextVariant?.id ?? "",
        draftId: draft?.id ?? "",
        language: nextLanguage,
        yamlContent: draft?.yamlContent ?? starterYaml(nextFamily, presetSections, nextLanguage),
        sampleTranscript: draft?.sampleTranscript ?? "",
        bump: "patch",
        aiUseCase: nextFamily.shortDescription || nextFamily.title,
        preview: previewFromDraft(draft)
      });
      setSelectedSectionIndex(null);
      setDirty(false);
      setSaveState("idle");
      setLastSavedAt(null);

      if (variantId !== "new" && !nextVariant) setError("Template variant was not found.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [familyId, variantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateDoc = useMemo(() => parseTemplateYaml(variantForm.yamlContent), [variantForm.yamlContent]);
  const templateIdentity = templateDoc?.identity;
  const templateSections = templateDoc?.structure?.sections ?? [];
  const baseSectionPresets = sectionPresetRows.length ? sectionPresetRows.map(presetToTemplateSection) : fallbackSectionPresets;
  const sectionPresets = localizeTemplateSectionPresets(baseSectionPresets, variantForm.language);
  const selectedSection = selectedSectionIndex === null ? null : templateSections[selectedSectionIndex] ?? null;
  const publishedVersions = variant?.publishedVersions ?? [];
  const latestVersion = publishedVersion(variant);
  const nextPublishVersion = latestVersion
    ? previewBumpedVersion(latestVersion.version, variantForm.bump)
    : templateIdentity?.version ?? "0.1.0";
  const requiredCount = templateSections.filter((section) => section.required).length;
  const activePreviewProviderType = variantForm.preview?.providerType ?? previewProviderStatus?.providerType ?? null;
  const activePreviewProviderModel = variantForm.preview?.providerModel ?? previewProviderStatus?.model ?? null;
  const previewProviderLabel = previewProviderStatus
    ? (activePreviewProviderType ? `${activePreviewProviderType}${activePreviewProviderModel ? ` · ${activePreviewProviderModel}` : ""}` : "Not configured")
    : "Checking provider";
  const previewProviderDetail = variantForm.preview?.generatedAt
    ? formatTime(variantForm.preview.generatedAt)
    : previewProviderStatus?.configured
      ? "Ready to generate"
      : previewProviderStatus?.missingFields?.length
        ? `Missing ${previewProviderStatus.missingFields.join(", ")}`
        : "Not generated";

  useEffect(() => {
    if (selectedSectionIndex !== null && selectedSectionIndex >= templateSections.length) {
      setSelectedSectionIndex(templateSections.length ? templateSections.length - 1 : null);
    }
  }, [selectedSectionIndex, templateSections.length]);

  useEffect(() => {
    if (!dirty || loading || !family) return;
    const timer = window.setTimeout(() => {
      void saveDraft({ silent: true });
    }, 800);
    return () => window.clearTimeout(timer);
    // The save function intentionally reads the freshest form state at execution time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, variantForm.yamlContent, variantForm.sampleTranscript, variantForm.language, loading, family]);

  function markDirty() {
    setDirty(true);
    setSaveState("dirty");
  }

  function updateVariantForm(updater: (current: VariantForm) => VariantForm) {
    setVariantForm(updater);
    markDirty();
  }

  function updateTemplate(mutator: (doc: TemplateYamlDoc) => void) {
    try {
      const doc = ensureTemplateDoc(variantForm.yamlContent);
      mutator(doc);
      updateVariantForm((current) => ({ ...current, yamlContent: dumpTemplateYaml(doc) }));
      setError("");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      notify({ title: "YAML could not be updated", message, tone: "danger" });
    }
  }

  function updateIdentity(field: keyof NonNullable<TemplateYamlDoc["identity"]>, value: string | string[]) {
    updateTemplate((doc) => {
      doc.identity ??= {};
      (doc.identity as Record<string, unknown>)[field] = value;
      if (field === "language" && typeof value === "string") {
        doc.context ??= {};
        doc.context.output_language = value;
      }
    });
  }

  function updateLanguage(value: string) {
    updateVariantForm((current) => ({ ...current, language: value }));
    updateIdentity("language", value);
  }

  async function createTemplateTag(name: string) {
    try {
      const tag = await api("/admin/template-tags", { method: "POST", body: JSON.stringify({ name }) });
      setTagOptions((current) => [...current.filter((item) => item.slug !== tag.slug), tag].sort((a, b) => a.name.localeCompare(b.name)));
      notify({ title: "Tag created", message: `${tag.name} was added to the shared catalog.`, tone: "success" });
      return tag;
    } catch (err) {
      notify({ title: "Tag was not created", message: getErrorMessage(err), tone: "danger" });
      return null;
    }
  }

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    updateTemplate((doc) => {
      const sections = doc.structure?.sections ?? [];
      sections[index] = { ...sections[index], ...patch };
      doc.structure = { ...doc.structure, sections };
    });
  }

  function addSection(preset: SectionPreset) {
    const nextIndex = templateSections.length;
    updateTemplate((doc) => {
      const sections = doc.structure?.sections ?? [];
      doc.structure = { ...doc.structure, sections: [...sections, { ...preset }] };
    });
    setSelectedSectionIndex(nextIndex);
  }

  function duplicateSection(index: number) {
    const source = templateSections[index];
    if (!source) return;
    updateTemplate((doc) => {
      const sections = doc.structure?.sections ?? [];
      sections.splice(index + 1, 0, { ...source, title: `${source.title ?? "Section"} copy` });
      doc.structure = { ...doc.structure, sections };
    });
    setSelectedSectionIndex(index + 1);
  }

  function removeSection(index: number) {
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      sections.splice(index, 1);
      doc.structure = { ...doc.structure, sections };
    });
    setSelectedSectionIndex(templateSections.length > 1 ? Math.max(0, index - 1) : null);
  }

  function addStarterSkeleton() {
    updateTemplate((doc) => {
      const sections = doc.structure?.sections ?? [];
      doc.structure = { ...doc.structure, sections: [...sections, ...sectionPresets.slice(0, 3).map((preset) => ({ ...preset }))] };
    });
    setSelectedSectionIndex(0);
  }

  function moveSection(from: number, to: number) {
    if (from === to || to < 0 || to >= templateSections.length) return;
    updateTemplate((doc) => {
      const sections = [...(doc.structure?.sections ?? [])];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      doc.structure = { ...doc.structure, sections };
    });
    setSelectedSectionIndex(to);
  }

  function handleOutlineKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSection(index, index - 1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSection(index, index + 1);
    }
  }

  async function saveDraft(options: { silent?: boolean } = {}) {
    const doc = parseTemplateYaml(variantForm.yamlContent);
    if (!doc) {
      setSaveState("error");
      if (!options.silent) notify({ title: "YAML has an error", message: "Fix the YAML before saving changes.", tone: "danger" });
      return null;
    }

    setSaveState("saving");
    try {
      const payload = { language: variantForm.language, yamlContent: variantForm.yamlContent, sampleTranscript: variantForm.sampleTranscript };
      const result = variantForm.variantId
        ? await api(`/admin/template-variants/${variantForm.variantId}/draft`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api(`/admin/template-families/${variantForm.familyId}/variants`, { method: "POST", body: JSON.stringify(payload) });

      const nextVariantId = variantForm.variantId || result.id;
      const nextDraftId = variantForm.variantId ? result.id : result.draft?.id;
      setVariantForm((current) => ({ ...current, variantId: nextVariantId, draftId: nextDraftId ?? current.draftId }));
      setVariant((current) => current ? { ...current, id: nextVariantId } : current);
      if (!variantForm.variantId && nextVariantId && typeof window !== "undefined") {
        window.history.replaceState(
          null,
          "",
          appPath(`/templates/designer?familyId=${encodeURIComponent(variantForm.familyId)}&variantId=${encodeURIComponent(nextVariantId)}`)
        );
      }
      setDirty(false);
      setSaveState("saved");
      setLastSavedAt(new Date());
      if (!options.silent) notify({ title: "Changes saved", message: "Mobile users will not see these changes until you publish.", tone: "success" });
      return { variantId: nextVariantId, draftId: nextDraftId };
    } catch (err) {
      const message = getErrorMessage(err);
      setSaveState("error");
      if (!options.silent) notify({ title: "Changes were not saved", message, tone: "danger" });
      else setError(message);
      return null;
    }
  }

  async function publishDraft() {
    setError("");
    const saved = dirty || !variantForm.variantId ? await saveDraft({ silent: true }) : { variantId: variantForm.variantId, draftId: variantForm.draftId };
    const targetVariantId = saved?.variantId ?? variantForm.variantId;
    if (!targetVariantId) {
      notify({ title: "Publish needs saved changes", message: "Fix any YAML errors, then publish again.", tone: "danger" });
      return;
    }

    setSaveState("saving");
    try {
      const result = await api(`/admin/template-variants/${targetVariantId}/publish`, {
        method: "POST",
        body: JSON.stringify({ bump: variantForm.bump })
      });
      notify({ title: "Template published", message: `Published ${result.version ?? "a new version"}.`, tone: "success" });
      await load();
    } catch (err) {
      notify({ title: "Publish failed", message: getErrorMessage(err), tone: "danger" });
      setSaveState("error");
    }
  }

  async function aiAssist() {
    if (!family) return;
    const useCase = variantForm.aiUseCase.trim();
    if (!useCase) {
      notify({ title: "Describe the template first", message: "Tell AI what this template should be used for, then generate a suggestion.", tone: "danger" });
      return;
    }
    setSaveState("saving");
    try {
      const result = await api("/admin/template-drafts/ai-assist", {
        method: "POST",
        body: JSON.stringify({
          useCase,
          language: variantForm.language,
          category: family.category?.slug,
          title: family.title,
          icon: family.icon
        })
      });
      updateVariantForm((current) => ({ ...current, yamlContent: result.yamlContent, sampleTranscript: result.sampleTranscript }));
      setSelectedSectionIndex(0);
      setAiDialogOpen(false);
      notify({ title: "AI suggestion added", message: "Review and edit it before publishing.", tone: "success" });
    } catch (err) {
      notify({ title: "AI suggestion failed", message: getErrorMessage(err), tone: "danger" });
      setSaveState("error");
    }
  }

  async function generatePreview() {
    const saved = dirty || !variantForm.draftId ? await saveDraft({ silent: true }) : { variantId: variantForm.variantId, draftId: variantForm.draftId };
    const draftId = saved?.draftId ?? variantForm.draftId;
    if (!draftId) {
      notify({ title: "Preview needs saved changes", message: "Fix any YAML errors, then try again.", tone: "danger" });
      return;
    }

    setSaveState("saving");
    try {
      const preview = await api(`/admin/template-drafts/${draftId}/preview`, { method: "POST" });
      setVariantForm((current) => ({ ...current, draftId, preview }));
      setPreviewTab("document");
      if (preview.error) notify({ title: "Preview failed", message: preview.error, tone: "danger" });
      else notify({ title: "Preview generated", message: "Generated from the current template and sample transcript.", tone: "success" });
      setSaveState("saved");
    } catch (err) {
      notify({ title: "Preview failed", message: getErrorMessage(err), tone: "danger" });
      setSaveState("error");
    }
  }

  async function restorePublishedVersion() {
    const target = pendingRestoreVersion;
    if (!target || !variantForm.variantId) return;

    let nextLanguage = variantForm.language;
    try {
      const doc = ensureTemplateDoc(target.yamlContent);
      nextLanguage = doc.identity?.language ?? nextLanguage;
    } catch (err) {
      notify({ title: "Version cannot be restored", message: getErrorMessage(err), tone: "danger" });
      setPendingRestoreVersion(null);
      return;
    }

    setSaveState("saving");
    try {
      const draft = await api(`/admin/template-variants/${variantForm.variantId}/draft`, {
        method: "PATCH",
        body: JSON.stringify({
          language: nextLanguage,
          yamlContent: target.yamlContent,
          sampleTranscript: variantForm.sampleTranscript
        })
      });
      setVariantForm((current) => ({
        ...current,
        draftId: draft.id ?? current.draftId,
        language: nextLanguage,
        yamlContent: target.yamlContent,
        preview: null
      }));
      setVariant((current) => current ? { ...current, language: nextLanguage, draft } : current);
      setSelectedSectionIndex(null);
      setDirty(false);
      setSaveState("saved");
      setLastSavedAt(new Date());
      setPendingRestoreVersion(null);
      notify({
        title: `Draft restored to v${target.version}`,
        message: "Review the draft, then publish it if this should become the mobile version.",
        tone: "success"
      });
    } catch (err) {
      notify({ title: "Restore failed", message: getErrorMessage(err), tone: "danger" });
      setSaveState("error");
    }
  }

  const saveLabel = saveState === "saving"
    ? "Saving changes..."
    : saveState === "dirty"
      ? "Unsaved changes"
      : saveState === "error"
        ? "Could not save"
        : lastSavedAt
          ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Saved";

  if (loading) {
    return (
      <RequireAuth>
        <LoadingPanel label="Loading template designer" />
      </RequireAuth>
    );
  }

  if (!family) {
    return (
      <RequireAuth>
        <EmptyState
          title="Template not found"
          message={error || "The selected template family is not available."}
          action={<a className="button secondary" href={appPath("/templates")}><ArrowLeft size={16} /> Back to templates</a>}
        />
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="template-route">
        <a className="template-back-link" href={appPath("/templates")}><ArrowLeft size={16} /> Templates</a>
        <header className="template-topbar">
          <div className="template-topbar-main">
            <div className="template-title-block">
              <div className="template-kicker">
                <span>{family.title}</span>
                <span>·</span>
                <span>{variantForm.language}</span>
              </div>
              <h1>{templateIdentity?.title ?? family.title}</h1>
              <div className="template-published-line">
                <span>Current published version</span>
                <div className="version-picker">
                  <button
                    type="button"
                    className="version-picker-trigger"
                    onClick={() => setVersionMenuOpen((open) => !open)}
                    disabled={!publishedVersions.length}
                    aria-expanded={versionMenuOpen}
                  >
                    <strong>{latestVersion ? `v${latestVersion.version}` : "none yet"}</strong>
                    {!!publishedVersions.length && <ChevronDown size={13} />}
                  </button>
                  {versionMenuOpen && !!publishedVersions.length && (
                    <div className="version-picker-menu" role="menu" aria-label="Published versions">
                      <div className="version-picker-menu-header">
                        <strong>Published versions</strong>
                        <span>Select one to restore it to the current draft.</span>
                      </div>
                      {publishedVersions.map((published) => (
                        <button
                          key={published.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setPendingRestoreVersion(published);
                            setVersionMenuOpen(false);
                          }}
                        >
                          <span>
                            <strong>v{published.version}</strong>
                            {published.id === latestVersion?.id && <em>Current</em>}
                          </span>
                          <small>{formatTime(published.publishedAt)}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="template-title-tools">
                <button className="button secondary" type="button" onClick={() => setAiDialogOpen(true)}>
                  <Sparkles size={15} /> AI helper
                </button>
              </div>
            </div>
          </div>
          <div className="template-topbar-actions">
            <span className={`save-indicator ${saveState}`}>
              {saveState === "saving" && <Loader2 size={13} />}
              {saveLabel}
            </span>
            <div className="publish-panel" aria-label="Publish changes">
              <div className="publish-panel-header">
                <span>Publish changes as</span>
                <InfoTip text="Major changes the first version number for large structure changes. Minor changes the middle number for meaningful improvements. Patch changes the last number for small fixes." />
              </div>
              <div className="publish-control">
                {(["major", "minor", "patch"] as const).map((bump) => (
                  <button
                    key={bump}
                    type="button"
                    className={variantForm.bump === bump ? "active" : ""}
                    aria-pressed={variantForm.bump === bump}
                    title={`${bump[0].toUpperCase()}${bump.slice(1)} version bump`}
                    onClick={() => setVariantForm((current) => ({ ...current, bump }))}
                  >
                    {bump}
                  </button>
                ))}
              </div>
              <button className="button" type="button" onClick={publishDraft}><Wand2 size={15} /> Publish{nextPublishVersion ? ` v${nextPublishVersion}` : ""}</button>
            </div>
          </div>
        </header>

        {error && <Alert tone="danger">{error}</Alert>}

        <Modal
          open={aiDialogOpen}
          title="AI template helper"
          description="Describe the intended use. AI will generate a starting suggestion for the editable template and sample transcript."
          onClose={() => setAiDialogOpen(false)}
          footer={(
            <>
              <button className="button secondary" type="button" onClick={() => setAiDialogOpen(false)}>Cancel</button>
              <button className="button" type="button" onClick={aiAssist} disabled={saveState === "saving"}>
                <Sparkles size={15} /> Generate suggestion
              </button>
            </>
          )}
        >
          <div className="ai-template-dialog">
            <FieldLabel>Template intention</FieldLabel>
            <textarea
              value={variantForm.aiUseCase}
              onChange={(event) => setVariantForm((current) => ({ ...current, aiUseCase: event.target.value }))}
              placeholder="Example: A Norwegian template for follow-up conversations after municipal health meetings. It should produce a short summary, decisions, next steps, and responsible people."
            />
            <p>Nothing is published automatically. Review and edit the suggestion before publishing changes.</p>
          </div>
        </Modal>

        <Modal
          open={Boolean(pendingRestoreVersion)}
          title={pendingRestoreVersion ? `Restore v${pendingRestoreVersion.version}?` : "Restore version"}
          description="This replaces the current draft YAML with the selected published snapshot. It does not change what the mobile app sees until you publish the restored draft."
          onClose={() => setPendingRestoreVersion(null)}
          footer={(
            <>
              <button className="button secondary" type="button" onClick={() => setPendingRestoreVersion(null)}>Cancel</button>
              <button className="button" type="button" onClick={restorePublishedVersion} disabled={saveState === "saving"}>
                Restore to draft
              </button>
            </>
          )}
        >
          <div className="version-restore-dialog">
            <p>
              The current draft will be overwritten with <strong>v{pendingRestoreVersion?.version}</strong>.
              Sample transcript text is kept, and any generated preview is cleared because it may no longer match the restored YAML.
            </p>
          </div>
        </Modal>

        <div className="template-workbench" aria-label="Template designer">
          <aside className="template-outline">
            <div className="pane-title">
              <span>Outline</span>
              <strong>{templateSections.length}</strong>
            </div>
            <button
              type="button"
              className={`outline-row identity-row${selectedSectionIndex === null ? " selected" : ""}`}
              onClick={() => setSelectedSectionIndex(null)}
            >
              <FileText size={15} />
              <span>
                <strong>Identity</strong>
                <small>Title, language and metadata</small>
              </span>
            </button>

            <div className="outline-list">
              {templateSections.map((section, index) => (
                <button
                  key={`${section.title}-${index}`}
                  type="button"
                  className={`outline-row${selectedSectionIndex === index ? " selected" : ""}${dragIndex === index ? " dragging" : ""}`}
                  draggable
                  onClick={() => setSelectedSectionIndex(index)}
                  onKeyDown={(event) => handleOutlineKeyDown(event, index)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDragIndex(index);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null) moveSection(dragIndex, index);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                >
                  <GripVertical size={14} className="outline-grip" />
                  <span className={`outline-number${section.required ? " required" : ""}`}>{index + 1}</span>
                  <span>
                    <strong>{section.title || "Untitled section"}</strong>
                    <small>{section.format || "prose"}</small>
                  </span>
                </button>
              ))}
            </div>

            {!templateSections.length && (
              <div className="outline-skeleton">
                <span>Start with a common structure</span>
                <button type="button" onClick={addStarterSkeleton}>{sectionPresets.slice(0, 3).map((preset) => preset.title).join(" · ")}</button>
              </div>
            )}

            <details className="outline-add">
              <summary><Plus size={15} /> Add section <ChevronDown size={14} /></summary>
              <div>
                {sectionPresets.map((preset) => (
                  <button key={preset.title} type="button" onClick={() => addSection(preset)}>
                    <strong>{preset.title}</strong>
                    <span>{preset.format}</span>
                  </button>
                ))}
              </div>
            </details>
          </aside>

          <main className="template-editor-pane">
            {selectedSection ? (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Section {selectedSectionIndex! + 1}</span>
                    <h2>{selectedSection.title || "Untitled section"}</h2>
                  </div>
                  <div className="row actions">
                    <IconAction label="Duplicate section" onClick={() => duplicateSection(selectedSectionIndex!)}><CopyPlus size={15} /></IconAction>
                    <IconAction label="Delete section" tone="danger" onClick={() => removeSection(selectedSectionIndex!)}><Trash2 size={15} /></IconAction>
                  </div>
                </div>

                <div className="section-editor-grid">
                  <div className="field wide">
                    <FieldLabel>Section title</FieldLabel>
                    <input className="input section-title-large" value={selectedSection.title ?? ""} onChange={(event) => updateSection(selectedSectionIndex!, { title: event.target.value })} />
                  </div>
                  <div className="field">
                    <FieldLabel>Format</FieldLabel>
                    <select value={selectedSection.format ?? "prose"} onChange={(event) => updateSection(selectedSectionIndex!, { format: event.target.value })}>
                      <option value="prose">Prose</option>
                      <option value="bullets">Bullets</option>
                      <option value="table">Table</option>
                      <option value="checklist">Checklist</option>
                      <option value="fields">Fields</option>
                    </select>
                  </div>
                  <label className="required-switch">
                    <input type="checkbox" checked={Boolean(selectedSection.required)} onChange={(event) => updateSection(selectedSectionIndex!, { required: event.target.checked })} />
                    <span>
                      <strong>Required section</strong>
                      <small>Always include this in the output.</small>
                    </span>
                  </label>
                  <div className="field wide">
                    <FieldLabel>Purpose</FieldLabel>
                    <textarea value={selectedSection.purpose ?? ""} onChange={(event) => updateSection(selectedSectionIndex!, { purpose: event.target.value })} />
                  </div>
                  <div className="field wide">
                    <FieldLabel>Extraction hints</FieldLabel>
                    <textarea value={listToText(selectedSection.extraction_hints)} onChange={(event) => updateSection(selectedSectionIndex!, { extraction_hints: textToList(event.target.value) })} />
                  </div>
                </div>
              </section>
            ) : (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Template identity</span>
                    <h2>Metadata and language</h2>
                  </div>
                  <span className="badge">{requiredCount} required sections</span>
                </div>

                <div className="identity-editor-grid">
                  <div className="field wide">
                    <FieldLabel>Title</FieldLabel>
                    <input className="input template-title-input" value={templateIdentity?.title ?? ""} onChange={(event) => updateIdentity("title", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel>Short description</FieldLabel>
                    <textarea value={templateIdentity?.short_description ?? ""} onChange={(event) => updateIdentity("short_description", event.target.value)} />
                  </div>
                  <div className="field">
                    <FieldLabel>Language</FieldLabel>
                    <LanguageCombobox value={variantForm.language} onChange={updateLanguage} />
                  </div>
                  <div className="field">
                    <FieldLabel>Category</FieldLabel>
                    <select value={templateIdentity?.category ?? ""} onChange={(event) => updateIdentity("category", event.target.value)}>
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.slug}>{category.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field wide">
                    <FieldLabel help="SF Symbol name used by the iOS app, for example waveform.and.mic.">Icon</FieldLabel>
                    <IconPicker value={templateIdentity?.icon ?? "doc.text"} onChange={(icon) => updateIdentity("icon", icon)} />
                  </div>
                  <div className="field">
                    <FieldLabel>Version in YAML</FieldLabel>
                    <input className="input" value={templateIdentity?.version ?? ""} onChange={(event) => updateIdentity("version", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel>Tags</FieldLabel>
                    <TagEditor value={templateIdentity?.tags ?? []} options={tagOptions} onChange={(tags) => updateIdentity("tags", tags)} onCreateTag={createTemplateTag} />
                  </div>
                </div>
              </section>
            )}
          </main>

          <aside className="template-preview-pane">
            <div className="preview-tabs" role="tablist" aria-label="Preview tabs">
              <button type="button" className={previewTab === "document" ? "active" : ""} onClick={() => setPreviewTab("document")}><FileText size={14} /> Document</button>
              <button type="button" className={previewTab === "yaml" ? "active" : ""} onClick={() => setPreviewTab("yaml")}><FileCode2 size={14} /> YAML</button>
              <button type="button" className={previewTab === "sample" ? "active" : ""} onClick={() => setPreviewTab("sample")}><Bot size={14} /> Sample</button>
            </div>

            <div className="preview-content">
              {previewTab === "document" && (
                variantForm.preview?.markdown ? (
                  <MarkdownDocument markdown={variantForm.preview.markdown} />
                ) : (
                  <EmptyState title="No generated preview" message="Generate a preview from the current template and sample transcript." />
                )
              )}
              {previewTab === "yaml" && (
                <textarea
                  className="yaml-route-editor"
                  value={variantForm.yamlContent}
                  onChange={(event) => {
                    updateVariantForm((current) => ({ ...current, yamlContent: event.target.value }));
                  }}
                  spellCheck={false}
                />
              )}
              {previewTab === "sample" && (
                <div className="sample-editor">
                  <FieldLabel>Sample transcript fixture</FieldLabel>
                  <textarea
                    value={variantForm.sampleTranscript}
                    onChange={(event) => updateVariantForm((current) => ({ ...current, sampleTranscript: event.target.value }))}
                    placeholder="Paste or write a representative transcript that this template should handle."
                  />
                </div>
              )}
            </div>

            <div className="preview-footer">
              <div>
                <span>Preview provider</span>
                <strong>{previewProviderLabel}</strong>
                <small>{previewProviderDetail}</small>
              </div>
              <button className="button secondary" type="button" onClick={generatePreview} disabled={!previewProviderStatus?.configured}><Wand2 size={15} /> Generate preview</button>
            </div>
          </aside>
        </div>
      </div>
    </RequireAuth>
  );
}

function MarkdownDocument({ markdown }: { markdown: string }) {
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(key: string) {
    if (!listItems.length) return;
    nodes.push(
      <ul key={key}>
        {listItems.map((item, index) => <li key={`${key}-${index}`}>{item}</li>)}
      </ul>
    );
    listItems = [];
  }

  markdown.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`list-${index}`);
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushList(`list-${index}`);
      nodes.push(<h3 key={index}>{trimmed.slice(4)}</h3>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList(`list-${index}`);
      nodes.push(<h2 key={index}>{trimmed.slice(3)}</h2>);
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList(`list-${index}`);
      nodes.push(<h1 key={index}>{trimmed.slice(2)}</h1>);
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList(`list-${index}`);
    nodes.push(<p key={index}>{trimmed}</p>);
  });
  flushList("list-final");

  return <div className="markdown-document">{nodes}</div>;
}
