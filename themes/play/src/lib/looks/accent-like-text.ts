import { parseHex } from '@automatos/look-kit/contrast'

import { ACCENTS, GROUNDS } from './catalogue'
import type { Look } from './types'

/**
 * Play 1.1.1 — a look whose accent reads as its text colour (Cream on a dark ground: Obsidian). Play's primary
 * button is filled in the accent and its secondary (cream) one in the text colour, so on such a look the two are
 * the same button. Play's frame and asleep screen then carry data-accent-like-text, and the secondary buttons
 * become outlines (app/play-theme.css's --pl-button-2-* tokens).
 *
 * Two colours read as one when the straight-line distance between their sRGB channels (0 to 255 each) is under
 * SAME_COLOUR_DISTANCE: Cream is 15 to 35 from each dark ground's text, and every other pair in the catalogue is
 * at least 128 apart.
 */
export const SAME_COLOUR_DISTANCE = 64

/** The straight-line distance between two #rrggbb colours' sRGB channels. */
export function colourDistance(a: string, b: string): number {
  const [redA, greenA, blueA] = parseHex(a)
  const [redB, greenB, blueB] = parseHex(b)
  return Math.hypot(redA - redB, greenA - greenB, blueA - blueB)
}

/** The look's accent reads as its ground's text colour, so a secondary button filled in that colour would match the primary. */
export function accentLikeText(look: Pick<Look, 'ground' | 'accent'>): boolean {
  return colourDistance(ACCENTS[look.accent].hex, GROUNDS[look.ground].text) < SAME_COLOUR_DISTANCE
}
