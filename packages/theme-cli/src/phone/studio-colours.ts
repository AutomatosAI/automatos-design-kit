/**
 * Studio's colours as Automatos Go draws them: the colours an installed theme's phone painting is laid over. A
 * copy of the app's src/styles/tokens/studio-source.ts (Studio Light, the :root block, and Studio Dark, the .dark
 * block, as the source writes them: 'H S% L%' triplets under their '--' keys, and its resolved shorthands as
 * hsl(...) with any alpha) and of src/styles/tokens/studio.ts `tokenName` (:47-:49), `alphaHex` (:30-:36),
 * `sourceToHex` (:39-:44) and STUDIO_COLOURS (:63-:66), at the Automatos Go commit the package README's
 * "The phone's model" names.
 * Values are copied, never retuned. Dark redefines what it changes and the rest cascades from Light, as in CSS.
 *
 * A triplet becomes #RRGGBB through mobile-paint.ts `parseColour`, look-kit hsl.ts `tripletToHex` step for step, as
 * the app's vendored converter does; a wrapped value with an alpha becomes #RRGGBBAA.
 */
import { parseColour } from '../mobile-paint.ts'

export const STUDIO_LIGHT_SOURCE = {
  '--background': '38 50% 92%',
  '--foreground': '30 12% 9%',
  '--card': '0 0% 100%',
  '--card-foreground': '30 12% 9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '30 12% 9%',
  '--primary': '30 12% 9%',
  '--primary-foreground': '38 50% 96%',
  '--secondary': '38 40% 86%',
  '--secondary-foreground': '36 12% 22%',
  '--muted': '40 30% 80%',
  '--muted-foreground': '36 12% 36%',
  '--accent': '15 76% 44%',
  '--accent-foreground': '38 50% 96%',
  '--destructive': '15 76% 44%',
  '--destructive-foreground': '38 50% 96%',
  '--border': '40 30% 80%',
  '--input': '40 30% 80%',
  '--ring': '82 30% 33%',
  '--success': '82 30% 33%',
  '--success-foreground': '38 50% 96%',
  '--warning': '47 73% 56%',
  '--warning-foreground': '30 12% 9%',
  '--info': '213 51% 23%',
  '--info-foreground': '38 50% 96%',
  '--agent': '213 51% 23%',
  '--agent-foreground': '38 50% 96%',
  '--olive': '82 50% 22%',
  '--warn-ink': '38 78% 27%',
  '--on-strong': '0 0% 100%',
  '--cc-hover': '38 45% 96%',
  '--cc-hover-border': '40 30% 70%',
  '--cc-live-dot': '82 50% 22%',
  '--chart-1': '15 76% 44%',
  '--chart-2': '213 51% 23%',
  '--chart-3': '82 30% 33%',
  '--chart-4': '36 12% 36%',
  '--chart-5': '47 73% 56%',
  '--paper': 'hsl(0 0% 100%)',
  '--bg-1': 'hsl(38 50% 92%)',
  '--bg-2': 'hsl(38 40% 86%)',
  '--fg': 'hsl(30 12% 9%)',
  '--fg-2': 'hsl(36 12% 36%)',
  '--fg-3': 'hsl(36 10% 50%)',
  '--border-2': 'hsl(40 30% 70%)',
  '--accent-2': 'hsl(15 76% 44% / 0.10)',
  '--navy': 'hsl(213 51% 23%)',
  '--running': 'hsl(40 20% 65%)',
} as const

