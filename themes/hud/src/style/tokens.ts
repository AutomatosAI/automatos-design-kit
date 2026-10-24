import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '@automatos/look-kit/contrast'

import { ACCENTS, FONTS, GROUNDS } from '../lib/looks/catalogue'
import { KNOB_LABELS } from '../lib/looks/spec'
import type { HudLook, KnobName, Switch } from '../lib/looks/types'
import { GLOW_VAR, GRID_VAR, SWITCH_VARS, lookToCssVars, type CssVars } from '../lib/looks/vars'
import { shownGlow } from '../looks/editing'

/**
 * The style sheet as data, pure: what the active look paints, computed from the catalogue through the same builders
 * as boot/prepaint.json (src/lib/looks/vars.ts), so the sheet shows exactly what the host puts on <html> for this
 * look. Each knob with the variable it drives; every colour of HUD's own with what it is for; Studio's tokens, which
 * recolour the host's own pages inside the frame; and the live contrast of the pairs design/contrast.json holds the
 * presets to, the first ten of them (HUD's own colours; the rest are Studio's, which look-kit keeps readable).
 */

export interface Token {
  /** The custom property the look paints on <html>. */
  readonly name: string
  readonly role: string
}

/** Every colour of HUD's own a look paints. test/style/tokens.test.ts holds the list complete. */
export const HUD_COLOURS: readonly Token[] = [
  { name: '--hud-bg', role: 'The page, behind everything' },
  { name: '--hud-surface', role: 'Cards and inputs, one step off the page' },
  { name: '--hud-text', role: 'Text, fixed so it reads on every background' },
  { name: '--hud-text-2', role: 'Secondary text and labels' },
  { name: '--hud-line', role: 'Lines and quiet borders' },
  { name: '--hud-track', role: 'Tracks: gauges, bars, sliders' },
  { name: '--hud-accent', role: 'The one accent: fills, rings, live borders' },
  { name: '--hud-accent-ink', role: 'Text on the accent' },
  { name: '--hud-accent-text', role: 'The accent as text, and the focus ring' },
  { name: '--hud-accent-line', role: 'The borders of live things' },
  { name: '--hud-accent-fill', role: 'Selected and pressed fills' },
  { name: '--hud-panel-fill', role: "A panel's fill" },
  { name: '--hud-panel-line', role: "A panel's border" },
  { name: '--hud-bracket', role: "A panel's corner brackets" },
  { name: '--hud-grid', role: 'The grid behind every page' },
  { name: '--hud-glow', role: 'The glow behind the core' },
  { name: '--hud-error', role: 'What went wrong: never themeable' },
  { name: '--hud-error-text', role: 'The error as text' },
  { name: '--hud-ring-oops', role: "Auto's ring when he needs help" },
  { name: '--hud-ring-dusk', role: "Auto's ring asleep or lost" },
  { name: '--hud-ring-loading', role: "Auto's ring while he loads" },
  { name: '--hud-scan-line', role: 'The scan lines' },
  { name: '--hud-drawer', role: 'Glass over the page' },
]

/** Studio's colour tokens a look paints, HSL triplets the host's pages read as hsl(var(...)). */
export const STUDIO_TOKENS: readonly Token[] = [
  { name: '--background', role: "The host's pages" },
  { name: '--foreground', role: 'Their text' },
  { name: '--card', role: 'Cards and popovers' },
  { name: '--secondary', role: 'Secondary fills' },
  { name: '--muted', role: 'Quiet fills' },
  { name: '--muted-foreground', role: 'Quiet text' },
  { name: '--border', role: 'Borders and inputs' },
  { name: '--primary', role: 'Primary buttons and links' },
  { name: '--primary-foreground', role: 'Text on a primary button' },
  { name: '--ring', role: 'The focus ring' },
  { name: '--destructive', role: 'Destructive actions' },
  { name: '--destructive-foreground', role: 'Text on them' },
]

export interface Swatch extends Token {
  readonly value: string
}

/** The tokens with the values this look paints them. */
export function swatches(look: HudLook, tokens: readonly Token[]): readonly Swatch[] {
  const vars = lookToCssVars(look)
  return tokens.map((token) => ({ ...token, value: vars[token.name] ?? '' }))
}

