import { ringColour, ringTone, type RingTone } from "@/lib/mascot/ring";
import { MASCOT_STATES, type MascotName } from "@/lib/mascot/types";

import { ACCENTS, ERROR_COLOUR, GROUNDS, TYPE_STYLES } from "./catalogue";
import { AA_TEXT, contrastRatio, relativeLuminance } from "./contrast";
import { lookToCssVars, type CssVars } from "./css";
import type { Look } from "./types";

// The live style page (PRD-002 L-007), as data: every value is computed from the Look it is
// given, so the page redraws whenever the active Look changes. Pure. The page draws what this
// returns; layout follows the Ember style sheet (docs/design/ember/screens/ember-12, -13).

export interface ColourToken {
  /** A Look variable from lib/looks/css.ts. */
  readonly name: string;
  readonly role: string;
}

/** Every colour a Look sets, with what it is for. tests/looks/style.test.ts keeps it complete. */
export const COLOUR_TOKENS: readonly ColourToken[] = [
  { name: "--ground-bg", role: "page" },
  { name: "--ground-surface", role: "inputs, cards" },
  { name: "--ground-text", role: "text, the secondary button" },
  { name: "--ground-text-2", role: "secondary text" },
  { name: "--ground-line", role: "lines" },
  { name: "--ground-chip", role: "chips, finished tool lines" },
  { name: "--ground-panel", role: "panels" },
  { name: "--accent", role: "the one primary per screen, rings, icons" },
  { name: "--accent-ink", role: "text on the accent" },
  { name: "--accent-text", role: "the accent as text" },
  { name: "--accent-line", role: "selected and new edges" },
  { name: "--accent-fill", role: "a running tool line" },
  { name: "--glow", role: "the page glow" },
  { name: "--error", role: "errors: fills, rings, icons" },
  { name: "--error-text", role: "the error as text" },
  { name: "--auto-light", role: "Auto's eyes, ring and connected only" },
  { name: "--auto-shell", role: "Auto's shell" },
  { name: "--auto-dusk", role: "Auto's ring asleep or lost" },
  { name: "--sheet-bg", role: "a Deliverable's page" },
  { name: "--sheet-text", role: "text on that page" },
  { name: "--sheet-accent", role: "the accent on that page" },
];

export interface ColourSwatch extends ColourToken {
  readonly value: string;
  /** Set when a text variant differs from its raw colour: "darkened for reading on Paper". */
  readonly note: string | null;
}

function valueOf(vars: CssVars, name: string): string {
  const value = vars[name];
  if (value === undefined) throw new Error(`A Look sets no ${name}`);
  return value;
}

/** Why a readable variant differs from its raw colour, or null when it is the raw colour. */
export function variantNote(raw: string, derived: string, groundName: string): string | null {
  if (raw.toUpperCase() === derived.toUpperCase()) return null;
  const way = relativeLuminance(derived) < relativeLuminance(raw) ? "darkened" : "lightened";
  return `${way} for reading on ${groundName}`;
}

export function colourSwatches(look: Look): readonly ColourSwatch[] {
  const vars = lookToCssVars(look);
  const groundName = GROUNDS[look.ground].name;
  const raws: Readonly<Record<string, string>> = {
    "--accent-text": ACCENTS[look.accent].hex,
    "--error-text": ERROR_COLOUR,
  };
  return COLOUR_TOKENS.map((token) => {
    const value = valueOf(vars, token.name);
    const raw = raws[token.name];
    return { ...token, value, note: raw === undefined ? null : variantNote(raw, value, groundName) };
  });
}

export interface ContrastCheck {
  /** "text / bg": which pair, in the style sheet's short names. */
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly ratio: number;
  readonly passes: boolean;
}

export function contrastCheck(label: string, foreground: string, background: string): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return { label, foreground, background, ratio, passes: ratio >= AA_TEXT };
}

/** The live contrast ratios: text, secondary text and button ink, plus the readable variants. */
export function contrastChecks(look: Look): readonly ContrastCheck[] {
  const ground = GROUNDS[look.ground];
  const accent = ACCENTS[look.accent];
  const vars = lookToCssVars(look);
  return [
    contrastCheck("text / bg", ground.text, ground.bg),
    contrastCheck("text-2 / bg", ground.text2, ground.bg),
    contrastCheck("text / surface", ground.text, ground.surface),
    contrastCheck("text-2 / surface", ground.text2, ground.surface),
    contrastCheck(`ink / ${accent.name.toLowerCase()}`, accent.ink, accent.hex),
    contrastCheck("accent text / bg", valueOf(vars, "--accent-text"), ground.bg),
    contrastCheck("error text / bg", valueOf(vars, "--error-text"), ground.bg),
  ];
}

