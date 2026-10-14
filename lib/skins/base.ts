import { derivedAliases } from "./aliases";
import type { DerivedAlias, SkinBase, Tone, TokenValues } from "./format";

// Studio's own palettes, the ground every skin builds on. The four token blocks of the core's
// frontend/app/globals.css (:root, .dark, .studio, .studio.dark), copied as data, allowed token
// names only (--graph-canvas, the glass and gradient tunings and --cc-* aren't skin tokens).
//
// Source: automatos-ai frontend/app/globals.css at commit 81a726e08e7d7e4f686bdcc9252df23e480a1256
// (the file's last change; core main was at 6a58484202544a32811d4f8c72f2f351fabbe79d on
// 14 Oct 2026). When Studio changes these blocks, copy them again and update this line.
//
// globals.css writes border-2, navy and accent-2 as whole colours (hsl(40 30% 70%),
// hsl(15 76% 44% / 0.10)); here they are the triplets inside, and aliases.ts wraps them back
// the way Studio does. The derived aliases (paper, bg-1, bg-2, fg, fg-2, fg-3) are never data:
// baseAliases() computes them. Relative imports only (the CLI runs this under tsx).

/** Where these palettes were copied from. */
export const CORE_SOURCE = {
  repo: "automatos-ai",
  file: "frontend/app/globals.css",
  commit: "81a726e08e7d7e4f686bdcc9252df23e480a1256",
} as const;

/** Classic Light: the first `:root` block. */
const ROOT: TokenValues = {
  background: "0 0% 98%",
  foreground: "0 0% 10%",
  card: "0 0% 100%",
  "card-foreground": "0 0% 10%",
  popover: "0 0% 100%",
  "popover-foreground": "0 0% 10%",
  primary: "16 100% 50%",
  "primary-foreground": "0 0% 98%",
  secondary: "0 0% 94%",
  "secondary-foreground": "0 0% 12%",
  muted: "0 0% 93%",
  "muted-foreground": "0 0% 35%",
  accent: "16 100% 50%",
  "accent-foreground": "0 0% 98%",
  destructive: "0 84% 55%",
  "destructive-foreground": "0 0% 98%",
  border: "0 0% 75%",
  input: "0 0% 75%",
  ring: "16 100% 55%",
  success: "160 84% 39%",
  "success-foreground": "0 0% 98%",
  warning: "43 96% 56%",
  "warning-foreground": "0 0% 10%",
  info: "217 91% 60%",
  "info-foreground": "0 0% 98%",
  agent: "271 91% 65%",
  "agent-foreground": "0 0% 98%",
  "chart-1": "16 100% 55%",
  "chart-2": "217 91% 60%",
  "chart-3": "160 84% 39%",
  "chart-4": "271 91% 65%",
  "chart-5": "43 96% 56%",
  "stage-1": "187 100% 42%",
  "stage-2": "330 81% 71%",
  "stage-3": "43 96% 56%",
  "stage-4": "271 91% 65%",
  "stage-5": "160 84% 39%",
  "stage-6": "24 95% 53%",
  "stage-7": "217 91% 60%",
  "stage-8": "330 81% 60%",
  "stage-9": "160 84% 39%",
};

/** Classic Dark: `.dark`, over `:root` (it leaves the stage colours to `:root`). */
const DARK: TokenValues = {
  background: "0 0% 6%",
  foreground: "0 0% 98%",
  card: "0 0% 8%",
  "card-foreground": "0 0% 98%",
  popover: "0 0% 8%",
  "popover-foreground": "0 0% 98%",
  primary: "16 100% 60%",
  "primary-foreground": "0 0% 98%",
  secondary: "0 0% 12%",
  "secondary-foreground": "0 0% 98%",
  muted: "0 0% 12%",
  "muted-foreground": "0 0% 65%",
  accent: "16 100% 60%",
  "accent-foreground": "0 0% 98%",
  destructive: "0 84% 60%",
  "destructive-foreground": "0 0% 98%",
  border: "0 0% 15%",
  input: "0 0% 15%",
  ring: "16 100% 60%",
  success: "160 84% 39%",
  "success-foreground": "0 0% 98%",
  warning: "43 96% 56%",
  "warning-foreground": "0 0% 10%",
  info: "217 91% 60%",
  "info-foreground": "0 0% 98%",
  agent: "271 91% 65%",
  "agent-foreground": "0 0% 98%",
  "chart-1": "16 100% 60%",
  "chart-2": "217 91% 60%",
  "chart-3": "160 84% 39%",
  "chart-4": "271 91% 65%",
  "chart-5": "43 96% 56%",
};

