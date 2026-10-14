"use client";

// Fonts (PRD-004 K-006): for sans, serif and mono, one of the fonts Studio ships or the
// designer's own .woff2 file. A file is checked by its first bytes and its size before it joins
// the draft; it is kept with the draft's other files (IndexedDB) and the preview registers it
// through the FontFace API, as Studio does (useSkinFontFaces). A shipped font is stored by its
// key ("geist", "geist-mono", "newsreader") and shown by its name.

import { useId, useState } from "react";

import { checkFontFile, fontSizeProblem } from "@/lib/skins/assets";
import { FONT_SLOTS, SHIPPED_FONT_NAMES, SHIPPED_FONTS, type FontSlot } from "@/lib/skins/format";
import { setFont, type SkinDraft } from "@/lib/skins/model";
import { formatBytes } from "@/lib/skins/validate-files";

import type { EditDraft } from "./ColourRow";
import styles from "./assets.module.css";
import editorStyles from "./editor.module.css";
import { FileDrop } from "./FileDrop";
import { readDropped } from "./files";
import type { SkinAssetsApi } from "./useSkinAssets";

export const FONTS_HEADING = "Fonts";
export const STUDIO_DEFAULT_FONT = "Studio's default";
export const FONT_READ_FAILED = "That file couldn't be read. Try choosing it again.";

export const SLOT_LABELS: Readonly<Record<FontSlot, string>> = { sans: "Sans", serif: "Serif", mono: "Mono" };

const DEFAULT_VALUE = "";

function isShippedFont(value: string): boolean {
  return (SHIPPED_FONTS as readonly string[]).includes(value);
}

interface SlotProps {
  readonly slot: FontSlot;
  readonly value: string | undefined;
  readonly onEdit: EditDraft;
  readonly assets: SkinAssetsApi;
}

function FileNote({ value, assets }: Pick<SlotProps, "value" | "assets">) {
  if (value === undefined || isShippedFont(value)) return null;
  const asset = assets.assets.get(value);
  if (asset) {
    return (
      <p className={editorStyles.note}>
        Your file: {asset.name} ({formatBytes(asset.bytes.length)}), packed as {value}.
      </p>
    );
  }
  if (!assets.loaded) return null;
  return (
    <p className={editorStyles.note}>
      The file for {value} isn&apos;t in this browser any more. Choose it again, or pick another font.
    </p>
  );
}

function FontSlotPicker({ slot, value, onEdit, assets }: SlotProps) {
  const selectId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const label = SLOT_LABELS[slot];
  const filePath = value !== undefined && !isShippedFont(value) ? value : null;

  const pick = (chosen: string) => {
    setProblem(null);
    onEdit((current: SkinDraft) => setFont(current, slot, chosen === DEFAULT_VALUE ? null : chosen));
  };

  const takeFiles = (files: readonly File[]) => {
    const [file] = files;
    if (file === undefined) return;
    const tooBig = fontSizeProblem(file.name, file.size);
    if (tooBig !== null) {
      setProblem(tooBig);
      return;
    }
    readDropped([file])
      .then(([dropped]) => {
        if (dropped === undefined) return;
        const check = checkFontFile(dropped, slot);
        if (!check.ok) {
          setProblem(check.message);
          return;
        }
        setProblem(null);
        onEdit((current: SkinDraft) => setFont(current, slot, check.asset.path));
        return assets.add([check.asset]);
      })
      .catch((error: unknown) => {
        console.error(`[skins] the ${slot} font file couldn't be read:`, error);
        setProblem(FONT_READ_FAILED);
      });
  };

  return (
    <div className={styles.slot} role="group" aria-label={`${label} font`}>
      <label className={styles.selectField} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value ?? DEFAULT_VALUE}
        onChange={(event) => pick(event.target.value)}
      >
        <option value={DEFAULT_VALUE}>{STUDIO_DEFAULT_FONT}</option>
        {SHIPPED_FONTS.map((font) => (
          <option key={font} value={font}>
            {SHIPPED_FONT_NAMES[font]}
          </option>
        ))}
        {filePath !== null && <option value={filePath}>{assets.assets.get(filePath)?.name ?? filePath}</option>}
      </select>
      <FileNote value={value} assets={assets} />
      <FileDrop
        label={`Choose a .woff2 file for ${label}`}
        hint="Or drop a .woff2 file here (at most 400 KB)."
        accept=".woff2,font/woff2"
        onFiles={takeFiles}
        onFailed={setProblem}
      />
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

export interface FontPickersProps {
  readonly draft: SkinDraft;
  readonly onEdit: EditDraft;
  readonly assets: SkinAssetsApi;
}

export function FontPickers({ draft, onEdit, assets }: FontPickersProps) {
  const headingId = useId();
  return (
    <section className={editorStyles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={editorStyles.sectionTitle}>
        {FONTS_HEADING}
      </h2>
      <p className={editorStyles.note}>Pick one of the fonts Studio ships, or use your own .woff2 file.</p>
      <div className={styles.slots}>
        {FONT_SLOTS.map((slot) => (
          <FontSlotPicker key={slot} slot={slot} value={draft.fonts[slot]} onEdit={onEdit} assets={assets} />
        ))}
      </div>
    </section>
  );
}
