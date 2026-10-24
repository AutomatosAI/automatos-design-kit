import * as kitCss from '@automatos/look-kit/css'
import * as kitStudio from '@automatos/look-kit/studio-tokens'
import type { LookCatalogue, LookGround } from '@automatos/look-kit/types'

import { ACCENTS, FIXED, GROUNDS, GROUND_KEYS, type AccentKey, type GroundKey } from './catalogue'
import { GLOW_MAX, GLOW_MIN, type HudLook } from './types'

/**
 * HUD's catalogue as the look runtime (@automatos/look-kit) reads one, and the runtime's answers HUD paints:
 * the accent and the error colour made readable as text, the glow's AA cap, and Studio's tokens, so the
 * host's own pages inside HUD's frame take the look's colours, as under Play.
 *
 * look-kit's ground has a surface, a chip, a line and a panel besides its bg and texts; the Command design
 * names only the bg, and fixes the texts, the line (text at 10%) and the track (text at 8%). So a HUD ground
 * is: its bg; the surface, the track over the bg (a card one step off the page); the design's fixed texts and
 * line; and the track as the chip (Studio's secondary and muted fills). The panel is the track too: look-kit
 * paints it only for Play's ground panel, which HUD never asks for. Every HUD ground is dark.
 */

/** HUD's variables are --hud-*: its own --accent and --ring would clobber Studio's tokens of those names. */
export const HUD_VAR_PREFIX = 'hud'

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

/** The largest whole glow at which the page's texts still read at AA over it. */
export function safeGlow(ground: GroundKey, accent: AccentKey): number {
  return kitCss.safeGlow(CATALOGUE, ground, accent)
}

export function safeGlowAlpha(ground: GroundKey, accent: AccentKey): number {
  return kitCss.safeGlowAlpha(CATALOGUE, ground, accent)
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