export interface KnobRow {
  readonly knob: KnobName
  readonly label: string
  /** The knob's choice in words: 'Arc', '14', 'On'. */
  readonly choice: string
  /** The variable it paints, and its value now. */
  readonly variable: string
  readonly value: string
}

const SWITCH_WORDS: Readonly<Record<Switch, string>> = { on: 'On', off: 'Off' }

/** The glow in words: its own number, and the number painted when the pair's cap is lower. */
export function glowWords(look: HudLook): string {
  const shown = shownGlow(look)
  return shown === look.glow ? String(look.glow) : `${look.glow}, painted at ${shown}`
}

function knobRow(vars: CssVars, knob: KnobName, choice: string, variable: string): KnobRow {
  return { knob, label: KNOB_LABELS[knob], choice, variable, value: vars[variable] ?? '' }
}

/** Each knob, in looks/schema.json's order, with the variable it drives. */
export function knobRows(look: HudLook): readonly KnobRow[] {
  const vars = lookToCssVars(look)
  return [
    knobRow(vars, 'accent', ACCENTS[look.accent].name, '--hud-accent'),
    knobRow(vars, 'ground', GROUNDS[look.ground].name, '--hud-bg'),
    knobRow(vars, 'font', FONTS[look.font].face, '--hud-display-family'),
    knobRow(vars, 'grid', String(look.grid), GRID_VAR),
    knobRow(vars, 'glow', glowWords(look), GLOW_VAR),
    knobRow(vars, 'scan', SWITCH_WORDS[look.scan], SWITCH_VARS.scan.name),
    knobRow(vars, 'auto', SWITCH_WORDS[look.auto], SWITCH_VARS.auto.name),
    knobRow(vars, 'motion', SWITCH_WORDS[look.motion], SWITCH_VARS.motion.name),
  ]
}

export interface ContrastPair {
  readonly label: string
  readonly text: string
  readonly ground: string
  /** 4.5 for text (WCAG AA), 3 for a ring or an icon. */
  readonly min: number
}

/** design/contrast.json's pairs of HUD's own colours, in its order; test/style/tokens.test.ts holds them to it. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { label: 'Text on the page', text: '--hud-text', ground: '--hud-bg', min: AA_TEXT },
  { label: 'Text on a card', text: '--hud-text', ground: '--hud-surface', min: AA_TEXT },
  { label: 'Secondary text on the page', text: '--hud-text-2', ground: '--hud-bg', min: AA_TEXT },
  { label: 'Secondary text on a card', text: '--hud-text-2', ground: '--hud-surface', min: AA_TEXT },
  { label: 'Accent text on the page', text: '--hud-accent-text', ground: '--hud-bg', min: AA_TEXT },
  { label: 'Accent text on a card', text: '--hud-accent-text', ground: '--hud-surface', min: AA_TEXT },
  { label: 'Error text on the page', text: '--hud-error-text', ground: '--hud-bg', min: AA_TEXT },
  { label: 'Error text on a card', text: '--hud-error-text', ground: '--hud-surface', min: AA_TEXT },
  { label: 'Ink on the accent', text: '--hud-accent-ink', ground: '--hud-accent', min: AA_TEXT },
  { label: 'The accent on the page, as a ring', text: '--hud-accent', ground: '--hud-bg', min: AA_NON_TEXT },
]

export interface ContrastCheck extends ContrastPair {
  readonly foreground: string
  readonly background: string
  readonly ratio: number
  readonly passes: boolean
}

/** Each pair measured on this look's colours (each a #RRGGBB the look paints). */
export function contrastChecks(look: HudLook): readonly ContrastCheck[] {
  const vars = lookToCssVars(look)
  return CONTRAST_PAIRS.map((pair) => {
    const foreground = vars[pair.text] ?? ''
    const background = vars[pair.ground] ?? ''
    const ratio = contrastRatio(foreground, background)
    return { ...pair, foreground, background, ratio, passes: ratio >= pair.min }
  })
}

/** '12.34:1'. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`
}
