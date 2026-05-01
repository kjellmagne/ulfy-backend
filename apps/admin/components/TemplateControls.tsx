"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  AudioWaveform,
  BadgeCheck,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  ChartBar,
  ChartLine,
  CircleCheck,
  Clipboard,
  ClipboardList,
  Clock,
  Cross,
  Download,
  FileCheck2,
  FilePenLine,
  FilePlus2,
  FileText,
  Flag,
  Folder,
  HeartPulse,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  MessagesSquare,
  Mic,
  NotebookText,
  Phone,
  Quote,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Stethoscope,
  Tag,
  User,
  Users,
  Video,
  Volume2,
  WandSparkles,
  X,
  type LucideIcon
} from "lucide-react";
import { Modal } from "./AdminUI";

export type TemplateCategoryOption = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
};

export type TemplateSectionPresetOption = {
  id?: string;
  slug?: string;
  title: string;
  purpose: string;
  format: string;
  required: boolean;
  extractionHints?: string[];
  extraction_hints?: string[];
  sortOrder?: number;
};

export type TemplateTagOption = {
  id: string;
  slug: string;
  name: string;
  color: string;
  description?: string | null;
};

export const languageOptions = [
  { code: "nb-NO", name: "Norwegian Bokmal" },
  { code: "nn-NO", name: "Norwegian Nynorsk" },
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "sv-SE", name: "Swedish" },
  { code: "da-DK", name: "Danish" },
  { code: "fi-FI", name: "Finnish" },
  { code: "de-DE", name: "German" },
  { code: "fr-FR", name: "French" },
  { code: "es-ES", name: "Spanish" },
  { code: "it-IT", name: "Italian" },
  { code: "nl-NL", name: "Dutch" },
  { code: "pt-PT", name: "Portuguese" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "pl-PL", name: "Polish" },
  { code: "lt-LT", name: "Lithuanian" },
  { code: "uk-UA", name: "Ukrainian" },
  { code: "ja-JP", name: "Japanese" }
];

export const sfSymbolOptions = [
  "doc.text",
  "doc.text.fill",
  "text.badge.checkmark",
  "text.badge.plus",
  "text.quote",
  "note.text",
  "list.bullet.clipboard",
  "clipboard",
  "clipboard.fill",
  "checklist",
  "checkmark.circle",
  "checkmark.seal",
  "person",
  "person.fill",
  "person.text.rectangle",
  "person.2",
  "person.2.fill",
  "person.3",
  "person.3.fill",
  "person.3.sequence.fill",
  "building.2",
  "building.2.fill",
  "briefcase",
  "briefcase.fill",
  "stethoscope",
  "heart.text.square",
  "cross.case",
  "waveform",
  "waveform.and.mic",
  "mic",
  "mic.fill",
  "speaker.wave.2",
  "bubble.left.and.bubble.right",
  "message",
  "phone",
  "video",
  "calendar",
  "clock",
  "arrow.triangle.2.circlepath",
  "arrow.clockwise",
  "tray.and.arrow.down",
  "folder",
  "folder.fill",
  "tag",
  "tag.fill",
  "flag",
  "shield",
  "shield.checkered",
  "lock.shield",
  "gearshape",
  "wand.and.stars",
  "sparkles",
  "brain.head.profile",
  "chart.bar",
  "chart.line.uptrend.xyaxis",
  "doc.richtext",
  "rectangle.and.pencil.and.ellipsis",
  "square.and.pencil",
  "magnifyingglass"
];

