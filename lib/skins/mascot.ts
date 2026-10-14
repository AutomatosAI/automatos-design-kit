import { LIGHTS } from "../looks/catalogue";
import { MASCOT_LIGHTS, MASCOT_SHELLS, type MascotLight, type MascotMode, type MascotShell, type SkinMascot } from "./format";
import { oneOf } from "./validate-common";

// The editor's mascot choices (PRD-004 K-006): Off, Auto (his shell tint and light colour from
// the Looks catalogue), or Custom (the skin's own 12-state set). A skin stores both as catalogue
// keys, as Studio's S-001 does (mascot.shell bronze/gold/silver/cobalt, mascot.light
// mint/amber/ice/rose). Pure; relative imports only.

export const MASCOT_MODE_LABELS: Readonly<Record<MascotMode, string>> = {
  off: "Off",
  auto: "Auto",
  custom: "Custom",
};

export const DEFAULT_SHELL: MascotShell = "bronze";
export const DEFAULT_LIGHT: MascotLight = "mint";

export interface LightSwatch {
  /** The key the skin stores in mascot.light. */
  readonly key: MascotLight;
  readonly name: string;
  readonly hex: string;
}

/** Auto's four lights, in the format's order, with the catalogue's names and colours. */
export const LIGHT_SWATCHES: readonly LightSwatch[] = MASCOT_LIGHTS.map((key) => ({
  key,
  name: LIGHTS[key].name,
  hex: LIGHTS[key].hex,
}));

/** The light a stored value names, or null when it isn't one of Auto's four. */
export function lightKeyOf(light: unknown): MascotLight | null {
  return oneOf(MASCOT_LIGHTS, light) ? light : null;
}

/** The shell a mascot uses: its own when it's one of Auto's tints, else the default. */
export function shellOf(mascot: SkinMascot): MascotShell {
  return oneOf(MASCOT_SHELLS, mascot.shell) ? mascot.shell : DEFAULT_SHELL;
}

/**
 * The mascot for a new mode. Off holds nothing else; Auto keeps (or gets) a shell tint and a
 * light; Custom keeps (or gets) a light for the ring the page draws, and drops the shell tint,
 * which only Auto's own clips wear.
 */
export function withMascotMode(mascot: SkinMascot, mode: MascotMode): SkinMascot {
  const light = mascot.light ?? DEFAULT_LIGHT;
  if (mode === "off") return { mode };
  if (mode === "custom") return { mode, light };
  return { mode, shell: shellOf(mascot), light };
}

export function withShell(mascot: SkinMascot, shell: MascotShell): SkinMascot {
  return { ...mascot, shell };
}

export function withLight(mascot: SkinMascot, light: MascotLight): SkinMascot {
  return { ...mascot, light };
}
