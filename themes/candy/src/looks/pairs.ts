/**
 * The colour pairs Candy must keep readable, in every preset: the design's own list (looks.json "pairs"), then the
 * pairs the build adds where it draws a colour on a ground the design didn't list (quiet text on a chip and on the
 * band, the accent as a link, the user's bubble, the state pill on Auto's stage, white on each card's middle stop)
 * and Studio's tokens, which recolour the host's pages. design/contrast.json is written from this list
 * (test/look-data.test.ts) and `automatos-theme check design` measures every pair on every preset. A card's end
 * stop carries only large figures, so its pair asks 3:1.
 */

export interface Pair {
  readonly text: string
  readonly ground: string
  /** 4.5 for text (the default), 3 for large figures, a ring or an icon. */
  readonly min?: number
}

export interface LabelledPair extends Pair {
  readonly label: string
}

export const DESIGN_PAIRS: readonly LabelledPair[] = [
  { label: 'Text / page', text: '--candy-text', ground: '--candy-page' },
  { label: 'Text / window', text: '--candy-text', ground: '--candy-win' },
  { label: 'Text / chip', text: '--candy-text', ground: '--candy-chip' },
  { label: 'Text / band', text: '--candy-text', ground: '--candy-band-a' },
  { label: 'Quiet / window', text: '--candy-quiet', ground: '--candy-win' },
  { label: 'Quiet / page', text: '--candy-quiet', ground: '--candy-page' },
  { label: 'Accent ink / accent', text: '--candy-accent-ink', ground: '--candy-accent' },
  { label: 'Accent / window', text: '--candy-accent', ground: '--candy-win', min: 3 },
  { label: 'Accent / page', text: '--candy-accent', ground: '--candy-page', min: 3 },
  { label: 'Card ink / first card', text: '--candy-card-ink', ground: '--candy-g1a' },
  { label: 'Card ink / second card', text: '--candy-card-ink', ground: '--candy-g2a' },
  { label: 'Card ink / third card', text: '--candy-card-ink', ground: '--candy-g3a' },
]

const BUILD_PAIRS: readonly Pair[] = [
  { text: '--candy-text', ground: '--candy-band-b' },
  { text: '--candy-text', ground: '--candy-band-1' },
  { text: '--candy-text', ground: '--candy-band-2' },
  { text: '--candy-text', ground: '--candy-band-3' },
  { text: '--candy-quiet', ground: '--candy-chip' },
  { text: '--candy-band-quiet', ground: '--candy-band-a' },
  { text: '--candy-band-quiet', ground: '--candy-band-b' },
  { text: '--candy-band-quiet', ground: '--candy-band-1' },
  { text: '--candy-band-quiet', ground: '--candy-band-2' },
  { text: '--candy-band-quiet', ground: '--candy-band-3' },
  { text: '--candy-accent-text', ground: '--candy-page' },
  { text: '--candy-accent-text', ground: '--candy-win' },
  { text: '--candy-accent-text', ground: '--candy-chip' },
  { text: '--candy-user-ink', ground: '--candy-user-a' },
  { text: '--candy-user-ink', ground: '--candy-user-b' },
  { text: '--candy-stage-ink', ground: '--candy-card-ink' },
  { text: '--candy-card-ink', ground: '--candy-g1b' },
  { text: '--candy-card-ink', ground: '--candy-g2b' },
  { text: '--candy-card-ink', ground: '--candy-g3b' },
  { text: '--candy-card-ink', ground: '--candy-g1c', min: 3 },
  { text: '--candy-card-ink', ground: '--candy-g2c', min: 3 },
  { text: '--candy-card-ink', ground: '--candy-g3c', min: 3 },
]

const STUDIO_PAIRS: readonly Pair[] = [
  { text: '--foreground', ground: '--background' },
  { text: '--card-foreground', ground: '--card' },
  { text: '--popover-foreground', ground: '--popover' },
  { text: '--primary-foreground', ground: '--primary' },
  { text: '--secondary-foreground', ground: '--secondary' },
  { text: '--muted-foreground', ground: '--background' },
  { text: '--muted-foreground', ground: '--card' },
  { text: '--muted-foreground', ground: '--muted' },
  { text: '--accent-foreground', ground: '--accent' },
  { text: '--destructive-foreground', ground: '--destructive' },
  { text: '--primary', ground: '--background' },
  { text: '--primary', ground: '--card' },
  { text: '--destructive', ground: '--background' },
  { text: '--destructive', ground: '--card' },
  { text: '--fg-3', ground: '--bg-1' },
  { text: '--fg-3', ground: '--paper' },
  { text: '--ring', ground: '--background', min: 3 },
]

/** Every pair check design measures, the design's first. */
export const ALL_PAIRS: readonly Pair[] = [
  ...DESIGN_PAIRS.map(({ text, ground, min }) => (min === undefined ? { text, ground } : { text, ground, min })),
  ...BUILD_PAIRS,
  ...STUDIO_PAIRS,
]

export const AA_TEXT = 4.5
