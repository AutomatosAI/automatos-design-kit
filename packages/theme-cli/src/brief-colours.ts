/**
 * The colours of a brief (PRD-261 B-04a): a brand kit's colour roles as a theme's ground and accent candidates, and
 * the text-on-ground pairs a theme can draw on them, each measured with @automatos/look-kit's WCAG 2.2 contrast math
 * (`contrastRatio`, `readableOnAll`; never a copy).
 *
 * - The page grounds are the kit's `paper`, `surface` and `surface_2` (the page, cards, header fills). The other
 *   ground is whichever of the kit's `ink` and `heading` roles and its three colours (`primary_color`,
 *   `secondary_color`, `text_color`) stands furthest from the page: the dark ground of a light kit.
 * - A ground's tone is light when black reads on it better than white, else dark.
 * - Text on a set of grounds is the kit's own colour when it reads at AA (4.5:1) on every one of them; otherwise it is
 *   look-kit's `readableOnAll`: the colour mixed toward the grounds' body text until it reads, as Play's look runtime
 *   derives its text colours. Body text itself mixes toward black on a light ground and white on a dark one, and one
 *   of the two always reads at 4.5:1 or more (the worst ground, luminance 0.18, gives 4.58:1).
 * - The accent candidates are the kit's `accent` and `accent_2` roles and its `primary_color`, the brand's colour
 *   itself, when that is neither. Each is measured as a fill (3:1, a ring, an icon or a button) on every ground, as
 *   text on each tone's grounds, and with a label on it.
 * - A pair is proposed only when it reads at 4.5:1 or more; any other is listed as not proposed.
 */
import { AA_NON_TEXT, AA_TEXT, contrastRatio, readableOnAll } from '@automatos/look-kit/contrast'
import { hexToTriplet } from '@automatos/look-kit/hsl'
import type { BriefKit, KitColourField, MeasuredRole } from './brief-kit.ts'

export type Tone = 'light' | 'dark'

export interface Ground {
  readonly label: string
  readonly colour: string
  readonly triplet: string
  readonly tone: Tone
  /** The kit field it comes from, such as `palette.paper`. */
  readonly from: string
}

/** A text colour: the kit's own (`kept`), or look-kit's mix of it that reads. */
export interface TextColour {
  readonly colour: string
  readonly kept: boolean
}

export interface Fill {
  readonly ground: string
  readonly ratio: number
}

export interface Accent {
  readonly label: string
  readonly colour: string
  readonly triplet: string
  readonly from: string
  readonly fills: readonly Fill[]
  readonly onPage: TextColour
  readonly onOther: TextColour
  /** A label drawn on the accent as a fill. */
  readonly labelText: TextColour
}

export interface Pair {
  readonly text: string
  readonly colour: string
  readonly ground: string
  readonly groundColour: string
  readonly ratio: number
}

export interface BriefColours {
  readonly page: readonly Ground[]
  readonly other: Ground
  readonly accents: readonly Accent[]
  /** Every pair at 4.5:1 or more, in the brief's order. */
  readonly proposed: readonly Pair[]
  /** Any pair that stayed under 4.5:1 (none, unless a page ground has the other tone). */
  readonly notProposed: readonly Pair[]
}

const BLACK = '#000000'
const WHITE = '#ffffff'
const RATIO_SCALE = 100
/** What each page role is to a theme, in the brief's words (core's ROLE_JOBS, for a theme rather than a document). */
const PAGE_GROUNDS: readonly (readonly [MeasuredRole, string])[] = [['paper', 'page'], ['surface', 'cards'], ['surface_2', 'header fills']]
const OTHER_GROUND_ROLES: readonly MeasuredRole[] = ['ink', 'heading']
const OTHER_GROUND_COLOURS: readonly KitColourField[] = ['primary_color', 'secondary_color', 'text_color']
const BRAND_COLOUR_FIELD: KitColourField = 'primary_color'

/** A ratio as the brief prints it: rounded down to two decimals, so a near miss never reads as the target. */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * RATIO_SCALE) / RATIO_SCALE).toFixed(2)
}

export function toneOf(ground: string): Tone {
  return contrastRatio(BLACK, ground) >= contrastRatio(WHITE, ground) ? 'light' : 'dark'
}

function extremeFor(ground: string): string {
  return toneOf(ground) === 'light' ? BLACK : WHITE
}

/** `colour` as it is when it reads at AA on every ground, else look-kit's mix of it toward `toward` that does. */
export function textOn(colour: string, grounds: readonly string[], toward: string): TextColour {
  if (grounds.every((ground) => contrastRatio(colour, ground) >= AA_TEXT)) return { colour, kept: true }
  return { colour: readableOnAll(colour, grounds, toward).toLowerCase(), kept: false }
}

function sourceOf(kit: BriefKit, role: string): string {
  const source = kit.sources[role]
  return source === undefined ? `palette.${role}` : `palette.${role} (${source})`
}

function ground(label: string, colour: string, from: string): Ground {
  return { label, colour, triplet: hexToTriplet(colour), tone: toneOf(colour), from }
}

