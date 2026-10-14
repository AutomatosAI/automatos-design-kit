"use client";

// The colours, one group at a time (Surfaces, Text, Brand, Status, Charts, Studio aliases): a
// row per token, a column per tone. The contrast of every pair is worked out once per tone from
// the resolved palette (the base with the skin's own colours over it), with the status the
// validator gives it: checked, incomplete or left to the base (decision K5).

import { useId, useMemo, useState } from "react";

import type { Tone, TokenValues } from "@/lib/skins/format";
import { COLOUR_GROUPS, FIRST_GROUP, groupById } from "@/lib/skins/groups";
import { resolvedTokens, type SkinDraft } from "@/lib/skins/model";
import { pairChecks, type PairCheck } from "@/lib/skins/suggest";

import { ColourRow, type EditDraft } from "./ColourRow";
import styles from "./colours.module.css";

export const COLOURS_HEADING = "Colours";

export interface ColourGroupsProps {
  readonly draft: SkinDraft;
  readonly onEdit: EditDraft;
  readonly onEndGroup: () => void;
}

export function ColourGroups({ draft, onEdit, onEndGroup }: ColourGroupsProps) {
  const headingId = useId();
  const [groupId, setGroupId] = useState(FIRST_GROUP.id);
  const group = groupById(groupId);

  const palettes = useMemo<Readonly<Record<Tone, TokenValues>>>(
    () => ({ light: resolvedTokens(draft, "light"), dark: resolvedTokens(draft, "dark") }),
    [draft],
  );
  const checks = useMemo<Readonly<Record<Tone, readonly PairCheck[]>>>(
    () => ({
      light: pairChecks(palettes.light, draft.tokens.light),
      dark: pairChecks(palettes.dark, draft.tokens.dark),
    }),
    [palettes, draft.tokens],
  );

  return (
    <section className={styles.colours} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {COLOURS_HEADING}
      </h2>
      <div className={styles.groupPicker} role="group" aria-label="Colour groups">
        {COLOUR_GROUPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={styles.groupButton}
            aria-pressed={entry.id === group.id}
            onClick={() => setGroupId(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className={styles.rows} role="region" aria-label={group.label}>
        {group.tokens.map((name) => (
          <ColourRow
            key={name}
            name={name}
            draft={draft}
            palettes={palettes}
            checks={checks}
            onEdit={onEdit}
            onEndGroup={onEndGroup}
          />
        ))}
      </div>
    </section>
  );
}
