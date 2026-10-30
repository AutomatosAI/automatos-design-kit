/**
 * The colour pairs Arcade must keep readable, in every preset: the design's own list (looks.json "contrastPairs",
 * which the Sprite gallery shows for the active look), then the pairs the build adds where it draws a colour on a
 * ground the design didn't list (the accent and the border on a window, the text on the page, where the host's AI
 * label sits) and Studio's tokens, which recolour the host's pages. design/contrast.json is written from this list
 * (test/look-data.test.ts) and `automatos-theme check design` measures every pair on every preset.
 */

export interface Pair {
  readonly text: string
  readonly ground: string
  /** 4.5 for text (the default), 3 for a border, a ring or an icon. */
  readonly min?: number
}

export interface LabelledPair extends Pair {
  readonly label: string
}

export const DESIGN_PAIRS: readonly LabelledPair[] = [
  { label: 'Running text / window', text: '--arcade-tx', ground: '--arcade-win' },
  { label: 'Secondary text / window', text: '--arcade-tx2', ground: '--arcade-win' },
  { label: 'Status bar labels / bar', text: '--arcade-bar-tx', ground: '--arcade-bar' },
  { label: 'Accent as text / page', text: '--arcade-ac', ground: '--arcade-page' },
  { label: 'HP red / window', text: '--arcade-hp', ground: '--arcade-win' },
  { label: 'XP gold / window', text: '--arcade-xp', ground: '--arcade-win' },
  { label: 'Mana blue / window', text: '--arcade-mp', ground: '--arcade-win' },
  { label: 'Quest yellow / window', text: '--arcade-qs', ground: '--arcade-win' },
  { label: 'Selected menu / highlight', text: '--arcade-hlt', ground: '--arcade-hl' },
  { label: 'Accent ink / accent button', text: '--arcade-aci', ground: '--arcade-ac' },
  { label: 'Window border / page', text: '--arcade-bd', ground: '--arcade-page', min: 3 },
]

const BUILD_PAIRS: readonly Pair[] = [
  { text: '--arcade-tx', ground: '--arcade-page' },
  { text: '--arcade-tx2', ground: '--arcade-page' },
  { text: '--arcade-ac', ground: '--arcade-win' },
  { text: '--arcade-bd', ground: '--arcade-win', min: 3 },
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
