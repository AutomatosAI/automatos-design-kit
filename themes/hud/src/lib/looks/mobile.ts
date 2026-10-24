import type { AccentKey, GroundKey } from './catalogue'
import { groundPalette, studioAccent, studioConsequence } from './engine'
import { DEFAULT_LOOK } from './presets'

/**
 * The phone's colours: theme.json's `mobile.tokens`, Studio's 24 colour tokens a phone draws, painted from ARC
 * (the default look's ground and accent) as #RRGGBB. The phone's own HUD layout reads none of them; they are
 * there so a phone that draws from data alone draws HUD dark, and so core's review can measure them (its ten
 * AA pairs). HUD is never light, so the `light` scheme the block requires holds the same dark colours as
 * `dark`. They are the colours Studio's tokens paint on the web for ARC (look-kit's palette, the accent and
 * the error made readable), so the phone and the web agree; test/mobile.test.ts holds theme.json to this.
 */

export type MobileTokens = Readonly<Record<string, string>>

/** Studio's colour tokens for one ground and accent, as opaque colours. */
export function mobileTokens(ground: GroundKey, accent: AccentKey): MobileTokens {
  const palette = groundPalette(ground)
  const primary = studioAccent(ground, accent)
  const consequence = studioConsequence(ground)
  return {
    '--background': palette.bg,
    '--foreground': palette.text,
    '--card': palette.card,
    '--card-foreground': palette.text,
    '--popover': palette.card,
    '--popover-foreground': palette.text,
    '--primary': primary.fill,
    '--primary-foreground': primary.ink,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.text,
    '--muted': palette.muted,
    '--muted-foreground': palette.text2,
    '--accent': consequence.fill,
    '--accent-foreground': consequence.ink,
    '--destructive': consequence.fill,
    '--destructive-foreground': consequence.ink,
    '--border': palette.border,
    '--input': palette.border,
    '--ring': primary.fill,
    '--background-gradient-from': palette.bg,
    '--background-gradient-to': palette.bg,
    '--glass-border-hover': palette.borderStrong,
    '--cc-hover': palette.muted,
    '--cc-hover-border': palette.borderStrong,
  }
}

/** The tokens theme.json's mobile block holds, for both schemes. */
export function hudMobileTokens(): MobileTokens {
  return mobileTokens(DEFAULT_LOOK.ground, DEFAULT_LOOK.accent)
}
