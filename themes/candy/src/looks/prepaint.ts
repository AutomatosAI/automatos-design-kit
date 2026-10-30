import {
  AUTO_COLOURS,
  CARD_INK,
  CARD_SETS,
  DANGER,
  LAYER_COLOURS,
  PALETTES,
  SHARED_COLOURS,
  type Palette,
  type PaletteColours,
} from './catalogue'
import { tripletOf } from './colour'
import { kebab } from './names'
import { KNOBS, knobDefaults } from './spec'

/**
 * boot/prepaint.json as data: what the host paints on <html> before any theme code runs, for every value of every
 * knob. The palette paints Candy's own variables (--candy-*), Auto's colours and Studio's tokens as `H S% L%`
 * triplets, so the host's own pages inside the frame take the palette too. Three things depend on two knobs at once,
 * so they are pair tables: the card gradients (the palette's order, or its first gradient on every card with One
 * colour), and the band and the page's aura (the palette's stops, as Soft, Rich or Vivid draws them). The Gradient
 * knob paints the card's layers (its highlight, its glows, where its middle stop sits), Motion the play state of
 * every loop, and Glow the shadows' tint as a numeric rule. Roundness is the one knob the table can't paint (a
 * number in px): the frame sets it from the look (src/frame/look-vars.ts), over the stylesheet's default.
 * test/look-data.test.ts writes the file from this and holds it equal.
 */

type Vars = Readonly<Record<string, string>>
type Table = Readonly<Record<string, Readonly<Record<string, Vars>>>>

const UI_VARIABLES: Readonly<Record<Exclude<keyof PaletteColours, 'blobs' | 'tint'>, string>> = {
  page: '--candy-page', bandA: '--candy-band-a', bandB: '--candy-band-b', band1: '--candy-band-1',
  band2: '--candy-band-2', band3: '--candy-band-3', win: '--candy-win', chip: '--candy-chip', text: '--candy-text',
  quiet: '--candy-quiet', line: '--candy-line', border: '--candy-border', bandQuiet: '--candy-band-quiet',
  accent: '--candy-accent', accentInk: '--candy-accent-ink', accentText: '--candy-accent-text',
  userA: '--candy-user-a', userB: '--candy-user-b', userInk: '--candy-user-ink', stageInk: '--candy-stage-ink',
}

/** The palette's own colours, its shadow tints (the glow's fixed .04 layer, and the search field's .14) and white. */
function uiVars(colours: PaletteColours): Vars {
  const named = Object.entries(UI_VARIABLES).map(([key, name]) => [name, colours[key as keyof typeof UI_VARIABLES]])
  const tints = [['--candy-glow-base', `rgba(${colours.tint},.04)`], ['--candy-tint', `rgba(${colours.tint},.14)`]]
  return Object.fromEntries([...named, ...tints, ['--candy-card-ink', CARD_INK]])
}

function sharedVars(): Vars {
  return Object.fromEntries(Object.entries(SHARED_COLOURS).map(([key, colour]) => [`--candy-${kebab(key)}`, colour]))
}

function autoVars(): Vars {
  return Object.fromEntries(Object.entries(AUTO_COLOURS).map(([key, colour]) => [`--candy-auto-${kebab(key)}`, colour]))
}

/**
 * Studio's colour tokens from the palette, as triplets: the page and its text, the windows as cards and popovers,
 * the chip as the quiet grounds and the hover, the accent's text colour (which reads on every ground) as primary
 * and ring, a red of Candy's own as destructive and the opaque hairline as Studio's borders. Studio's own variables
 * (--paper, --bg-1 and the rest) take the same.
 */
function studioVars({ colours, tone }: Palette): Vars {
  const t = tripletOf
  const danger = DANGER[tone]
  return {
    '--background': t(colours.page), '--foreground': t(colours.text),
    '--background-gradient-from': t(colours.page), '--background-gradient-to': t(colours.page),
    '--card': t(colours.win), '--card-foreground': t(colours.text),
    '--popover': t(colours.win), '--popover-foreground': t(colours.text),
    '--secondary': t(colours.chip), '--secondary-foreground': t(colours.text),
    '--muted': t(colours.chip), '--muted-foreground': t(colours.quiet),
    '--primary': t(colours.accentText), '--primary-foreground': t(colours.accentInk), '--ring': t(colours.accentText),
    '--accent': t(colours.chip), '--accent-foreground': t(colours.text),
    '--destructive': t(danger.fill), '--destructive-foreground': t(danger.ink),
    '--border': t(colours.border), '--input': t(colours.border),
    '--glass-border-hover': t(colours.border), '--cc-hover': t(colours.chip), '--cc-hover-border': t(colours.border),
    '--paper': `hsl(${t(colours.win)})`, '--bg-1': `hsl(${t(colours.page)})`, '--bg-2': `hsl(${t(colours.win)})`,
    '--fg': `hsl(${t(colours.text)})`, '--fg-2': `hsl(${t(colours.quiet)})`, '--fg-3': `hsl(${t(colours.quiet)})`,
    '--border-2': `hsl(${t(colours.quiet)})`,
  }
}

function paletteTable(): Table[string] {
  return Object.fromEntries(
    PALETTES.map((palette) => [palette.id, { ...uiVars(palette.colours), ...sharedVars(), ...autoVars(), ...studioVars(palette) }]),
  )
}

