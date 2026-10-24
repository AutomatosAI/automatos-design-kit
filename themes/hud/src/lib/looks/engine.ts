import { AA_TEXT, contrastRatio, mixHex } from '@automatos/look-kit/contrast'
import * as kitCss from '@automatos/look-kit/css'
import * as kitStudio from '@automatos/look-kit/studio-tokens'
import type { LookCatalogue, LookGround } from '@automatos/look-kit/types'

import { ACCENTS, FIXED, GROUNDS, GROUND_KEYS, type AccentKey, type GroundKey } from './catalogue'
import { GLOW_MAX, GLOW_MIN, GLOW_SCALE, type HudLook } from './types'

/**
 * HUD's catalogue as the look runtime (@automatos/look-kit) reads one, and the runtime's answers HUD paints:
 * the accent and the error colour made readable as text, and Studio's tokens, so the host's own pages inside
 * HUD's frame take the look's colours, as under Play; and the glow's AA cap, HUD's own (safeGlow, below).
 *
 * look-kit's ground has a surface, a chip, a line and a panel besides its bg and texts; the Command design
 * names only the bg, and fixes the texts, the line (text at 10%) and the track (text at 8%). So a HUD ground
 * is: its bg; the surface, the track over the bg (a card one step off the page); the design's fixed texts and
 * line; and the track as the chip (Studio's secondary and muted fills). The panel is the track too: look-kit
 * paints it only for Play's ground panel, which HUD never asks for. Every HUD ground is dark.
 */

/** HUD's variables are --hud-*: its own --accent and --ring would clobber Studio's tokens of those names. */
export const HUD_VAR_PREFIX = 'hud'

/** A panel's own fill: the accent at this alpha (vars.ts paints it as --hud-panel-fill). */
export const PANEL_FILL_ALPHA = 0.035

/** The track (an rgba() of the text) over a ground's bg, as one #RRGGBB colour. */
export function surfaceOf(bg: string): string {
  return kitStudio.overGround(FIXED.track, bg)
}

function lookGround(bg: string): LookGround {
  return {
    bg,
    surface: surfaceOf(bg),
    text: FIXED.text,
    text2: FIXED.text2,
    line: FIXED.line,
    chip: FIXED.track,
    panel: FIXED.track,
  }
}

const LOOK_GROUNDS: Readonly<Record<GroundKey, LookGround>> = Object.fromEntries(
  GROUND_KEYS.map((key) => [key, lookGround(GROUNDS[key].bg)]),
) as Record<GroundKey, LookGround>

export const HUD_LOOK_CATALOGUE: LookCatalogue = {
  prefix: HUD_VAR_PREFIX,
  errorColour: FIXED.error,
  glow: { min: GLOW_MIN, max: GLOW_MAX },
  grounds: LOOK_GROUNDS,
  accents: ACCENTS,
  typeStyles: {},
  shells: {},
  lights: {},
}

const CATALOGUE = HUD_LOOK_CATALOGUE

type CssVars = kitCss.CssVars

/** A ground as the runtime reads it. */
export function groundOf(key: GroundKey): LookGround {
  return LOOK_GROUNDS[key]
}

export function isDarkGround(key: GroundKey): boolean {
  return kitCss.isDarkGround(CATALOGUE, key)
}

/** The error colour as text on this ground: itself where it reads, else darkened toward the text until it does. */
export function errorTextOf(key: GroundKey): string {
  return kitCss.errorTextOf(CATALOGUE, key)
}

/** The accent as text on this ground, over the bg, the surface and the accent's own tints. */
export function accentTextOf(ground: GroundKey, accent: AccentKey): string {
  return kitCss.accentTextOf(CATALOGUE, ground, accent)
}

/** What text sits on at a glow: the glow over the bg, and a panel's fill over that glow. */
function glowFills(bg: string, hex: string, glow: number): readonly string[] {
  const glowed = mixHex(bg, hex, glow / GLOW_SCALE)
  return [glowed, mixHex(glowed, hex, PANEL_FILL_ALPHA)]
}

/**
 * The largest whole glow, GLOW_MIN to GLOW_MAX, at which the texts HUD sets on the page and in its panels (the text,
 * the second text, the error and the accent as text) still read at AA, at it and at every glow below it. look-kit's
 * cap (kitCss.safeGlow) measures the glow over the bg alone; a panel's fill lies over the glow too and tints it
 * further, so HUD's cap measures both and stops where the panel's text would drop under AA.
 */
export function safeGlow(ground: GroundKey, accent: AccentKey): number {
  const { bg } = groundOf(ground)
  const { hex } = ACCENTS[accent]
  const texts = [FIXED.text, FIXED.text2, errorTextOf(ground), accentTextOf(ground, accent)]
  const reads = (glow: number): boolean =>
    glowFills(bg, hex, glow).every((fill) => texts.every((text) => contrastRatio(text, fill) >= AA_TEXT))
  let glow = GLOW_MIN
  while (glow < GLOW_MAX && reads(glow + 1)) glow += 1
  return glow
}

export function safeGlowAlpha(ground: GroundKey, accent: AccentKey): number {
  return safeGlow(ground, accent) / GLOW_SCALE
}

export function rgbList(hex: string): string {
  return kitCss.rgbList(hex)
}

export function rgba(hex: string, alpha: number): string {
  return kitCss.rgba(hex, alpha)
}

/** The accent's four look-kit variables: --hud-accent, -accent-ink, -accent-line and -accent-fill. */
export function kitAccentVars(key: AccentKey): CssVars {
  return kitCss.accentVars(CATALOGUE, key)
}

export function studioGroundTokens(key: GroundKey): CssVars {
  return kitStudio.studioGroundTokens(CATALOGUE, key)
}

export function studioAccentTokens(ground: GroundKey, accent: AccentKey): CssVars {
  return kitStudio.studioAccentTokens(CATALOGUE, ground, accent)
}

/** A look as Studio's tokens. */
export function lookToStudioTokens(look: Pick<HudLook, 'ground' | 'accent'>): CssVars {
  return kitStudio.lookToStudioTokens(CATALOGUE, look)
}

export function groundPalette(key: GroundKey): kitStudio.GroundPalette {
  return kitStudio.groundPalette(CATALOGUE, key)
}

export function studioAccent(ground: GroundKey, accent: AccentKey): kitStudio.StudioAccent {
  return kitStudio.studioAccent(CATALOGUE, ground, accent)
}

export function studioConsequence(key: GroundKey): kitStudio.StudioAccent {
  return kitStudio.studioConsequence(CATALOGUE, key)
}
