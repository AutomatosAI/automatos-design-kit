import { LIGHTS, LIGHT_KEYS, SHELLS, isKeyOf, type LightKey, type ShellKey } from "../looks/catalogue";
import { normaliseColour } from "./colour";
import type { MascotMode, SkinMascot } from "./format";

// The editor's mascot choices (PRD-004 K-006): Off, Auto (his shell tint and light colour from
// the Looks catalogue), or Custom (the skin's own 12-state set). Pure; relative imports only.

export const MASCOT_MODE_LABELS: Readonly<Record<MascotMode, string>> = {
  off: "Off",
  auto: "Auto",
  custom: "Custom",
};

export const DEFAULT_SHELL: ShellKey = "bronze";
export const DEFAULT_LIGHT: LightKey = "mint";

export interface LightSwatch {
  readonly key: LightKey;
  readonly name: string;
  readonly hex: string;
  /** The HSL triplet the skin stores in mascot.light. */
  readonly triplet: string;
}

/** Auto's four lights as the colours a skin can store. */
export const LIGHT_SWATCHES: readonly LightSwatch[] = LIGHT_KEYS.flatMap((key) => {
  const triplet = normaliseColour(LIGHTS[key].hex);
  return triplet === null ? [] : [{ key, name: LIGHTS[key].name, hex: LIGHTS[key].hex, triplet }];
});

function defaultLightTriplet(): string {
  return LIGHT_SWATCHES.find((swatch) => swatch.key === DEFAULT_LIGHT)?.triplet ?? "";
}

/** Which of Auto's lights a stored colour is, or null for a colour of the skin's own. */
export function lightKeyOf(light: string | undefined): LightKey | null {
  return LIGHT_SWATCHES.find((swatch) => swatch.triplet === light)?.key ?? null;
}

/** The shell a mascot uses: its own when it's one of Auto's tints, else the default. */
export function shellOf(mascot: SkinMascot): ShellKey {
  return isKeyOf(SHELLS, mascot.shell) ? mascot.shell : DEFAULT_SHELL;
}

/**
 * The mascot for a new mode. Off holds nothing else; Auto keeps (or gets) a shell tint and a
 * light; Custom keeps (or gets) a light for the ring the page draws, and drops the shell tint,
 * which only Auto's own clips wear.
 */
export function withMascotMode(mascot: SkinMascot, mode: MascotMode): SkinMascot {
  const light = mascot.light ?? defaultLightTriplet();
  if (mode === "off") return { mode };
  if (mode === "custom") return { mode, light };
  return { mode, shell: shellOf(mascot), light };
}

export function withShell(mascot: SkinMascot, shell: ShellKey): SkinMascot {
  return { ...mascot, shell };
}

export function withLight(mascot: SkinMascot, light: LightKey): SkinMascot {
  const triplet = LIGHT_SWATCHES.find((swatch) => swatch.key === light)?.triplet;
  return triplet === undefined ? mascot : { ...mascot, light: triplet };
}
