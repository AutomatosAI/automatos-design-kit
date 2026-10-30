import { KIND_SETS } from '../looks/catalogue'

/**
 * Which of the three card gradients a thing wears, and the letter on its avatar. Cards, avatars and rows cycle
 * through the palette's three gradients in screen order (the design's "Mixed"; One colour paints all three the same,
 * so nothing here changes for it), and a Deliverable takes its kind's. Pure.
 */

export type CardSet = 1 | 2 | 3

/** The gradient of the thing at `index` in screen order: 1, 2, 3, 1, … */
export function cardSetOf(index: number): CardSet {
  return ((((index % 3) + 3) % 3) + 1) as CardSet
}

/** A Deliverable kind's gradient: report and slides the first, document and spreadsheet the second, image and blog
 * post the third. Any other kind takes the first. */
export function kindSetOf(kind: string | null | undefined): CardSet {
  const key = (kind ?? '').toLowerCase()
  return Object.hasOwn(KIND_SETS, key) ? KIND_SETS[key] : 1
}

/** A name's first letter, upper-cased, for an avatar; '?' for a name with none. */
export function initialOf(name: string | null | undefined): string {
  const letter = (name ?? '').trim().match(/\p{L}|\p{N}/u)?.[0]
  return letter ? letter.toLocaleUpperCase() : '?'
}