/** The kit's ink, heading or own colour furthest from the page, as the other tone's ground. */
function otherGround(kit: BriefKit): Ground {
  const paper = kit.roles.paper
  const candidates = [
    ...OTHER_GROUND_ROLES.map((role) => ({ colour: kit.roles[role], from: sourceOf(kit, role) })),
    ...OTHER_GROUND_COLOURS.flatMap((field) => {
      const colour = kit.kitColours[field]
      return colour === null ? [] : [{ colour, from: field }]
    }),
  ]
  const furthest = candidates.reduce((best, next) => (contrastRatio(next.colour, paper) > contrastRatio(best.colour, paper) ? next : best))
  return ground(`${toneOf(furthest.colour)} ground`, furthest.colour, furthest.from)
}

/** The accent candidates: the accent roles, then the brand's own colour when it is neither. */
function accentSources(kit: BriefKit): { label: string; colour: string; from: string }[] {
  const second = kit.secondAccent === null ? [] : [{ label: 'second accent', colour: kit.secondAccent, from: sourceOf(kit, 'accent_2') }]
  const roles = [{ label: 'accent', colour: kit.roles.accent, from: sourceOf(kit, 'accent') }, ...second]
  const brand = kit.kitColours[BRAND_COLOUR_FIELD]
  if (brand === null || roles.some((role) => role.colour === brand)) return roles
  return [...roles, { label: 'brand colour', colour: brand, from: BRAND_COLOUR_FIELD }]
}

interface Texts {
  readonly body: TextColour
  readonly heading: TextColour
  readonly muted: TextColour
}

function pageTexts(kit: BriefKit, page: readonly string[]): Texts {
  const body = textOn(kit.roles.ink, page, extremeFor(kit.roles.paper))
  return { body, heading: textOn(kit.roles.heading, page, body.colour), muted: textOn(kit.roles.muted, page, body.colour) }
}

function otherTexts(kit: BriefKit, other: string): Texts {
  const body = textOn(kit.roles.paper, [other], extremeFor(other))
  return { body, heading: body, muted: textOn(kit.roles.muted, [other], body.colour) }
}

function accentOf(source: { label: string; colour: string; from: string }, grounds: { page: readonly Ground[]; other: Ground }, bodies: { page: string; other: string }): Accent {
  const all = [...grounds.page, grounds.other]
  const labelColour = [bodies.page, bodies.other]
    .reduce((best, next) => (contrastRatio(next, source.colour) > contrastRatio(best, source.colour) ? next : best))
  return {
    ...source,
    triplet: hexToTriplet(source.colour),
    fills: all.map((item) => ({ ground: item.label, ratio: contrastRatio(source.colour, item.colour) })),
    onPage: textOn(source.colour, grounds.page.map((item) => item.colour), bodies.page),
    onOther: textOn(source.colour, [grounds.other.colour], bodies.other),
    labelText: textOn(labelColour, [source.colour], extremeFor(source.colour)),
  }
}

function pairsOn(text: string, colour: string, grounds: readonly Ground[]): Pair[] {
  return grounds.map((item) => ({ text, colour, ground: item.label, groundColour: item.colour, ratio: contrastRatio(colour, item.colour) }))
}

/** Each tone's body, heading (when it is not the body's colour) and secondary text on that tone's grounds. */
function textPairs(texts: Texts, grounds: readonly Ground[]): Pair[] {
  const headings = texts.heading.colour === texts.body.colour ? [] : pairsOn('headings', texts.heading.colour, grounds)
  return [...pairsOn('body text', texts.body.colour, grounds), ...headings, ...pairsOn('secondary text', texts.muted.colour, grounds)]
}

function accentPairs(accent: Accent, page: readonly Ground[], other: Ground): Pair[] {
  const fill = ground(`${accent.label} fill`, accent.colour, accent.from)
  return [
    ...pairsOn(`${accent.label} as text`, accent.onPage.colour, page),
    ...pairsOn(`${accent.label} as text`, accent.onOther.colour, [other]),
    ...pairsOn(`label on the ${accent.label}`, accent.labelText.colour, [fill]),
  ]
}

/** The brief's grounds, accents and pairs for `kit`. */
export function briefColours(kit: BriefKit): BriefColours {
  const page = PAGE_GROUNDS.map(([role, label]) => ground(label, kit.roles[role], sourceOf(kit, role)))
  const other = otherGround(kit)
  const onPage = pageTexts(kit, page.map((item) => item.colour))
  const onOther = otherTexts(kit, other.colour)
  const bodies = { page: onPage.body.colour, other: onOther.body.colour }
  const accents = accentSources(kit).map((source) => accentOf(source, { page, other }, bodies))
  const pairs = [
    ...textPairs(onPage, page),
    ...textPairs(onOther, [other]),
    ...accents.flatMap((accent) => accentPairs(accent, page, other)),
  ]
  return {
    page,
    other,
    accents,
    proposed: pairs.filter((pair) => pair.ratio >= AA_TEXT),
    notProposed: pairs.filter((pair) => pair.ratio < AA_TEXT),
  }
}

/** True when a fill reads as a non-text mark (a ring, an icon, a button's edge) on its ground: 3:1. */
export function fillReads(fill: Fill): boolean {
  return fill.ratio >= AA_NON_TEXT
}
