/**
 * The colour arithmetic the look data and the style sheet need: a #rrggbb colour as Studio's `H S% L%` triplet
 * (how the host's own pages read their tokens), the triplet back as #rrggbb, and the WCAG 2.x contrast ratio of two
 * colours. Pure.
 */

const HEX = /^#([0-9a-f]{6})$/i
const TRIPLET = /^(\d{1,3}(?:\.\d{1,2})?) (\d{1,3}(?:\.\d{1,2})?)% (\d{1,3}(?:\.\d{1,2})?)%$/
const RGB_FUNCTION = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
const LINEAR_KNEE = 0.03928
const DEGREES = 360

export type Rgb = readonly [number, number, number]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function rgbOfHex(hex: string): Rgb {
  const match = HEX.exec(hex)
  if (match === null) throw new TypeError(`Not a #rrggbb colour: ${hex}`)
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function hueOf(r: number, g: number, b: number, max: number, delta: number): number {
  if (delta === 0) return 0
  if (max === r) return ((g - b) / delta + (g < b ? 6 : 0)) * 60
  if (max === g) return ((b - r) / delta + 2) * 60
  return ((r - g) / delta + 4) * 60
}

/** A #rrggbb colour as an `H S% L%` triplet: the hue below 360, every number to two decimals at most. */
export function tripletOf(hex: string): string {
  const [r, g, b] = rgbOfHex(hex).map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  const hue = round2(hueOf(r, g, b, max, delta)) % DEGREES
  return `${hue} ${round2(saturation * 100)}% ${round2(lightness * 100)}%`
}

function channelOfHsl(hue: number, saturation: number, lightness: number, shift: number): number {
  const k = (shift + hue / 30) % 12
  const a = saturation * Math.min(lightness, 1 - lightness)
  return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
}

/** A triplet back as #rrggbb, as a phone reads it. */
export function hexOfTriplet(triplet: string): string {
  const match = TRIPLET.exec(triplet.trim())
  if (match === null) throw new TypeError(`Not an H S% L% triplet: ${triplet}`)
  const [hue, saturation, lightness] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100]
  const channels = [0, 8, 4].map((shift) => Math.round(channelOfHsl(hue, saturation, lightness, shift) * 255))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function linear(channel: number): number {
  const value = channel / 255
  return value <= LINEAR_KNEE ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** The WCAG 2.x contrast ratio of two opaque colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** A colour as the browser computes it (rgb() of three numbers) or as written (#rrggbb); null for anything else. */
export function rgbOfCss(value: string): Rgb | null {
  const text = value.trim()
  if (HEX.test(text)) return rgbOfHex(text)
  const match = RGB_FUNCTION.exec(text)
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])]
}
