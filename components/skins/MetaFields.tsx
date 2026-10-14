"use client";

// The skin's details: name, slug, author, version, licence and description, the base it builds
// on, and the tones it keeps. Typing in one field is one undo step until the field loses focus.
// The last tone can't be dropped: a skin keeps at least one.

import { useId } from "react";

import { AUTHOR_MAX, BASES, DESCRIPTION_MAX, LICENCE_MAX, NAME_MAX, SLUG_MAX, TONES, VERSION_MAX } from "@/lib/skins/format";
import { setBase, setMeta, setTones, type SkinDraft, type SkinMeta } from "@/lib/skins/model";

import { BASE_LABELS, TONE_LABELS, type EditDraft } from "./ColourRow";
import styles from "./editor.module.css";

export const DETAILS_HEADING = "Details";

type LineKey = Exclude<keyof SkinMeta, "description">;

interface LineField {
  readonly key: LineKey;
  readonly label: string;
  readonly max: number;
}

const LINE_FIELDS: readonly LineField[] = [
  { key: "name", label: "Name", max: NAME_MAX },
  { key: "slug", label: "Slug (lowercase, dashes)", max: SLUG_MAX },
  { key: "author", label: "Author", max: AUTHOR_MAX },
  { key: "version", label: "Version (such as 1.0.0)", max: VERSION_MAX },
  { key: "licence", label: "Licence (optional)", max: LICENCE_MAX },
];

export interface MetaFieldsProps {
  readonly draft: SkinDraft;
  readonly onEdit: EditDraft;
  readonly onEndGroup: () => void;
}

function BaseAndTones({ draft, onEdit }: Pick<MetaFieldsProps, "draft" | "onEdit">) {
  const toggleTone = (tone: (typeof TONES)[number]) => {
    const kept = draft.tones.includes(tone) ? draft.tones.filter((entry) => entry !== tone) : [...draft.tones, tone];
    onEdit((current) => setTones(current, kept));
  };
  return (
    <div className={styles.pairs}>
      <div className={styles.choiceGroup} role="group" aria-label="Base">
        <span className={styles.choiceLabel}>Base</span>
        {BASES.map((base) => (
          <button
            key={base}
            type="button"
            className={styles.choice}
            aria-pressed={draft.base === base}
            onClick={() => onEdit((current) => setBase(current, base))}
          >
            {BASE_LABELS[base]}
          </button>
        ))}
      </div>
      <div className={styles.choiceGroup} role="group" aria-label="Tones">
        <span className={styles.choiceLabel}>Tones</span>
        {TONES.map((tone) => {
          const kept = draft.tones.includes(tone);
          return (
            <button
              key={tone}
              type="button"
              className={styles.choice}
              aria-pressed={kept}
              disabled={kept && draft.tones.length === 1}
              onClick={() => toggleTone(tone)}
            >
              {TONE_LABELS[tone]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MetaFields({ draft, onEdit, onEndGroup }: MetaFieldsProps) {
  const headingId = useId();
  const change = (key: keyof SkinMeta, value: string) =>
    onEdit((current) => setMeta(current, { ...current.meta, [key]: value }), `meta:${key}`);
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {DETAILS_HEADING}
      </h2>
      <div className={styles.fields}>
        {LINE_FIELDS.map((field) => (
          <label key={field.key} className={styles.field}>
            <span>{field.label}</span>
            <input
              className={styles.input}
              type="text"
              value={draft.meta[field.key]}
              maxLength={field.max}
              onChange={(event) => change(field.key, event.target.value)}
              onBlur={onEndGroup}
            />
          </label>
        ))}
      </div>
      <label className={styles.field}>
        <span>Description (optional)</span>
        <textarea
          className={styles.textarea}
          value={draft.meta.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => change("description", event.target.value)}
          onBlur={onEndGroup}
        />
      </label>
      <BaseAndTones draft={draft} onEdit={onEdit} />
    </section>
  );
}