const sfToLucideIcon: Record<string, LucideIcon> = {
  "doc.text": FileText,
  "doc.text.fill": FileText,
  "text.badge.checkmark": FileCheck2,
  "text.badge.plus": FilePlus2,
  "text.quote": Quote,
  "note.text": NotebookText,
  "list.bullet.clipboard": ClipboardList,
  "clipboard": Clipboard,
  "clipboard.fill": Clipboard,
  "checklist": ListChecks,
  "checkmark.circle": CircleCheck,
  "checkmark.seal": BadgeCheck,
  "person": User,
  "person.fill": User,
  "person.text.rectangle": User,
  "person.2": Users,
  "person.2.fill": Users,
  "person.3": Users,
  "person.3.fill": Users,
  "person.3.sequence.fill": Users,
  "building.2": Building2,
  "building.2.fill": Building2,
  "briefcase": Briefcase,
  "briefcase.fill": Briefcase,
  "stethoscope": Stethoscope,
  "heart.text.square": HeartPulse,
  "cross.case": Cross,
  "waveform": AudioWaveform,
  "waveform.and.mic": Mic,
  "mic": Mic,
  "mic.fill": Mic,
  "speaker.wave.2": Volume2,
  "bubble.left.and.bubble.right": MessagesSquare,
  "message": MessageSquare,
  "phone": Phone,
  "video": Video,
  "calendar": Calendar,
  "clock": Clock,
  "arrow.triangle.2.circlepath": RefreshCw,
  "arrow.clockwise": RotateCw,
  "tray.and.arrow.down": Download,
  "folder": Folder,
  "folder.fill": Folder,
  "tag": Tag,
  "tag.fill": Tag,
  "flag": Flag,
  "shield": Shield,
  "shield.checkered": ShieldCheck,
  "lock.shield": LockKeyhole,
  "gearshape": Settings,
  "wand.and.stars": WandSparkles,
  "sparkles": Sparkles,
  "brain.head.profile": Brain,
  "chart.bar": ChartBar,
  "chart.line.uptrend.xyaxis": ChartLine,
  "doc.richtext": FileText,
  "rectangle.and.pencil.and.ellipsis": FilePenLine,
  "square.and.pencil": SquarePen,
  "magnifyingglass": Search
};

export function TemplateIcon({ symbol, size = 18 }: { symbol?: string | null; size?: number }) {
  const Icon = sfToLucideIcon[symbol || ""] ?? FileText;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" />;
}

function languageLabel(code: string) {
  const language = languageOptions.find((option) => option.code === code);
  return language ? `${language.name} (${language.code})` : code || "";
}

export function LanguageCombobox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = languageLabel(value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLanguages = useMemo(() => {
    if (!normalizedQuery) return languageOptions;
    return languageOptions.filter((language) =>
      language.name.toLowerCase().includes(normalizedQuery) ||
      language.code.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  function selectLanguage(code: string) {
    onChange(code);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const exactMatch = languageOptions.find((language) =>
      language.code.toLowerCase() === normalizedQuery ||
      language.name.toLowerCase() === normalizedQuery
    );
    const nextLanguage = exactMatch ?? filteredLanguages[0];
    if (nextLanguage) selectLanguage(nextLanguage.code);
  }

  return (
    <div
      className="language-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <label className={`language-combobox-input${open ? " open" : ""}`}>
        <Search size={14} />
        <input
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search language"
        />
        <span>{value || "-"}</span>
      </label>
      {open && (
        <div className="language-menu" role="listbox" aria-label="Template languages">
          {filteredLanguages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="option"
              aria-selected={language.code === value}
              className={language.code === value ? "selected" : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                selectLanguage(language.code);
              }}
            >
              <strong>{language.name}</strong>
              <span>{language.code}</span>
            </button>
          ))}
          {!filteredLanguages.length && <div className="language-menu-empty">No matching languages.</div>}
        </div>
      )}
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filteredSymbols = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sfSymbolOptions;
    return sfSymbolOptions.filter((symbol) => symbol.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <div className="icon-picker">
      <button type="button" className="sf-symbol-tile icon-picker-trigger" onClick={() => setOpen(true)} aria-label="Choose template icon" title="Choose template icon">
        <TemplateIcon symbol={value || "doc.text"} />
      </button>

      <Modal
        open={open}
        title="Choose template icon"
        description="Pick the visual icon used in the admin. The stored template value remains compatible with the iOS app."
        onClose={() => setOpen(false)}
        wide
      >
        <div className="icon-picker-dialog">
          <label className="icon-search">
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons" autoFocus />
          </label>
          <div className="icon-picker-grid icon-picker-grid-icons" role="listbox" aria-label="Template icons">
            {filteredSymbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className={symbol === value ? "selected" : undefined}
                onClick={() => {
                  onChange(symbol);
                  setOpen(false);
                }}
                title={symbol}
                aria-label={`Use ${symbol}`}
                aria-selected={symbol === value}
              >
                <TemplateIcon symbol={symbol} size={21} />
              </button>
            ))}
          </div>
          {!filteredSymbols.length && <div className="model-menu-empty">No matching icons.</div>}
        </div>
      </Modal>
    </div>
  );
}

