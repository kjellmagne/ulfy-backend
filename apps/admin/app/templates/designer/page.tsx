"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as yaml from "js-yaml";
import { ArrowLeft, Bot, ChevronDown, CopyPlus, FileCode2, FileText, GripVertical, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Alert, EmptyState, FieldLabel, IconAction, InfoTip, LoadingPanel, Modal } from "../../../components/AdminUI";
import { IconPicker, LanguageCombobox, TagEditor, TemplateIcon, localizeTemplateSectionPresets, presetToTemplateSection } from "../../../components/TemplateControls";
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

type TemplateParticipant = {
  role?: string;
  name?: string | null;
};

type TemplateContext = {
  purpose?: string;
  typical_setting?: string | null;
  typical_participants?: TemplateParticipant[];
  goals?: string[];
  related_processes?: string[];
  [key: string]: unknown;
};

type TemplatePerspective = {
  voice?: string;
  audience?: string;
  tone?: string;
  style_rules?: string[];
  preserve_original_voice?: boolean;
  [key: string]: unknown;
};

type TemplateContentRules = {
  required_elements?: string[];
  exclusions?: string[];
  uncertainty_handling?: string | null;
  action_item_format?: string | null;
  decision_marker?: string | null;
  speaker_attribution?: string | null;
  [key: string]: unknown;
};

type TemplatePrompting = {
  system_prompt_additions?: string | null;
  fallback_behavior?: string | null;
  post_processing?: {
    extract_action_items?: boolean;
    structured_output?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
  context?: TemplateContext;
  perspective?: TemplatePerspective;
  structure?: { sections?: TemplateSection[] };
  content_rules?: TemplateContentRules;
  llm_prompting?: TemplatePrompting;
  [key: string]: unknown;
};

type TemplatePanelKey = "template" | "context" | "perspective" | "structure" | "content_rules" | "prompting";

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
    format: "bullet_list",
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
    format: "bullet_list",
    required: false,
    extraction_hints: ["risk", "blocker", "dependency"]
  }
];

const templatePanels: Array<{ key: TemplatePanelKey; title: string; detail: string }> = [
  { key: "template", title: "Template", detail: "Title, icon, category and language" },
  { key: "context", title: "Context", detail: "Purpose, setting, participants and goals" },
  { key: "perspective", title: "Perspective", detail: "Voice, audience, tone and style" },
  { key: "structure", title: "Output structure", detail: "Sections, order, format and required state" },
  { key: "content_rules", title: "Content rules", detail: "Required facts, exclusions and uncertainty" },
  { key: "prompting", title: "Prompting", detail: "Template prompt additions and post-processing" }
];

const templateVoiceOptions = [
  { value: "first_person_singular", label: "First person singular" },
  { value: "first_person_plural", label: "First person plural" },
  { value: "third_person", label: "Third person" },
  { value: "dual", label: "Dual" }
];

const templateAudienceOptions = [
  { value: "self", label: "Self" },
  { value: "colleagues", label: "Colleagues" },
  { value: "hr", label: "HR" },
  { value: "bruker", label: "Bruker" },
  { value: "arkiv", label: "Arkiv" },
  { value: "ledelse", label: "Ledelse" },
  { value: "blandet", label: "Blandet" }
];

const templateToneOptions = [
  { value: "formell", label: "Formal" },
  { value: "semi_formell", label: "Semi-formal" },
  { value: "samtalepreget", label: "Conversational" }
];

const sectionFormatOptions = [
  { value: "prose", label: "Prose" },
  { value: "bullet_list", label: "Bullet list" },
  { value: "numbered_list", label: "Numbered list" },
  { value: "table", label: "Table" },
  { value: "fill_in", label: "Fill in" },
  { value: "quote_block", label: "Quote block" }
];

const speakerAttributionOptions = [
  { value: "none", label: "None" },
  { value: "full_name", label: "Full name" },
  { value: "role_only", label: "Role only" },
  { value: "initials", label: "Initials" },
  { value: "anonymized", label: "Anonymized" }
];