/** The three card gradients' stops, --candy-g1a to --candy-g3c, for a palette with Mixed or One colour cards. */
function cardVars(palette: Palette, cards: string): Vars {
  const order = cards === 'single' ? [palette.order[0], palette.order[0], palette.order[0]] : palette.order
  return Object.fromEntries(
    order.flatMap((setId, index) => {
      const set = CARD_SETS[setId]
      return [[`--candy-g${index + 1}a`, set.a], [`--candy-g${index + 1}b`, set.b], [`--candy-g${index + 1}c`, set.c]]
    }),
  )
}

function cardTable(): Table {
  return Object.fromEntries(
    PALETTES.map((palette) => [palette.id, { mix: cardVars(palette, 'mix'), single: cardVars(palette, 'single') }]),
  )
}

/** The band behind the top of a page: two stops of one hue on Soft, three on Rich and Vivid. */
function bandOf({ colours }: Palette, gradient: string): string {
  if (gradient === 'soft') return `linear-gradient(160deg,${colours.bandA},${colours.bandB})`
  return `linear-gradient(120deg,${colours.band1} 0%,${colours.band2} 52%,${colours.band3} 100%)`
}

/** The page's ground: the page colour, under three blurred blobs of colour on Vivid. */
function auraOf({ colours }: Palette, gradient: string): string {
  if (gradient !== 'vivid') return colours.page
  const [one, two, three] = colours.blobs
  return [
    `radial-gradient(55% 45% at 88% 0%,${one} 0%,transparent 70%)`,
    `radial-gradient(45% 40% at 100% 45%,${two} 0%,transparent 70%)`,
    `radial-gradient(50% 50% at 10% 100%,${three} 0%,transparent 70%)`,
    colours.page,
  ].join(',')
}

const GRADIENTS = ['soft', 'rich', 'vivid'] as const

function groundTable(): Table {
  return Object.fromEntries(
    PALETTES.map((palette) => [
      palette.id,
      Object.fromEntries(
        GRADIENTS.map((gradient) => [gradient, { '--candy-band': bandOf(palette, gradient), '--candy-aura': auraOf(palette, gradient) }]),
      ),
    ]),
  )
}

/** A card's layers over its linear gradient: the white highlight, the corner glows (Vivid) and the middle stop. */
const { highlight, highlightVivid, glowPink, glowCyan } = LAYER_COLOURS
const GRADIENT_LAYERS: Table[string] = {
  soft: {
    '--candy-card-hi': `radial-gradient(circle at 88% 8%,${highlight},transparent 46%)`,
    '--candy-card-glow': 'none',
    '--candy-card-mid': '100%',
  },
  rich: {
    '--candy-card-hi': `radial-gradient(circle at 88% 8%,${highlight},transparent 46%)`,
    '--candy-card-glow': 'none',
    '--candy-card-mid': '55%',
  },
  vivid: {
    '--candy-card-hi': `radial-gradient(circle at 92% 0%,${highlightVivid},transparent 50%)`,
    '--candy-card-glow': `radial-gradient(circle at 0% 100%,${glowPink},transparent 55%),radial-gradient(circle at 100% 100%,${glowCyan},transparent 50%)`,
    '--candy-card-mid': '55%',
  },
}

/** Every loop's play state: Motion paused stops them all, as the Pause control does. */
const MOTION: Table[string] = {
  on: { '--candy-play': 'running' },
  paused: { '--candy-play': 'paused' },
}

/** Glow: the shadows' tint at glow / GLOW_SCALE, over the stylesheet's fixed .04 layer (0.04 + glow × 0.03). */
export const GLOW_SCALE = 33

function glowRule() {
  const glow = KNOBS.find((knob) => knob.name === 'glow')
  if (glow?.kind !== 'number') throw new TypeError('The glow knob is a number knob.')
  return {
    var: '--candy-glow',
    knob: 'glow',
    min: glow.min,
    max: glow.max,
    integer: true,
    scale: GLOW_SCALE,
    capTable: null,
    caps: null,
    color: { knob: 'palette', rgb: Object.fromEntries(PALETTES.map((palette) => [palette.id, palette.colours.tint])) },
    template: 'rgba-alpha',
  }
}

export interface PrepaintTable {
  readonly knobs: Table
  readonly pairs: readonly { readonly a: string; readonly b: string; readonly table: Table }[]
  readonly numeric: readonly ReturnType<typeof glowRule>[]
  readonly defaults: Readonly<Record<string, string | number>>
  readonly tone: { readonly knob: string; readonly values: Readonly<Record<string, 'light' | 'dark'>> }
}

export function buildPrepaint(): PrepaintTable {
  return {
    knobs: {
      palette: paletteTable(),
      cards: { mix: {}, single: {} },
      gradient: GRADIENT_LAYERS,
      motion: MOTION,
    },
    pairs: [
      { a: 'palette', b: 'cards', table: cardTable() },
      { a: 'palette', b: 'gradient', table: groundTable() },
    ],
    numeric: [glowRule()],
    defaults: knobDefaults(),
    tone: { knob: 'palette', values: Object.fromEntries(PALETTES.map((palette) => [palette.id, palette.tone])) },
  }
}

/** looks/schema.json as data. */
export function buildSchema(schema: string, lookInterface: string) {
  return {
    schema: 'automatos-look-schema/v1',
    look: { schema, interface: lookInterface },
    knobs: Object.fromEntries(
      KNOBS.map((knob) => [
        knob.name,
        knob.kind === 'choice'
          ? { kind: 'choice', label: knob.label, choices: knob.choices.map((choice) => choice.key), default: knob.default }
          : { kind: 'number', label: knob.label, min: knob.min, max: knob.max, integer: true, default: knob.default },
      ]),
    ),
  }
}