export function TagEditor({
  value,
  options,
  onChange,
  onCreateTag,
  placeholder = "Add tags"
}: {
  value: string[];
  options: TemplateTagOption[];
  onChange: (nextTags: string[]) => void;
  onCreateTag?: (name: string) => Promise<TemplateTagOption | null>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionTags = normalizeTagOptions(options);
  const normalizedValue = uniqueTagSlugs(value);
  const query = normalizeTag(draft);
  const querySlug = tagSlug(query);
  const selectedLookup = new Set(normalizedValue);
  const optionBySlug = new Map(optionTags.map((tag) => [tag.slug, tag]));
  const availableOptions = optionTags.filter((tag) => !selectedLookup.has(tag.slug));
  const matchingOptions = query
    ? availableOptions.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()) || tag.slug.includes(querySlug))
    : availableOptions;
  const exactOption = optionTags.find((tag) => tag.slug === querySlug || tag.name.toLowerCase() === query.toLowerCase());
  const canCreate = Boolean(query && querySlug && !selectedLookup.has(querySlug) && !exactOption);
  const menuItems = [
    ...(canCreate ? [{ kind: "create" as const, value: query, label: `Create "${query}"` }] : []),
    ...matchingOptions.slice(0, 10).map((tag) => ({ kind: "option" as const, value: tag.slug, label: tag.name, tag }))
  ];

  async function addTag(tag: string, createIfMissing = false) {
    let option = optionBySlug.get(tagSlug(tag)) ?? optionTags.find((item) => item.name.toLowerCase() === normalizeTag(tag).toLowerCase());
    if (!option && createIfMissing && onCreateTag) {
      const created = await onCreateTag(normalizeTag(tag));
      if (!created) {
        setDraft("");
        setOpen(false);
        return;
      }
      option = created;
    }
    const slug = option?.slug ?? tagSlug(tag);
    if (!slug || normalizedValue.includes(slug)) {
      setDraft("");
      setOpen(false);
      return;
    }
    onChange([...normalizedValue, slug]);
    setDraft("");
    setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(normalizedValue.filter((item) => item !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !draft && normalizedValue.length) {
      event.preventDefault();
      removeTag(normalizedValue[normalizedValue.length - 1]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(menuItems.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const selectedItem = open ? menuItems[activeIndex] : undefined;
      void addTag(selectedItem?.value ?? draft, selectedItem?.kind === "create" || !selectedItem);
    }
  }

  return (
    <div
      className="tag-editor"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className={`tag-combobox${open ? " open" : ""}`} onClick={() => setOpen(true)}>
        {normalizedValue.map((slug) => {
          const tag = optionBySlug.get(slug);
          if (!tag) return null;
          return (
          <button key={slug} type="button" className="tag-badge catalog-tag-chip" style={tagStyle(tag.color)} onClick={() => removeTag(slug)} title={tag.description ? `${tag.name}: ${tag.description}` : `Remove ${tag.name}`}>
            <span>{tag.name}</span>
            <X className="tag-remove-icon" size={12} />
          </button>
          );
        })}
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={normalizedValue.length ? "" : placeholder}
        />
      </div>
      {open && (menuItems.length || draft.trim()) ? (
        <div className="tag-menu" role="listbox" aria-label="Tag suggestions">
          {menuItems.map((item, index) => (
            <button
              key={`${item.kind}-${item.value}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                void addTag(item.value, item.kind === "create");
              }}
            >
              <span className="tag-menu-label">
                {item.kind === "option" && <span className="tag-color-dot" style={tagStyle(item.tag.color)} />}
                <span>{item.label}</span>
              </span>
              <small>{item.kind === "create" ? "New tag" : "Catalog"}</small>
            </button>
          ))}
          {!menuItems.length && <div className="tag-menu-empty">No matches</div>}
        </div>
      ) : null}
    </div>
  );
}

export function TagChipList({ tags, options }: { tags: string[]; options: TemplateTagOption[] }) {
  const optionTags = normalizeTagOptions(options);
  const optionBySlug = new Map(optionTags.map((tag) => [tag.slug, tag]));
  const values = uniqueTagSlugs(tags);
  if (!values.length) return null;
  return (
    <div className="template-family-tags">
      {values.map((slug) => {
        const tag = optionBySlug.get(slug);
        if (!tag) return null;
        return (
          <span key={slug} className="catalog-tag-chip" style={tagStyle(tag.color)} title={tag.description ? `${tag.name}: ${tag.description}` : tag.name}>
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}

export function categorySlugFromId(categories: TemplateCategoryOption[], categoryId?: string | null) {
  return categories.find((category) => category.id === categoryId)?.slug ?? "";
}

export function categoryIdFromSlug(categories: TemplateCategoryOption[], slug?: string | null) {
  return categories.find((category) => category.slug === slug)?.id ?? "";
}

export function presetToTemplateSection(preset: TemplateSectionPresetOption) {
  return {
    title: preset.title,
    purpose: preset.purpose,
    format: preset.format,
    required: preset.required,
    extraction_hints: preset.extraction_hints ?? preset.extractionHints ?? []
  };
}

type TemplateSectionLike = {
  title: string;
  purpose: string;
  extraction_hints?: string[];
  extractionHints?: string[];
};

const localizedSectionCopy: Record<string, Record<string, { title: string; purpose: string; extraction_hints: string[] }>> = {
  nb: {
    summary: {
      title: "Sammendrag",
      purpose: "Oppsummer hovedinnholdet kort og tydelig.",
      extraction_hints: ["hovedtema", "viktig kontekst", "resultat"]
    },
    decisions: {
      title: "Beslutninger",
      purpose: "List opp beslutninger som ble tatt, med begrunnelse der det er relevant.",
      extraction_hints: ["beslutning", "ansvarlig", "begrunnelse"]
    },
    "action items": {
      title: "Oppfølgingspunkter",
      purpose: "List opp konkrete tiltak, ansvarlige og frister når dette finnes.",
      extraction_hints: ["tiltak", "ansvarlig", "frist"]
    },
    actions: {
      title: "Oppfølgingspunkter",
      purpose: "List opp konkrete tiltak, ansvarlige og frister når dette finnes.",
      extraction_hints: ["tiltak", "ansvarlig", "frist"]
    },
    "open questions": {
      title: "Åpne spørsmål",
      purpose: "Fang opp uavklarte spørsmål eller temaer som trenger avklaring.",
      extraction_hints: ["spørsmål", "manglende informasjon", "neste steg"]
    },
    risks: {
      title: "Risikoer",
      purpose: "Fang opp risikoer, hindringer, usikkerhet eller sensitive forhold som ble nevnt.",
      extraction_hints: ["risiko", "hindring", "avhengighet"]
    },
    "risks and concerns": {
      title: "Risikoer og bekymringer",
      purpose: "Fremhev risikoer, bekymringer eller hindringer som ble nevnt.",
      extraction_hints: ["risiko", "konsekvens", "tiltak"]
    },
    "follow-up plan": {
      title: "Oppfølgingsplan",
      purpose: "Beskriv anbefalte neste steg basert kun på transkripsjonen.",
      extraction_hints: ["neste steg", "prioritet", "ansvarlig"]
    }
  },
  nn: {
    summary: {
      title: "Samandrag",
      purpose: "Oppsummer hovudinnhaldet kort og tydeleg.",
      extraction_hints: ["hovudtema", "viktig kontekst", "resultat"]
    },
    decisions: {
      title: "Avgjerder",
      purpose: "List opp avgjerder som vart tekne, med grunngjeving der det er relevant.",
      extraction_hints: ["avgjerd", "ansvarleg", "grunngjeving"]
    },
    "action items": {
      title: "Oppfølgingspunkt",
      purpose: "List opp konkrete tiltak, ansvarlege og fristar når dette finst.",
      extraction_hints: ["tiltak", "ansvarleg", "frist"]
    },
    actions: {
      title: "Oppfølgingspunkt",
      purpose: "List opp konkrete tiltak, ansvarlege og fristar når dette finst.",
      extraction_hints: ["tiltak", "ansvarleg", "frist"]
    },
    "open questions": {
      title: "Opne spørsmål",
      purpose: "Fang opp uavklarte spørsmål eller tema som treng avklaring.",
      extraction_hints: ["spørsmål", "manglande informasjon", "neste steg"]
    },
    risks: {
      title: "Risikoar",
      purpose: "Fang opp risikoar, hindringar, uvisse eller sensitive forhold som vart nemnde.",
      extraction_hints: ["risiko", "hindring", "avhengnad"]
    },
    "risks and concerns": {
      title: "Risikoar og bekymringar",
      purpose: "Framhev risikoar, bekymringar eller hindringar som vart nemnde.",
      extraction_hints: ["risiko", "konsekvens", "tiltak"]
    },
    "follow-up plan": {
      title: "Oppfølgingsplan",
      purpose: "Beskriv tilrådde neste steg basert berre på transkripsjonen.",
      extraction_hints: ["neste steg", "prioritet", "ansvarleg"]
    }
  }
};

function sectionLanguageFamily(languageCode: string) {
  const normalized = languageCode.toLowerCase();
  if (normalized.startsWith("nb")) return "nb";
  if (normalized.startsWith("nn")) return "nn";
  return "";
}

export function localizeTemplateSectionPreset<T extends TemplateSectionLike>(preset: T, languageCode: string): T {
  const family = sectionLanguageFamily(languageCode);
  const localized = localizedSectionCopy[family]?.[preset.title.trim().toLowerCase()];
  if (!localized) return preset;
  return {
    ...preset,
    title: localized.title,
    purpose: localized.purpose,
    extraction_hints: localized.extraction_hints,
    ...(preset.extractionHints ? { extractionHints: localized.extraction_hints } : {})
  };
}

export function localizeTemplateSectionPresets<T extends TemplateSectionLike>(presets: T[], languageCode: string): T[] {
  return presets.map((preset) => localizeTemplateSectionPreset(preset, languageCode));
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, " ");
}

function tagSlug(tag: string) {
  return normalizeTag(tag).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueTagSlugs(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const slug = tagSlug(tag);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push(slug);
  }
  return result;
}

function normalizeTagOptions(options: TemplateTagOption[]) {
  const seen = new Set<string>();
  const tags: TemplateTagOption[] = [];
  for (const option of options) {
    const tag = {
      ...option,
      slug: tagSlug(option.slug || option.name),
      name: normalizeTag(option.name || option.slug),
      color: option.color || "#64748b"
    };
    if (!tag.slug || seen.has(tag.slug)) continue;
    seen.add(tag.slug);
    tags.push(tag);
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

function tagStyle(color: string) {
  return { "--tag-color": color } as CSSProperties;
}