/** Studio Light: `.studio`, over `:root`. */
const STUDIO: TokenValues = {
  background: "38 50% 92%",
  foreground: "30 12% 9%",
  card: "0 0% 100%",
  "card-foreground": "30 12% 9%",
  popover: "0 0% 100%",
  "popover-foreground": "30 12% 9%",
  primary: "30 12% 9%",
  "primary-foreground": "38 50% 96%",
  secondary: "38 40% 86%",
  "secondary-foreground": "36 12% 22%",
  muted: "40 30% 80%",
  "muted-foreground": "36 12% 36%",
  accent: "15 76% 44%",
  "accent-foreground": "38 50% 96%",
  destructive: "15 76% 44%",
  "destructive-foreground": "38 50% 96%",
  border: "40 30% 80%",
  input: "40 30% 80%",
  ring: "82 30% 33%",
  success: "82 30% 33%",
  "success-foreground": "38 50% 96%",
  warning: "47 73% 56%",
  "warning-foreground": "30 12% 9%",
  info: "213 51% 23%",
  "info-foreground": "38 50% 96%",
  agent: "213 51% 23%",
  "agent-foreground": "38 50% 96%",
  "chart-1": "15 76% 44%",
  "chart-2": "213 51% 23%",
  "chart-3": "82 30% 33%",
  "chart-4": "36 12% 36%",
  "chart-5": "47 73% 56%",
  "stage-1": "82 30% 33%",
  "stage-2": "213 51% 23%",
  "stage-3": "47 73% 56%",
  "stage-4": "36 12% 36%",
  "stage-5": "82 30% 33%",
  "stage-6": "15 76% 44%",
  "stage-7": "213 51% 23%",
  "stage-8": "36 12% 36%",
  "stage-9": "82 30% 33%",
  olive: "82 50% 22%",
  "warn-ink": "38 78% 27%",
  "on-strong": "0 0% 100%",
  "border-2": "40 30% 70%",
  "accent-2": "15 76% 44%",
  navy: "213 51% 23%",
};

/** Studio Dark: `.studio.dark`, over `:root`, `.dark` and `.studio`. */
const STUDIO_DARK: TokenValues = {
  background: "30 12% 9%",
  foreground: "38 40% 90%",
  card: "30 10% 12%",
  "card-foreground": "38 40% 90%",
  popover: "30 10% 12%",
  "popover-foreground": "38 40% 90%",
  primary: "38 40% 90%",
  "primary-foreground": "30 12% 9%",
  secondary: "30 10% 16%",
  "secondary-foreground": "38 30% 80%",
  muted: "30 8% 20%",
  "muted-foreground": "38 18% 62%",
  accent: "15 80% 56%",
  "accent-foreground": "30 12% 9%",
  destructive: "15 80% 56%",
  "destructive-foreground": "30 12% 9%",
  border: "30 10% 22%",
  input: "30 10% 22%",
  ring: "82 35% 52%",
  success: "82 35% 52%",
  "success-foreground": "30 12% 9%",
  warning: "47 70% 60%",
  "warning-foreground": "30 12% 9%",
  info: "213 55% 68%",
  "info-foreground": "30 12% 9%",
  agent: "213 55% 68%",
  "agent-foreground": "30 12% 9%",
  "chart-1": "15 80% 56%",
  "chart-2": "213 55% 68%",
  "chart-3": "82 35% 52%",
  "chart-4": "38 18% 62%",
  "chart-5": "47 70% 60%",
  "stage-1": "82 35% 52%",
  "stage-2": "213 55% 68%",
  "stage-3": "47 70% 60%",
  "stage-4": "38 18% 62%",
  "stage-5": "82 35% 52%",
  "stage-6": "15 80% 56%",
  "stage-7": "213 55% 68%",
  "stage-8": "38 18% 62%",
  "stage-9": "82 35% 52%",
  olive: "82 45% 58%",
  "warn-ink": "47 70% 60%",
  "on-strong": "30 12% 9%",
  "border-2": "30 10% 32%",
  "accent-2": "15 80% 56%",
  navy: "213 55% 68%",
};
/** The raw blocks, as globals.css declares them (each one only what it sets). */
export const STUDIO_BLOCKS = {
  root: ROOT,
  dark: DARK,
  studio: STUDIO,
  studioDark: STUDIO_DARK,
} as const;

/**
 * The blocks that apply, in cascade order: <html> carries `.studio` for the Studio base and
 * `.dark` for the dark tone, so later blocks win (`.studio` comes after `.dark` in the file and
 * `.studio.dark` outranks both by specificity).
 */
function cascade(base: SkinBase, tone: Tone): readonly TokenValues[] {
  const toneBlocks = tone === "dark" ? [DARK] : [];
  if (base === "classic") return [ROOT, ...toneBlocks];
  return [ROOT, ...toneBlocks, STUDIO, ...(tone === "dark" ? [STUDIO_DARK] : [])];
}

/** Every allowed token the base defines in this tone, as a browser resolves it. */
export function basePalette(base: SkinBase, tone: Tone): TokenValues {
  return cascade(base, tone).reduce<TokenValues>((palette, block) => ({ ...palette, ...block }), {});
}

/** The derived aliases of a base palette, computed the way Studio derives them for a skin. */
export function baseAliases(base: SkinBase, tone: Tone): Readonly<Partial<Record<DerivedAlias, string>>> {
  return derivedAliases(basePalette(base, tone));
}
