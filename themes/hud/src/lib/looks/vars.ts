import { ACCENTS, DRAWER, FIXED, FONTS, RING_COLOURS, SCAN_LINE, type AccentKey, type FontKey, type GroundKey } from './catalogue'
import {
  accentTextOf,
  errorTextOf,
  groundOf,
  kitAccentVars,
  rgba,
  safeGlowAlpha,
  studioAccentTokens,
  studioGroundTokens,
} from './engine'
import { GLOW_SCALE, GRID_SCALE, type HudLook, type Switch, type SwitchKnobName } from './types'

/**
 * A look as CSS custom properties, one builder per knob, so the first-paint table (prepaint.ts) and anything
 * that paints a look in code make exactly the same values. HUD's own are --hud-*; each ground also carries
 * Studio's tokens and each ground and accent pair Studio's --primary and --ring (engine.ts), so the host's
 * pages inside the frame look HUD. The fixed colours ride with every ground, so no stylesheet holds a colour.
 *
 * The derived variables follow the design's table (the Command design's README, "Theme system"):
 * --hud-bg, the accent with its ink, line (45%) and fill (12%), the panel fill (3.5%), the grid and the glow,
 * the fixed texts, line, track and error. Beside them: the panel's border (16%, the design's 14 to 20%) and its
 * corner brackets (70%), the readable accent and error as text, the display face, and the three switches.
 */

export type CssVars = Readonly<Record<string, string>>

/** The panel's own fill, its border and its corner brackets: the accent at these alphas. */
export const PANEL_FILL_ALPHA = 0.035
export const PANEL_LINE_ALPHA = 0.16
export const BRACKET_ALPHA = 0.7

/** What each switch paints, on and off. */
export const SWITCH_VARS: Readonly<Record<SwitchKnobName, { readonly name: string } & Readonly<Record<Switch, string>>>> = {
  scan: { name: '--hud-scan', on: '1', off: '0' },
  auto: { name: '--hud-auto-display', on: 'block', off: 'none' },
  motion: { name: '--hud-motion', on: 'running', off: 'paused' },
}

/** The grid's and the glow's variables, painted from the numbers by the first-paint table's rules. */
export const GRID_VAR = '--hud-grid'
export const GLOW_VAR = '--hud-glow'

/** The ground: its bg and surface, the fixed colours, and Studio's ground tokens. */
export function groundVars(key: GroundKey): CssVars {
  const ground = groundOf(key)
  return {
    '--hud-bg': ground.bg,
    '--hud-surface': ground.surface,
    '--hud-text': FIXED.text,
    '--hud-text-2': FIXED.text2,
    '--hud-line': FIXED.line,
    '--hud-track': FIXED.track,
    '--hud-error': FIXED.error,
    '--hud-error-text': errorTextOf(key),
    '--hud-scan-line': SCAN_LINE,
    '--hud-drawer': DRAWER,
    '--hud-ring-oops': RING_COLOURS.oops,
    '--hud-ring-dusk': RING_COLOURS.dusk,
    '--hud-ring-loading': RING_COLOURS.loading,
    ...studioGroundTokens(key),
  }
}

/** The accent: look-kit's four, then the panel's fill, border and brackets. */
export function accentVars(key: AccentKey): CssVars {
  const { hex } = ACCENTS[key]
  return {
    ...kitAccentVars(key),
    '--hud-panel-fill': rgba(hex, PANEL_FILL_ALPHA),
    '--hud-panel-line': rgba(hex, PANEL_LINE_ALPHA),
    '--hud-bracket': rgba(hex, BRACKET_ALPHA),
  }
}

/** The accent as text on the ground, and Studio's --primary and --ring for the pair. */
export function pairVars(ground: GroundKey, accent: AccentKey): CssVars {
  return { '--hud-accent-text': accentTextOf(ground, accent), ...studioAccentTokens(ground, accent) }
}

/** The display face: brand, panel labels and big numbers. Body text stays Geist, labels Geist Mono. */
export function fontVars(key: FontKey): CssVars {
  const font = FONTS[key]
  return {
    '--hud-display-family': font.family,
    '--hud-display-weight': String(font.weight),
    '--hud-title-size': `${font.titlePx}px`,
    '--hud-label-size': `${font.labelPx}px`,
  }
}

export function switchVars(knob: SwitchKnobName, value: Switch): CssVars {
  const entry = SWITCH_VARS[knob]
  return { [entry.name]: entry[value] }
}

/** The grid: the accent at grid / GRID_SCALE alpha. */
export function gridVars(accent: AccentKey, grid: number): CssVars {
  return { [GRID_VAR]: rgba(ACCENTS[accent].hex, grid / GRID_SCALE) }
}

/** The glow: the accent at glow / GLOW_SCALE alpha, never past the pair's AA cap. */
export function glowVars(ground: GroundKey, accent: AccentKey, glow: number): CssVars {
  const alpha = Math.min(glow / GLOW_SCALE, safeGlowAlpha(ground, accent))
  return { [GLOW_VAR]: rgba(ACCENTS[accent].hex, alpha) }
}

/** Every variable a look paints, in the first paint's order: each knob's, the pair's, then the numbers'. */
export function lookToCssVars(look: HudLook): CssVars {
  return {
    ...accentVars(look.accent),
    ...groundVars(look.ground),
    ...fontVars(look.font),
    ...switchVars('scan', look.scan),
    ...switchVars('auto', look.auto),
    ...switchVars('motion', look.motion),
    ...pairVars(look.ground, look.accent),
    ...gridVars(look.accent, look.grid),
    ...glowVars(look.ground, look.accent, look.glow),
  }
}