const designerHelp = {
  templateIntention: "Describe the note you want and when it will be used. The helper only creates a starting point; you still review and shape it before anything is published.",
  title: "This is the name people see when they choose a template. Use the words a user would recognize when they need this note.",
  shortDescription: "A short promise of what the template produces. It helps people quickly choose the right template.",
  language: "The main language for the finished note. It also nudges labels, dates, and phrasing toward that language.",
  category: "Where this template lives in the catalog. Pick the place users would naturally look for it.",
  icon: "The symbol shown with the template in the app. Choose something that reminds people of the task or situation.",
  version: "A simple label for the template text itself. Publishing still controls the release version people receive in the app.",
  tags: "Extra labels that make templates easier to find and group. Use themes like HR, follow-up, municipality, or field work.",
  contextPurpose: "The job this template is meant to do. This keeps the final note focused instead of turning into a generic summary.",
  typicalSetting: "Where this template is usually used, such as a meeting, care conversation, inspection, or dictation. This gives the note the right common sense.",
  typicalParticipants: "Who normally takes part. Roles matter more than names, because they help the note understand who is speaking and who the note is about.",
  goals: "What the finished note should help the reader do next. One goal per line works best.",
  relatedProcesses: "Any workflow this note belongs to, such as follow-up, archiving, case handling, or reporting.",
  voice: "Choose who the note sounds like it is written by. This changes phrasing like I observed, we agreed, or the team decided.",
  audience: "Choose the likely reader. A private note can be lighter; a note for archive, HR, or leadership should be clearer and more complete.",
  tone: "How formal the writing should feel. Match the place the note will be read, not just personal preference.",
  preserveOriginalVoice: "Keep the speaker's own wording when it matters, especially for reflections, statements, or sensitive phrasing.",
  styleRules: "Small writing habits for this template. Use this for rules like keep it concise, avoid judgmental language, or write in Norwegian.",
  sectionTitle: "The heading shown in the finished note. Make it clear enough that the reader knows what belongs there.",
  sectionFormat: "The shape of this part of the note: paragraph, bullets, table, and so on. Pick the shape that makes the content easiest to scan.",
  sectionRequired: "Required sections always appear, even when the transcript has little to say. Use this for parts people expect every time.",
  sectionPurpose: "What this section is supposed to accomplish. This is often the most important sentence for getting the right content in the right place.",
  extractionHints: "Clues the note should listen for when filling this section. Add words people actually use in the conversations.",
  requiredElements: "Things the note should try to include when the transcript supports them. One clear item per line is easiest to maintain.",
  exclusions: "Things to leave out even if they are mentioned. Use this to protect privacy, avoid noise, or keep the note from drifting.",
  uncertaintyHandling: "What to do when the recording is unclear or details are missing. Good templates mark uncertainty instead of guessing.",
  actionItemFormat: "How tasks should be written when they appear. A predictable format makes follow-up easier.",
  decisionMarker: "How clear decisions should be called out. This helps readers spot what was actually decided, not just discussed.",
  speakerAttribution: "Whether the note should say who said something. Use attribution only when the speaker matters for responsibility or context.",
  systemPromptAdditions: "Extra instructions that affect the whole template. Use this sparingly for important behavior that no other field covers.",
  fallbackBehavior: "What the note should do when a section cannot be filled. This prevents confident-looking guesses.",
  extractActionItems: "Also save clear tasks in the app's action list. Leave this on when follow-up work is part of the result.",
  structuredOutput: "An advanced field for teams that need a predictable data shape behind the note. Most templates can leave this empty.",
  sampleTranscript: "A realistic example used to test the template. The preview is only as good as this sample is close to real recordings.",
  yaml: "The full template text behind the designer. Use this when you need fine control or want to inspect exactly what will be saved."
} as const;

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
      purpose: `Create a clear, structured document for ${family.title || "this recording"}.`,
      typical_setting: "Recording, dictation, meeting, or conversation captured in Ulfy.",
      typical_participants: [{ role: "speaker" }],
      goals: ["Create a useful structured note from the transcript."],
      related_processes: []
    },
    perspective: {
      voice: "third_person",
      audience: "self",
      tone: "semi_formell",
      style_rules: ["Write clearly and concisely.", "Use only information supported by the transcript."],
      preserve_original_voice: false
    },
    structure: {
      sections: presets.slice(0, 3)
    },
    content_rules: {
      required_elements: ["Include only information supported by the transcript."],
      exclusions: ["Do not include unsupported personal details."],
      uncertainty_handling: "Mark unclear or missing information instead of guessing.",
      action_item_format: "Action — Owner — Deadline",
      decision_marker: "Mark clear decisions explicitly.",
      speaker_attribution: "none"
    },
    llm_prompting: {
      system_prompt_additions: "Create a structured note from the transcript using the template sections.",
      fallback_behavior: "If a required section has no support in the transcript, write that it was not covered.",
      post_processing: {
        extract_action_items: true
      }
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
  doc.context ??= {};
  doc.context.purpose ??= "";
  doc.context.typical_setting ??= "";
  doc.context.typical_participants ??= [];
  doc.context.goals ??= [];
  doc.context.related_processes ??= [];
  doc.perspective ??= {};
  doc.perspective.voice ??= "third_person";
  doc.perspective.audience ??= "self";
  doc.perspective.tone ??= "semi_formell";
  doc.perspective.style_rules ??= [];
  doc.perspective.preserve_original_voice ??= false;
  doc.structure ??= {};
  doc.structure.sections ??= [];
  doc.content_rules ??= {};
  doc.content_rules.required_elements ??= [];
  doc.content_rules.exclusions ??= [];
  doc.content_rules.uncertainty_handling ??= "";
  doc.content_rules.action_item_format ??= "";
  doc.content_rules.decision_marker ??= "";
  doc.content_rules.speaker_attribution ??= "none";
  doc.llm_prompting ??= {};
  doc.llm_prompting.system_prompt_additions ??= "";
  doc.llm_prompting.fallback_behavior ??= "";
  doc.llm_prompting.post_processing ??= {};
  doc.llm_prompting.post_processing.extract_action_items ??= false;
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

function valueToText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function participantsToText(value?: TemplateParticipant[]) {
  return (value ?? []).map((participant) => {
    const role = participant.role?.trim() ?? "";
    const name = participant.name?.trim() ?? "";
    return name ? `${role}: ${name}` : role;
  }).filter(Boolean).join("\n");
}

function textToParticipants(value: string): TemplateParticipant[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [role, ...nameParts] = line.split(":");
    return {
      role: role.trim(),
      name: nameParts.join(":").trim() || null
    };
  });
}

