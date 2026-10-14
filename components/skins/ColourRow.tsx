"use client";

// One token in the editor: a column per tone the skin keeps (a dropped tone has none), each with
// the colour, where it comes from, and a contrast badge for every pair the token is one side of.
// A badge says its verdict in a glyph and in words beside the ratio, never in colour alone; a
// failing pair offers a readable text colour (lib/skins/suggest.ts).

import { useId } from "react";

import { colourStyle } from "@/components/looks/swatchStyle";
import type { DraftChange } from "@/lib/skins/editor-state";
import { formatRatio, tripletToHex } from "@/lib/skins/colour";
import type { SkinBase, Tone, TokenName, TokenValues } from "@/lib/skins/format";
import { clearToken, setToken, type SkinDraft } from "@/lib/skins/model";
import type { PairCheck } from "@/lib/skins/suggest";

import { ColourField } from "./ColourField";
import styles from "./colours.module.css";

export const TONE_LABELS: Readonly<Record<Tone, string>> = { light: "Light", dark: "Dark" };
export const BASE_LABELS: Readonly<Record<SkinBase, string>> = { studio: "Studio", classic: "Classic" };
export const USE_SUGGESTION = "Use suggestion";
export const USE_BASE = "Use base colour";

/** Where an unset colour's picker starts: black. */
const PICKER_FALLBACK = "0 0% 0%";

export type EditDraft = (change: DraftChange, group?: string) => void;

interface BadgeProps {
  readonly check: PairCheck;
  readonly tone: Tone;
  readonly onEdit: EditDraft;
}

function ContrastBadge({ check, tone, onEdit }: BadgeProps) {
  const { pair, ratio, passes, suggestion } = check;
  return (
    <li className={styles.badge}>
      <span className={passes ? styles.pass : styles.fail} aria-hidden="true">
        {passes ? "✓" : "✗"}
      </span>
      <span className={styles.ratio}>{formatRatio(ratio)}</span>
      <span className={styles.verdict}>{passes ? "AA pass" : "AA fail"}</span>
      <span className={styles.pair}>
        {pair.text} on {pair.on}
      </span>
      {suggestion !== null && (
        <button
          type="button"
          className={styles.suggest}
          style={colourStyle(tripletToHex(suggestion))}
          aria-label={`${USE_SUGGESTION} for ${pair.text}, ${TONE_LABELS[tone]}: ${suggestion}`}
          onClick={() => onEdit((draft) => setToken(draft, tone, pair.text, suggestion))}
        >
          <span className={styles.suggestSwatch} aria-hidden="true" />
          {USE_SUGGESTION}
        </button>
      )}
    </li>
  );
}

interface ToneCellProps {
  readonly name: TokenName;
  readonly tone: Tone;
  readonly draft: SkinDraft;
  readonly palette: TokenValues;
  readonly checks: readonly PairCheck[];
  readonly onEdit: EditDraft;
  readonly onEndGroup: () => void;
}

function ToneCell({ name, tone, draft, palette, checks, onEdit, onEndGroup }: ToneCellProps) {
  const label = `${name}, ${TONE_LABELS[tone]}`;
  const own = draft.tokens[tone][name] !== undefined;
  const value = palette[name] ?? null;
  const badges = checks.filter((check) => check.pair.text === name || check.pair.on === name);
  const set = (colour: string) => (current: SkinDraft) => setToken(current, tone, name, colour);
  const source = own ? "Set by this skin" : value === null ? "Not set" : `From ${BASE_LABELS[draft.base]}`;
  return (
    <div className={styles.tone} role="group" aria-label={label}>
      <p className={styles.toneLabel}>{TONE_LABELS[tone]}</p>
      <ColourField
        label={label}
        value={value}
        pickerStart={palette.foreground ?? PICKER_FALLBACK}
        onPick={(colour) => onEdit(set(colour), `pick:${tone}:${name}`)}
        onType={(colour) => onEdit(set(colour))}
        onDone={onEndGroup}
      />
      <div className={styles.source}>
        <span>{source}</span>
        {own && (
          <button
            type="button"
            className={styles.useBase}
            aria-label={`${USE_BASE} for ${label}`}
            onClick={() => onEdit((current) => clearToken(current, tone, name))}
          >
            {USE_BASE}
          </button>
        )}
      </div>
      {badges.length > 0 && (
        <ul className={styles.badges} aria-label={`Contrast, ${label}`}>
          {badges.map((check) => (
            <ContrastBadge key={`${check.pair.text}/${check.pair.on}`} check={check} tone={tone} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ColourRowProps {
  readonly name: TokenName;
  readonly draft: SkinDraft;
  readonly palettes: Readonly<Record<Tone, TokenValues>>;
  readonly checks: Readonly<Record<Tone, readonly PairCheck[]>>;
  readonly onEdit: EditDraft;
  readonly onEndGroup: () => void;
}

export function ColourRow({ name, draft, palettes, checks, onEdit, onEndGroup }: ColourRowProps) {
  const titleId = useId();
  return (
    <div className={styles.row} role="group" aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.rowTitle}>
        {name}
      </h3>
      <div className={styles.tones}>
        {draft.tones.map((tone) => (
          <ToneCell
            key={tone}
            name={name}
            tone={tone}
            draft={draft}
            palette={palettes[tone]}
            checks={checks[tone]}
            onEdit={onEdit}
            onEndGroup={onEndGroup}
          />
        ))}
      </div>
    </div>
  );
}
