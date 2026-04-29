"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { FieldLabel } from "./AdminUI";

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

export function IconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const filteredSymbols = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sfSymbolOptions;
    return sfSymbolOptions.filter((symbol) => symbol.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <div className="icon-picker">
      <div className="icon-picker-current">
        <span className="sf-symbol-tile" aria-hidden="true">SF</span>
        <div>
          <FieldLabel>SF Symbol</FieldLabel>
          <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder="doc.text" />
        </div>
      </div>
      <label className="icon-search">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SF Symbols" />
      </label>
      <div className="icon-picker-grid" role="listbox" aria-label="SF Symbols">
        {filteredSymbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={symbol === value ? "selected" : undefined}
            onClick={() => onChange(symbol)}
            title={symbol}
          >
            <span className="sf-symbol-tile" aria-hidden="true">SF</span>
            <span>{symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TagEditor({
  value,
  options,
  onChange,
  placeholder = "Add or create tag"
}: {
  value: string[];
  options: string[];
  onChange: (nextTags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const normalizedValue = value.map((tag) => tag.trim()).filter(Boolean);
  const suggestions = options.filter((tag) => !normalizedValue.includes(tag));

  function addTag(tag: string) {
    const normalized = tag.trim();
    if (!normalized || normalizedValue.includes(normalized)) {
      setDraft("");
      return;
    }
    onChange([...normalizedValue, normalized]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(normalizedValue.filter((item) => item !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addTag(draft);
  }

  return (
    <div className="tag-editor">
      <div className="tag-badges">
        {normalizedValue.map((tag) => (
          <button key={tag} type="button" className="tag-badge" onClick={() => removeTag(tag)} title={`Remove ${tag}`}>
            {tag}
            <X size={12} />
          </button>
        ))}
        {!normalizedValue.length && <span className="muted">No tags yet.</span>}
      </div>
      <div className="tag-input-row">
        <input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} />
        <button type="button" className="icon-action" onClick={() => addTag(draft)} title="Add tag" aria-label="Add tag">
          <Plus size={14} />
        </button>
      </div>
      {suggestions.length ? (
        <div className="tag-suggestions">
          {suggestions.slice(0, 12).map((tag) => (
            <button key={tag} type="button" onClick={() => addTag(tag)}>{tag}</button>
          ))}
        </div>
      ) : null}
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