/** Studio Dark: paper and ink invert; orange, olive and navy lift a step. */
export const STUDIO_DARK_SOURCE: Readonly<Partial<Record<keyof typeof STUDIO_LIGHT_SOURCE, string>>> = {
  '--background': '30 12% 9%',
  '--foreground': '38 40% 90%',
  '--card': '30 10% 12%',
  '--card-foreground': '38 40% 90%',
  '--popover': '30 10% 12%',
  '--popover-foreground': '38 40% 90%',
  '--primary': '38 40% 90%',
  '--primary-foreground': '30 12% 9%',
  '--secondary': '30 10% 16%',
  '--secondary-foreground': '38 30% 80%',
  '--muted': '30 8% 20%',
  '--muted-foreground': '38 18% 62%',
  '--accent': '15 80% 56%',
  '--accent-foreground': '30 12% 9%',
  '--destructive': '15 80% 56%',
  '--destructive-foreground': '30 12% 9%',
  '--border': '30 10% 22%',
  '--input': '30 10% 22%',
  '--ring': '82 35% 52%',
  '--success': '82 35% 52%',
  '--success-foreground': '30 12% 9%',
  '--warning': '47 70% 60%',
  '--warning-foreground': '30 12% 9%',
  '--info': '213 55% 68%',
  '--info-foreground': '30 12% 9%',
  '--agent': '213 55% 68%',
  '--agent-foreground': '30 12% 9%',
  '--olive': '82 45% 58%',
  '--warn-ink': '47 70% 60%',
  '--on-strong': '30 12% 9%',
  '--cc-hover': '30 10% 15%',
  '--cc-hover-border': '30 10% 32%',
  '--cc-live-dot': '82 45% 58%',
  '--chart-1': '15 80% 56%',
  '--chart-2': '213 55% 68%',
  '--chart-3': '82 35% 52%',
  '--chart-4': '38 18% 62%',
  '--chart-5': '47 70% 60%',
  '--paper': 'hsl(30 10% 12%)',
  '--bg-1': 'hsl(30 12% 9%)',
  '--bg-2': 'hsl(30 10% 16%)',
  '--fg': 'hsl(38 40% 90%)',
  '--fg-2': 'hsl(38 18% 62%)',
  '--fg-3': 'hsl(36 12% 52%)',
  '--border-2': 'hsl(30 10% 32%)',
  '--accent-2': 'hsl(15 80% 56% / 0.14)',
  '--navy': 'hsl(213 55% 68%)',
}

/** 'muted-foreground' → 'mutedForeground', 'chart-1' → 'chart1'. */
type Camel<S extends string> = S extends `${infer Head}-${infer Tail}` ? `${Head}${Capitalize<Camel<Tail>>}` : S
/** A '--' key as the name the app's layouts read: '--cc-hover-border' → 'ccHoverBorder'. */
export type TokenName<Key> = Key extends `--${infer Name}` ? Camel<Name> : never
export type StudioColourName = TokenName<keyof typeof STUDIO_LIGHT_SOURCE>
/** Every Studio colour as #RRGGBB, or #RRGGBBAA where the source carries an alpha. */
export type StudioColours = Readonly<Record<StudioColourName, string>>
export type ColourScheme = 'light' | 'dark'

const WRAPPED = /^hsl\((\d[^/]*?)(?: \/ (\d*\.?\d+))?\)$/
const ALPHA_MAX = 255
const HEX_BASE = 16

/** '--cc-hover-border' → 'ccHoverBorder', '--chart-1' → 'chart1'. */
export function tokenName(key: string): string {
  return key.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase())
}

/** An alpha 0-1 as the two hex digits #RRGGBBAA ends with. */
export function alphaHex(alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`${alpha} isn't an alpha from 0 to 1`)
  return Math.round(alpha * ALPHA_MAX).toString(HEX_BASE).padStart(2, '0').toUpperCase()
}

function tripletHex(triplet: string): string {
  const hex = parseColour(triplet)
  if (hex === null) throw new Error(`${triplet} is not an 'H S% L%' triplet`)
  return hex
}

/** 'H S% L%', 'hsl(H S% L%)' or 'hsl(H S% L% / A)' as #RRGGBB, or #RRGGBBAA with an alpha. */
export function sourceToHex(value: string): string {
  const match = WRAPPED.exec(value)
  if (!match) return tripletHex(value)
  const hex = tripletHex(match[1])
  return match[2] === undefined ? hex : `${hex}${alphaHex(Number(match[2]))}`
}

function normalise(source: Readonly<Record<string, string>>): StudioColours {
  const entries = Object.entries(source).map(([key, value]) => [tokenName(key), sourceToHex(value)])
  return Object.freeze(Object.fromEntries(entries)) as StudioColours
}

/** Studio Light and Studio Dark, each colour as the app draws it. */
export const STUDIO_COLOURS: Readonly<Record<ColourScheme, StudioColours>> = Object.freeze({
  light: normalise(STUDIO_LIGHT_SOURCE),
  dark: normalise({ ...STUDIO_LIGHT_SOURCE, ...STUDIO_DARK_SOURCE } as Readonly<Record<string, string>>),
})

/** True when `name` is one of Studio's colours. */
export function isStudioColour(name: string): name is StudioColourName {
  return Object.prototype.hasOwnProperty.call(STUDIO_COLOURS.light, name)
}
