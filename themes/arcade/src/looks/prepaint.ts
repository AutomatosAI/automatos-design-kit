import {
  AGENT_COLOURS,
  ICON_COLOURS,
  ICON_KEYS,
  PALETTES,
  SCAN_ALPHA,
  SCAN_INK,
  SPRITE_COLOURS,
  SPRITE_KEYS,
  type Palette,
  type PaletteColours,
  type ScanlineId,
} from './catalogue'
import { tripletOf } from './colour'
import { KNOBS, knobDefaults } from './spec'

/**
 * boot/prepaint.json as data: what the host paints on <html> before any theme code runs, for every choice of every
 * knob. The palette paints Arcade's own variables (--arcade-*), its art's colours and Studio's tokens as `H S% L%`
 * triplets, so the host's own pages inside the frame take the palette too. Scanlines, pixel scale, window style and
 * text speed paint the numbers the stylesheet composes; the scanlines' colour depends on the palette's tone and the
 * scanline style together, so it is a pair table. test/look-data.test.ts writes the file from this and holds it equal.
 */

type Vars = Readonly<Record<string, string>>

/** The design's token names as Arcade's custom properties. */
const UI_VARIABLES: Readonly<Record<keyof PaletteColours, string>> = {
  page: '--arcade-page', win: '--arcade-win', bar: '--arcade-bar', barTx: '--arcade-bar-tx', tx: '--arcade-tx',
  tx2: '--arcade-tx2', bd: '--arcade-bd', ac: '--arcade-ac', aci: '--arcade-aci', hl: '--arcade-hl', hlt: '--arcade-hlt',
  hp: '--arcade-hp', xp: '--arcade-xp', mp: '--arcade-mp', qs: '--arcade-qs', sh: '--arcade-sh', bevl: '--arcade-bevl',
  bevd: '--arcade-bevd',
}

function uiVars(colours: PaletteColours): Vars {
  return Object.fromEntries(Object.entries(UI_VARIABLES).map(([key, name]) => [name, colours[key as keyof PaletteColours]]))
}

function artVars(palette: Palette): Vars {
  const sprite = SPRITE_KEYS.map((key) => [`--arcade-sp-${key}`, SPRITE_COLOURS[palette.art][key]])
  const icons = ICON_KEYS.map((key) => [`--arcade-ic-${key}`, ICON_COLOURS[palette.art][key]])
  const agents = AGENT_COLOURS[palette.art].flatMap(([body, shade], index) => [
    [`--arcade-ag${index + 1}`, body],
    [`--arcade-ag${index + 1}-d`, shade],
  ])
  const map = Object.entries(palette.map).map(([key, colour]) => [`--arcade-map-${key}`, colour])
  return Object.fromEntries([...sprite, ...icons, ...agents, ...map])
}

/**
 * Studio's colour tokens from the palette, as triplets: the page and its text, the windows as cards, popovers and
 * the quiet grounds, the accent as primary and ring, the menu's highlight as accent, HP red as destructive and the
 * window border as Studio's borders. Studio's own variables (--paper, --bg-1 and the rest) take the same colours.
 */
function studioVars({ colours, tone }: Palette): Vars {
  const t = tripletOf
  const onRed = tone === 'dark' ? colours.page : colours.win
  return {
    '--background': t(colours.page), '--foreground': t(colours.tx),
    '--background-gradient-from': t(colours.page), '--background-gradient-to': t(colours.page),
    '--card': t(colours.win), '--card-foreground': t(colours.tx),
    '--popover': t(colours.win), '--popover-foreground': t(colours.tx),
    '--secondary': t(colours.win), '--secondary-foreground': t(colours.tx),
    '--muted': t(colours.win), '--muted-foreground': t(colours.tx2),
    '--primary': t(colours.ac), '--primary-foreground': t(colours.aci), '--ring': t(colours.ac),
    '--accent': t(colours.hl), '--accent-foreground': t(colours.hlt),
    '--destructive': t(colours.hp), '--destructive-foreground': t(onRed),
    '--border': t(colours.bd), '--input': t(colours.bd),
    '--glass-border-hover': t(colours.bd), '--cc-hover': t(colours.win), '--cc-hover-border': t(colours.bd),
    '--paper': `hsl(${t(colours.win)})`, '--bg-1': `hsl(${t(colours.page)})`, '--bg-2': `hsl(${t(colours.win)})`,
    '--fg': `hsl(${t(colours.tx)})`, '--fg-2': `hsl(${t(colours.tx2)})`, '--fg-3': `hsl(${t(colours.tx2)})`,
    '--border-2': `hsl(${t(colours.tx2)})`,
  }
}