function structuredOutputToText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function textToStructuredOutput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed);
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
  const [activePanel, setActivePanel] = useState<TemplatePanelKey>("template");
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
      setActivePanel("template");
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
  const templateContext = templateDoc?.context ?? {};
  const templatePerspective = templateDoc?.perspective ?? {};
  const templateSections = templateDoc?.structure?.sections ?? [];
  const templateContentRules = templateDoc?.content_rules ?? {};
  const templatePrompting = templateDoc?.llm_prompting ?? {};
  const templatePostProcessing = templatePrompting.post_processing ?? {};
  const baseSectionPresets = sectionPresetRows.length ? sectionPresetRows.map(presetToTemplateSection) : fallbackSectionPresets;
  const sectionPresets = localizeTemplateSectionPresets(baseSectionPresets, variantForm.language);
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
  const contextParticipants = Array.isArray(templateContext.typical_participants) ? templateContext.typical_participants : [];
  const contextGoals = Array.isArray(templateContext.goals) ? templateContext.goals : [];
  const contextRelatedProcesses = Array.isArray(templateContext.related_processes) ? templateContext.related_processes : [];
  const perspectiveStyleRules = Array.isArray(templatePerspective.style_rules) ? templatePerspective.style_rules : [];
  const requiredElements = Array.isArray(templateContentRules.required_elements) ? templateContentRules.required_elements : [];
  const exclusions = Array.isArray(templateContentRules.exclusions) ? templateContentRules.exclusions : [];

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
      }
    });
  }

  function updateContext(field: keyof TemplateContext, value: unknown) {
    updateTemplate((doc) => {
      doc.context ??= {};
      (doc.context as Record<string, unknown>)[field] = value;
    });
  }

  function updatePerspective(field: keyof TemplatePerspective, value: unknown) {
    updateTemplate((doc) => {
      doc.perspective ??= {};
      (doc.perspective as Record<string, unknown>)[field] = value;
    });
  }

  function updateContentRules(field: keyof TemplateContentRules, value: unknown) {
    updateTemplate((doc) => {
      doc.content_rules ??= {};
      (doc.content_rules as Record<string, unknown>)[field] = value;
    });
  }

  function updatePrompting(field: keyof TemplatePrompting, value: unknown) {
    updateTemplate((doc) => {
      doc.llm_prompting ??= {};
      (doc.llm_prompting as Record<string, unknown>)[field] = value;
    });
  }

  function updatePostProcessing(field: string, value: unknown) {
    updateTemplate((doc) => {
      doc.llm_prompting ??= {};
      doc.llm_prompting.post_processing ??= {};
      const postProcessing = doc.llm_prompting.post_processing as Record<string, unknown>;
      if (value === undefined) delete postProcessing[field];
      else postProcessing[field] = value;
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
    setActivePanel("structure");
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
    setActivePanel("structure");
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
      setActivePanel("structure");
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
      setActivePanel("template");
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
            <FieldLabel help={designerHelp.templateIntention}>Template intention</FieldLabel>
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
              <span>Template model</span>
              <strong>{templatePanels.length}</strong>
            </div>

            <div className="outline-list">
              {templatePanels.map((panel) => (
                <button
                  key={panel.key}
                  type="button"
                  className={`outline-row concept-row${activePanel === panel.key ? " selected" : ""}`}
                  onClick={() => setActivePanel(panel.key)}
                >
                  <FileText size={15} />
                  <span>
                    <strong>{panel.title}</strong>
                    <small>{panel.detail}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="template-outline-summary">
              <span>{templateSections.length} output sections</span>
              <strong>{requiredCount} required</strong>
            </div>

            <details className="outline-add">
              <summary><Plus size={15} /> Add output section <ChevronDown size={14} /></summary>
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
            <div className="template-summary-card">
              <span className="template-summary-icon"><TemplateIcon symbol={templateIdentity?.icon ?? "doc.text"} size={24} /></span>
              <div>
                <h2>{templateIdentity?.title ?? family.title}</h2>
                <p>{templateIdentity?.short_description || family.shortDescription || "No short description yet."}</p>
                <div className="template-summary-meta">
                  <span>{templateIdentity?.category || "general"}</span>
                  <span>{variantForm.language}</span>
                  <span>v{templateIdentity?.version ?? "0.1.0"}</span>
                  <span>{templateSections.length} sections</span>
                </div>
              </div>
            </div>

            {activePanel === "template" && (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Template</span>
                    <h2>Catalog identity</h2>
                  </div>
                  <span className="badge">{requiredCount} required sections</span>
                </div>

                <div className="identity-editor-grid">
                  <div className="field wide">
                    <FieldLabel help={designerHelp.title}>Title</FieldLabel>
                    <input className="input template-title-input" value={templateIdentity?.title ?? ""} onChange={(event) => updateIdentity("title", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.shortDescription}>Short description</FieldLabel>
                    <textarea value={templateIdentity?.short_description ?? ""} onChange={(event) => updateIdentity("short_description", event.target.value)} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.language}>Language</FieldLabel>
                    <LanguageCombobox value={variantForm.language} onChange={updateLanguage} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.category}>Category</FieldLabel>
                    <select value={templateIdentity?.category ?? ""} onChange={(event) => updateIdentity("category", event.target.value)}>
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.slug}>{category.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.icon}>Icon</FieldLabel>
                    <IconPicker value={templateIdentity?.icon ?? "doc.text"} onChange={(icon) => updateIdentity("icon", icon)} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.version}>Version in YAML</FieldLabel>
                    <input className="input" value={templateIdentity?.version ?? ""} onChange={(event) => updateIdentity("version", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.tags}>Tags</FieldLabel>
                    <TagEditor value={templateIdentity?.tags ?? []} options={tagOptions} onChange={(tags) => updateIdentity("tags", tags)} onCreateTag={createTemplateTag} />
                  </div>
                </div>
              </section>
            )}

            {activePanel === "context" && (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Context</span>
                    <h2>Use case and meeting setting</h2>
                  </div>
                </div>
                <div className="identity-editor-grid">
                  <div className="field wide">
                    <FieldLabel help={designerHelp.contextPurpose}>Purpose</FieldLabel>
                    <textarea value={valueToText(templateContext.purpose)} onChange={(event) => updateContext("purpose", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.typicalSetting}>Typical setting</FieldLabel>
                    <textarea value={valueToText(templateContext.typical_setting)} onChange={(event) => updateContext("typical_setting", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.typicalParticipants}>Typical participants</FieldLabel>
                    <textarea value={participantsToText(contextParticipants)} onChange={(event) => updateContext("typical_participants", textToParticipants(event.target.value))} placeholder="One participant per line. Use Role: Name when needed." />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.goals}>Goals</FieldLabel>
                    <textarea value={listToText(contextGoals)} onChange={(event) => updateContext("goals", textToList(event.target.value))} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.relatedProcesses}>Related processes</FieldLabel>
                    <textarea value={listToText(contextRelatedProcesses)} onChange={(event) => updateContext("related_processes", textToList(event.target.value))} />
                  </div>
                </div>
              </section>
            )}

            {activePanel === "perspective" && (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Perspective</span>
                    <h2>Voice, audience and style</h2>
                  </div>
                </div>
                <div className="identity-editor-grid">
                  <div className="field">
                    <FieldLabel help={designerHelp.voice}>Voice</FieldLabel>
                    <select value={templatePerspective.voice ?? "third_person"} onChange={(event) => updatePerspective("voice", event.target.value)}>
                      {templateVoiceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.audience}>Audience</FieldLabel>
                    <select value={templatePerspective.audience ?? "self"} onChange={(event) => updatePerspective("audience", event.target.value)}>
                      {templateAudienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.tone}>Tone</FieldLabel>
                    <select value={templatePerspective.tone ?? "semi_formell"} onChange={(event) => updatePerspective("tone", event.target.value)}>
                      {templateToneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <label className="required-switch">
                    <input type="checkbox" checked={Boolean(templatePerspective.preserve_original_voice)} onChange={(event) => updatePerspective("preserve_original_voice", event.target.checked)} />
                    <span>
                      <SwitchTitle help={designerHelp.preserveOriginalVoice}>Preserve original voice</SwitchTitle>
                      <small>Keep first-person phrasing when the transcript supports it.</small>
                    </span>
                  </label>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.styleRules}>Style rules</FieldLabel>
                    <textarea value={listToText(perspectiveStyleRules)} onChange={(event) => updatePerspective("style_rules", textToList(event.target.value))} />
                  </div>
                </div>
              </section>
            )}

            {activePanel === "structure" && (
              <section className="editor-card structure-editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Output structure</span>
                    <h2>Sections shown in generated notes</h2>
                  </div>
                  <button type="button" className="button secondary" onClick={addStarterSkeleton}><Plus size={15} /> Add common structure</button>
                </div>

                {!templateSections.length && (
                  <div className="outline-skeleton">
                    <span>Start with a common structure</span>
                    <button type="button" onClick={addStarterSkeleton}>{sectionPresets.slice(0, 3).map((preset) => preset.title).join(" · ")}</button>
                  </div>
                )}

                <div className="structure-section-list">
                  {templateSections.map((section, index) => (
                    <article
                      key={`${section.title}-${index}`}
                      className={`template-section-card${selectedSectionIndex === index ? " selected" : ""}${dragIndex === index ? " dragging" : ""}`}
                      draggable
                      onClick={() => setSelectedSectionIndex(index)}
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
                      <div className="template-section-card-header">
                        <GripVertical size={15} className="outline-grip" />
                        <span className={`outline-number${section.required ? " required" : ""}`}>{index + 1}</span>
                        <div>
                          <strong>{section.title || "Untitled section"}</strong>
                          <small>{section.required ? "Required" : "Optional"} · {section.format || "prose"}</small>
                        </div>
                        <div className="row actions">
                          <IconAction label="Move section up" onClick={() => moveSection(index, index - 1)}><ChevronDown className="rotate-180" size={15} /></IconAction>
                          <IconAction label="Move section down" onClick={() => moveSection(index, index + 1)}><ChevronDown size={15} /></IconAction>
                          <IconAction label="Duplicate section" onClick={() => duplicateSection(index)}><CopyPlus size={15} /></IconAction>
                          <IconAction label="Delete section" tone="danger" onClick={() => removeSection(index)}><Trash2 size={15} /></IconAction>
                        </div>
                      </div>
                      <div className="section-editor-grid">
                        <div className="field wide">
                          <FieldLabel help={designerHelp.sectionTitle}>Section title</FieldLabel>
                          <input className="input section-title-large" value={section.title ?? ""} onChange={(event) => updateSection(index, { title: event.target.value })} />
                        </div>
                        <div className="field">
                          <FieldLabel help={designerHelp.sectionFormat}>Format</FieldLabel>
                          <select value={section.format ?? "prose"} onChange={(event) => updateSection(index, { format: event.target.value })}>
                            {sectionFormatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <label className="required-switch">
                          <input type="checkbox" checked={Boolean(section.required)} onChange={(event) => updateSection(index, { required: event.target.checked })} />
                          <span>
                            <SwitchTitle help={designerHelp.sectionRequired}>Required</SwitchTitle>
                            <small>Always include this section.</small>
                          </span>
                        </label>
                        <div className="field wide">
                          <FieldLabel help={designerHelp.sectionPurpose}>Purpose</FieldLabel>
                          <textarea value={section.purpose ?? ""} onChange={(event) => updateSection(index, { purpose: event.target.value })} />
                        </div>
                        <div className="field wide">
                          <FieldLabel help={designerHelp.extractionHints}>Extraction hints</FieldLabel>
                          <textarea value={listToText(section.extraction_hints)} onChange={(event) => updateSection(index, { extraction_hints: textToList(event.target.value) })} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <details className="section-preset-drawer">
                  <summary><Plus size={15} /> Add section preset <ChevronDown size={14} /></summary>
                  <div>
                    {sectionPresets.map((preset) => (
                      <button key={preset.title} type="button" onClick={() => addSection(preset)}>
                        <strong>{preset.title}</strong>
                        <span>{preset.format}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </section>
            )}

            {activePanel === "content_rules" && (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Content rules</span>
                    <h2>Factual boundaries and formatting rules</h2>
                  </div>
                </div>
                <div className="identity-editor-grid">
                  <div className="field wide">
                    <FieldLabel help={designerHelp.requiredElements}>Required elements</FieldLabel>
                    <textarea value={listToText(requiredElements)} onChange={(event) => updateContentRules("required_elements", textToList(event.target.value))} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.exclusions}>Exclusions</FieldLabel>
                    <textarea value={listToText(exclusions)} onChange={(event) => updateContentRules("exclusions", textToList(event.target.value))} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.uncertaintyHandling}>Uncertainty handling</FieldLabel>
                    <textarea value={valueToText(templateContentRules.uncertainty_handling)} onChange={(event) => updateContentRules("uncertainty_handling", event.target.value)} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.actionItemFormat}>Action item format</FieldLabel>
                    <input className="input" value={valueToText(templateContentRules.action_item_format)} onChange={(event) => updateContentRules("action_item_format", event.target.value)} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.decisionMarker}>Decision marker</FieldLabel>
                    <input className="input" value={valueToText(templateContentRules.decision_marker)} onChange={(event) => updateContentRules("decision_marker", event.target.value)} />
                  </div>
                  <div className="field">
                    <FieldLabel help={designerHelp.speakerAttribution}>Speaker attribution</FieldLabel>
                    <select value={templateContentRules.speaker_attribution ?? "none"} onChange={(event) => updateContentRules("speaker_attribution", event.target.value)}>
                      {speakerAttributionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              </section>
            )}

            {activePanel === "prompting" && (
              <section className="editor-card">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">Prompting</span>
                    <h2>LLM additions and post-processing</h2>
                  </div>
                </div>
                <div className="identity-editor-grid">
                  <div className="field wide">
                    <FieldLabel help={designerHelp.systemPromptAdditions}>System prompt additions</FieldLabel>
                    <textarea value={valueToText(templatePrompting.system_prompt_additions)} onChange={(event) => updatePrompting("system_prompt_additions", event.target.value)} />
                  </div>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.fallbackBehavior}>Fallback behavior</FieldLabel>
                    <textarea value={valueToText(templatePrompting.fallback_behavior)} onChange={(event) => updatePrompting("fallback_behavior", event.target.value)} />
                  </div>
                  <label className="required-switch">
                    <input type="checkbox" checked={Boolean(templatePostProcessing.extract_action_items)} onChange={(event) => updatePostProcessing("extract_action_items", event.target.checked)} />
                    <span>
                      <SwitchTitle help={designerHelp.extractActionItems}>Extract action items</SwitchTitle>
                      <small>Populate the mobile actionItems array when tasks are explicit.</small>
                    </span>
                  </label>
                  <div className="field wide">
                    <FieldLabel help={designerHelp.structuredOutput}>Structured output JSON schema</FieldLabel>
                    <textarea
                      key={structuredOutputToText(templatePostProcessing.structured_output)}
                      defaultValue={structuredOutputToText(templatePostProcessing.structured_output)}
                      onBlur={(event) => {
                        try {
                          updatePostProcessing("structured_output", textToStructuredOutput(event.target.value));
                          setError("");
                        } catch {
                          setError("Structured output must be valid JSON.");
                          notify({ title: "Structured output was not updated", message: "Enter valid JSON or leave the field blank.", tone: "danger" });
                        }
                      }}
                    />
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
                <div className="sample-editor">
                  <FieldLabel help={designerHelp.yaml}>Template YAML</FieldLabel>
                  <textarea
                    className="yaml-route-editor"
                    value={variantForm.yamlContent}
                    onChange={(event) => {
                      updateVariantForm((current) => ({ ...current, yamlContent: event.target.value }));
                    }}
                    spellCheck={false}
                  />
                </div>
              )}
              {previewTab === "sample" && (
                <div className="sample-editor">
                  <FieldLabel help={designerHelp.sampleTranscript}>Sample transcript fixture</FieldLabel>
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

function SwitchTitle({ children, help }: { children: ReactNode; help: string }) {
  return <strong className="switch-title">{children}<InfoTip text={help} /></strong>;
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