/** "16.36:1". */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

/** The active Look's variables as a block to paste into a stylesheet. */
export function rootBlock(look: Look): string {
  const lines = Object.entries(lookToCssVars(look)).map(([name, value]) => `  ${name}: ${value};`);
  return [":root {", ...lines, "}"].join("\n");
}

export interface Specimen {
  readonly label: string;
  readonly sample: string;
}

/** "Instrument Serif", from a catalogue family such as "'Instrument Serif',serif". */
export function familyName(family: string): string {
  return /^'([^']+)'/.exec(family)?.[1] ?? family;
}

/** "Editorial · Instrument Serif italic 400". */
export function displayLine(look: Look): string {
  const font = TYPE_STYLES[look.font];
  return `${font.name} · ${familyName(font.family)} ${font.style} ${font.weight}`;
}

/** The display specimens at the Look's own sizes: hero, status and title. */
export function displaySpecimens(look: Look): readonly Specimen[] {
  const { sizes } = TYPE_STYLES[look.font];
  return [
    { label: `Hero ${sizes.hero}px`, sample: "The fun way." },
    { label: `Status ${sizes.status}px`, sample: "Searching." },
    { label: `Title ${sizes.card}px`, sample: "Laptop shortlist" },
  ];
}

export interface TextSpecimen extends Specimen {
  /** The app/theme.css token it is set in. */
  readonly token: string;
}

/** Reading type is Geist in every Look. Labels match app/theme.css (tests/looks/style.test.ts). */
export const TEXT_SPECIMENS: readonly TextSpecimen[] = [
  { token: "--text-reply", label: "Reply 18 / 1.6", sample: "Three laptops make the cut under £700." },
  { token: "--text-body", label: "Body 16 / 1.6", sample: "Can you make me a shortlist?" },
  { token: "--text-button-sm", label: "Button 14 / 600", sample: "Try again" },
  { token: "--text-label", label: "Label 11 caps", sample: "What Auto did" },
  { token: "--text-mono", label: "Mono 13", sample: "✓ Searched the web · 3 results · 2.1 s" },
];

export interface ScaleStep {
  readonly token: string;
  readonly px: number;
}

/** The 4px spacing scale in app/theme.css. */
export const SPACING_STEPS: readonly ScaleStep[] = [
  { token: "--space-1", px: 4 },
  { token: "--space-2", px: 8 },
  { token: "--space-3", px: 12 },
  { token: "--space-4", px: 16 },
  { token: "--space-5", px: 24 },
  { token: "--space-6", px: 40 },
  { token: "--space-7", px: 56 },
];

export type RadiusKind = "paper" | "tool" | "button" | "card" | "pill";

export interface RadiusStep {
  readonly kind: RadiusKind;
  readonly label: string;
}

/** The five Ember radii (--radius-<kind> in app/theme.css). */
export const RADII: readonly RadiusStep[] = [
  { kind: "paper", label: "6 paper" },
  { kind: "tool", label: "8 tool" },
  { kind: "button", label: "10 button" },
  { kind: "card", label: "14 card" },
  { kind: "pill", label: "pill chip" },
];

/** The motion notes from docs/design/ember/README.md, with the theme's own numbers. */
export const MOTION_NOTES: readonly string[] = [
  "Message arrives: rise 12px and fade, 180ms ease-out",
  "Ring: scale 1 → 1.06 with glow, 2.4s loop",
  "Page glow follows Auto: accent when busy or done, coral on a snag, off asleep (600ms crossfade)",
  "Deliverable lands: drop 16px, overshoot 1.04, 420ms",
  "Every loop stops under reduced motion",
];

/** When Auto is in each state (the Ember style sheet's mascot slot captions). */
const MASCOT_WHEN: Readonly<Record<MascotName, string>> = {
  hello: "First open",
  idle: "Nothing happening",
  listening: "You are typing",
  thinking: "Waiting for a reply",
  working: "A tool is running",
  searching: "Web search",
  reading: "Reading documents",
  celebrate: "Deliverable ready",
  oops: "Error or needs help",
  sleeping: "Automatos not running",
  lost: "404",
  loading: "Loading",
};

export interface MascotSlot {
  readonly state: MascotName;
  readonly when: string;
  readonly tone: RingTone;
  /** The ring's #rrggbb colour under this Look (lib/mascot/ring.ts). */
  readonly ring: string;
}

/** Auto's 12 states with the ring colour each takes under the Look. */
export function mascotSlots(look: Look): readonly MascotSlot[] {
  return MASCOT_STATES.map((state) => ({
    state,
    when: MASCOT_WHEN[state],
    tone: ringTone(state),
    ring: ringColour(state, look),
  }));
}
