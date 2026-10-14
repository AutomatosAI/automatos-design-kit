"use client";

// The mascot preview: the existing player (components/mascot/AutoMascot) with a state picker
// that plays each of the 12 states. Auto's own clips come from public/auto/ when they are
// there (git-ignored, so often not: then his stand-in shows); a custom set plays from the
// object URLs of the files dropped into the editor. The skin's shell tint and light colour
// reach the player as the custom properties its stylesheet already reads.

import { useCallback, useMemo, useState, type CSSProperties } from "react";

import { swatchStyle, type SwatchVars } from "@/components/looks/swatchStyle";
import { AutoMascot } from "@/components/mascot/AutoMascot";
import { LIGHTS, SHELLS } from "@/lib/looks/catalogue";
import { AUTO_SOURCE, type MascotSource } from "@/lib/mascot/media";
import { MASCOT_STATES, ONE_SHOTS, type MascotName } from "@/lib/mascot/types";
import { isMascotPath, mascotClipPath } from "@/lib/skins/assets";
import type { SkinMascot } from "@/lib/skins/format";
import { shellOf } from "@/lib/skins/mascot";

import styles from "./assets.module.css";
import editorStyles from "./editor.module.css";

export const STATE_PICKER_LABEL = "Mascot state";

export function stateLabel(state: MascotName): string {
  return `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
}

function customSource(urls: Readonly<Record<string, string>>): MascotSource {
  const url = (path: string): string | null => (Object.hasOwn(urls, path) ? (urls[path] ?? null) : null);
  return {
    poster: (state) => url(mascotClipPath(state, "png")),
    video: (state, format) => url(mascotClipPath(state, format)),
  };
}

/** The skin's light and Auto's shell tint (catalogue keys), as the player's own variables. */
function stageStyle(mascot: SkinMascot): CSSProperties {
  const shell = SHELLS[shellOf(mascot)];
  const vars: SwatchVars = {
    "--filter-shell": mascot.mode === "auto" ? shell.filter : "none",
    "--color-shell": shell.hex,
  };
  return swatchStyle(mascot.light === undefined ? vars : { ...vars, "--color-light": LIGHTS[mascot.light].hex });
}

export interface MascotStageProps {
  readonly mascot: SkinMascot;
  /** Object URLs of the draft's files, by package path. */
  readonly urls: Readonly<Record<string, string>>;
}

export function MascotStage({ mascot, urls }: MascotStageProps) {
  const [state, setState] = useState<MascotName>("idle");
  const custom = mascot.mode === "custom";
  const source = useMemo(() => (custom ? customSource(urls) : AUTO_SOURCE), [custom, urls]);
  // A new set of files is a new player: its probe and clip state start again.
  const playerKey = custom
    ? `custom:${Object.entries(urls)
        .filter(([path]) => isMascotPath(path))
        .map(([, url]) => url)
        .join("|")}`
    : "auto";
  const onClipEnded = useCallback((ended: MascotName) => {
    if (ONE_SHOTS.has(ended)) setState((current) => (current === ended ? "idle" : current));
  }, []);

  return (
    <div className={styles.stage}>
      <div className={styles.player} style={stageStyle(mascot)}>
        <AutoMascot key={playerKey} state={state} onClipEnded={onClipEnded} source={source} />
      </div>
      <div className={editorStyles.choiceGroup} role="group" aria-label={STATE_PICKER_LABEL}>
        {MASCOT_STATES.map((name) => (
          <button
            key={name}
            type="button"
            className={editorStyles.choice}
            aria-pressed={state === name}
            onClick={() => setState(name)}
          >
            {stateLabel(name)}
          </button>
        ))}
      </div>
    </div>
  );
}