function paletteTable(): Readonly<Record<string, Vars>> {
  return Object.fromEntries(
    PALETTES.map((palette) => [palette.id, { ...uiVars(palette.colours), ...artVars(palette), ...studioVars(palette) }]),
  )
}

const SCANLINE_SHAPES: Readonly<Record<ScanlineId, Vars>> = {
  off: { '--arcade-scan-line': '0px', '--arcade-scan-period': '3px' },
  soft: { '--arcade-scan-line': '1px', '--arcade-scan-period': '3px' },
  strong: { '--arcade-scan-line': '2px', '--arcade-scan-period': '4px' },
}

const WINDOW_STYLES: Readonly<Record<string, Vars>> = {
  classic: {
    '--arcade-bevel': '1px', '--arcade-ring2': '4px', '--arcade-ring3': '6px', '--arcade-drop': '6px', '--arcade-spread': '6px',
  },
  thin: {
    '--arcade-bevel': '0px', '--arcade-ring2': '2px', '--arcade-ring3': '2px', '--arcade-drop': '4px', '--arcade-spread': '2px',
  },
}

const PIXEL_SCALES: Readonly<Record<string, Vars>> = { 2: { '--arcade-px': '2' }, 3: { '--arcade-px': '3' } }

/** Ticks per character in the dialogue box (0: the whole line at once), for the style sheet to show. */
const TEXT_SPEEDS: Readonly<Record<string, Vars>> = {
  instant: { '--arcade-type-ticks': '0' },
  normal: { '--arcade-type-ticks': '1' },
  slow: { '--arcade-type-ticks': '3' },
}

function scanColour(palette: Palette, scanlines: ScanlineId): string {
  const alpha = SCAN_ALPHA[palette.tone][scanlines]
  return alpha === 0 ? 'transparent' : `rgba(${SCAN_INK[palette.tone]},${alpha})`
}

function scanPairTable(): Readonly<Record<string, Readonly<Record<string, Vars>>>> {
  const styles: readonly ScanlineId[] = ['off', 'soft', 'strong']
  return Object.fromEntries(
    PALETTES.map((palette) => [
      palette.id,
      Object.fromEntries(styles.map((style) => [style, { '--arcade-scan-color': scanColour(palette, style) }])),
    ]),
  )
}

export interface PrepaintTable {
  readonly knobs: Readonly<Record<string, Readonly<Record<string, Vars>>>>
  readonly pairs: readonly { readonly a: string; readonly b: string; readonly table: Readonly<Record<string, Readonly<Record<string, Vars>>>> }[]
  readonly numeric: readonly never[]
  readonly defaults: Readonly<Record<string, string>>
  readonly tone: { readonly knob: string; readonly values: Readonly<Record<string, 'light' | 'dark'>> }
}

export function buildPrepaint(): PrepaintTable {
  return {
    knobs: {
      palette: paletteTable(),
      scanlines: SCANLINE_SHAPES,
      pixelScale: PIXEL_SCALES,
      windowStyle: WINDOW_STYLES,
      textSpeed: TEXT_SPEEDS,
    },
    pairs: [{ a: 'palette', b: 'scanlines', table: scanPairTable() }],
    numeric: [],
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
        { kind: 'choice', label: knob.label, choices: knob.choices.map((choice) => choice.key), default: knob.default },
      ]),
    ),
  }
}
