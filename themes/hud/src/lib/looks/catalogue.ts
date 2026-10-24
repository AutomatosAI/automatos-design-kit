/**
 * HUD's catalogue: the only accents, grounds and display faces a look can name, and the colours every look
 * shares. The values are the Command design's (its looks.json in the kit's references, look schema v0:
 * options.accent, options.ground, options.font and fixed), copied exactly; test/catalogue.test.ts holds them
 * to that file. The ring colours are Mascot.dc.html's (oops, sleeping and lost, loading) and the scan line and
 * the drawer are "Automatos Command HUD.dc.html"'s. This file is the one place in HUD's source that holds a
 * literal colour: the look's CSS variables (vars.ts) are made from it, and the stylesheets read only those.
 *
 * A display face's `family` is the CSS font-family the look paints: Rajdhani and Chakra Petch are HUD's own
 * faces (src/app/hud-fonts.css, each family named hud-…), Geist Mono is the host's (--font-geist-mono).
 */

export interface Accent {
  readonly name: string
  readonly hex: string
  /** Text on the accent fill (a primary button), chosen per accent for AA. */
  readonly ink: string
}

export interface Ground {
  readonly name: string
  readonly bg: string
}

export interface DisplayFont {
  /** The name the Looks drawer shows. */
  readonly name: string
  /** The design's name for the face (looks.json's family). */
  readonly face: string
  /** The CSS font-family the look paints. */
  readonly family: string
  readonly weight: number
  /** The top bar's title size, in px. */
  readonly titlePx: number
  /** A panel label's size, in px. */
  readonly labelPx: number
}

export const ACCENTS = {
  arc: { name: 'Arc', hex: '#3FE0FF', ink: '#021116' },
  forge: { name: 'Forge', hex: '#FF8A3D', ink: '#1A0A02' },
  ghost: { name: 'Ghost', hex: '#E3ECF0', ink: '#06090B' },
  nova: { name: 'Nova', hex: '#FF5CDB', ink: '#1F0219' },
  signal: { name: 'Signal', hex: '#5CFF9A', ink: '#021208' },
  gold: { name: 'Gold', hex: '#FFC94A', ink: '#1C1400' },
} as const satisfies Record<string, Accent>

export const GROUNDS = {
  void: { name: 'Void', bg: '#030507' },
  carbon: { name: 'Carbon', bg: '#0B0B0D' },
  navy: { name: 'Navy', bg: '#050B18' },
  ember: { name: 'Ember', bg: '#0C0806' },
} as const satisfies Record<string, Ground>

export const FONTS = {
  raj: { name: 'RAJDHANI', face: 'Rajdhani', family: 'hud-rajdhani,sans-serif', weight: 700, titlePx: 18, labelPx: 13 },
  chakra: { name: 'CHAKRA', face: 'Chakra Petch', family: 'hud-chakra-petch,sans-serif', weight: 600, titlePx: 15, labelPx: 12 },
  mono: { name: 'MONO', face: 'Geist Mono', family: 'var(--font-geist-mono),ui-monospace,monospace', weight: 500, titlePx: 14, labelPx: 11 },
} as const satisfies Record<string, DisplayFont>

/**
 * The colours no look changes (looks.json `fixed`): the text colours are fixed so they keep AA on every
 * ground, the line and the track are the text at 10% and 8%, and the error colour is never themeable.
 */
export const FIXED = {
  text: '#E6F1F5',
  text2: '#93A6AF',
  line: 'rgba(230,241,245,.10)',
  track: 'rgba(230,241,245,.08)',
  error: '#FF6B6B',
} as const

/** Auto's ring when he needs help, sleeps or is lost, and loads (Mascot.dc.html); the accent otherwise. */
export const RING_COLOURS = {
  oops: '#FF6B7A',
  dusk: '#5E578F',
  loading: '#8B7CFF',
} as const

/** The scan-line overlay's dark line, one pixel in three. */
export const SCAN_LINE = 'rgba(0,0,0,.18)'

/** The Looks drawer's glass, over the page. */
export const DRAWER = 'rgba(5,8,10,.82)'

export type AccentKey = keyof typeof ACCENTS
export type GroundKey = keyof typeof GROUNDS
export type FontKey = keyof typeof FONTS

/** Own keys only: 'toString' or '__proto__' are never catalogue entries. */
export function isKeyOf<T extends object>(section: T, key: unknown): key is keyof T & string {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(section, key)
}

function keysOf<T extends object>(section: T): readonly (keyof T & string)[] {
  return Object.keys(section).filter((key): key is keyof T & string => isKeyOf(section, key))
}

export const ACCENT_KEYS = keysOf(ACCENTS)
export const GROUND_KEYS = keysOf(GROUNDS)
export const FONT_KEYS = keysOf(FONTS)
