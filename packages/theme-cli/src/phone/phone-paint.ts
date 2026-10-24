/**
 * An installed theme's painting on Automatos Go's Studio layout, from the server's answer (mobile-answer.ts). A port
 * of the app's src/styles/themes/paint.ts `themePaint` (:216-:237) and `paintScheme` (:240-:246), with the thread's
 * boxes (src/styles/tokens/thread.ts `threadPaint` :15-:25) and a token at an alpha (src/ui/paint.ts `tint` :18-:28),
 * at the Automatos Go commit the package README's "The phone's model" names:
 *
 * - only the 24 MOBILE_TOKEN_NAMES are read, each value an 'H S% L%' triplet or a #rrggbb (`parseColour`, the app's
 *   `themeColour` :86-:94 for every value core's check lets through); anything else is dropped;
 * - a scheme without --background and --foreground is not painted; the theme's colours lie over that scheme's
 *   Studio colours under Studio's names (`overStudio` :138-:143), so the three the Studio layout has no colour for
 *   (--background-gradient-from, --background-gradient-to, --glass-border-hover) are dropped and every colour the
 *   theme leaves out keeps Studio's; a scheme the theme leaves out holds the other's (`colours` :174-:189);
 * - the tone: the answer's, when that scheme is painted; under fromLooks the painted one; else null, and the
 *   user's Light / Dark picks (`fixedTone` :157-:161);
 * - fonts as answered; the mascot only for clips or stills with a state that has a file (`mascotOf` :199-:211).
 *
 * Null when neither scheme can be painted: the phone does not offer the theme and draws Studio. Pure.
 */
import { mixHex } from '@automatos/look-kit/contrast'
import { MOBILE_TOKEN_NAMES } from '../core/mobile-manifest.ts'
import type { AnswerScheme, AnswerState, MobileAnswer } from '../mobile-answer.ts'
import { parseColour } from '../mobile-paint.ts'
import { isStudioColour, STUDIO_COLOURS, tokenName, type ColourScheme, type StudioColours } from './studio-colours.ts'

const REQUIRED = ['--background', '--foreground'] as const
const SCHEMES: readonly ColourScheme[] = ['light', 'dark']
/** thread.ts USER_TINT: the web's /10 on --primary (bg-primary/10, border-primary/10). */
export const USER_TINT = 0.1
const HEX = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/
const ALPHA_MAX = 255
const HEX_BASE = 16

export type StudioDefaults = Readonly<Record<ColourScheme, StudioColours>>

export interface PhoneMascot {
  readonly mode: 'clips' | 'stills'
  readonly states: readonly AnswerState[]
}

export interface PhonePaint {
  readonly colours: Readonly<Record<ColourScheme, StudioColours>>
  /** The scheme the painting fixes (fromLooks), or null to follow the user's Light / Dark. */
  readonly tone: ColourScheme | null
  /** The '--' tokens the theme painted in each scheme (the rest are Studio's); null for a scheme it left out. */
  readonly themed: Readonly<Record<ColourScheme, readonly string[] | null>>
  readonly fonts: MobileAnswer['fonts']
  readonly mascot: PhoneMascot | null
}

/** The chat thread's boxes and Auto's disc (thread.ts ThreadPaint), opaque, as the web composites them. */
export interface ThreadPaint {
  readonly autoFill: string
  readonly autoBorder: string
  readonly userFill: string
  readonly userBorder: string
  readonly avatar: string
  readonly sail: string
}

type SchemeValues = Readonly<Record<string, string>>

/** `readValues` (:97-:108): the scheme's readable values under their '--' names, as #RRGGBB. */
function readValues(tokens: AnswerScheme): SchemeValues {
  const entries = Object.entries(tokens).flatMap(([name, value]): [string, string][] => {
    const colour = MOBILE_TOKEN_NAMES.includes(name) ? parseColour(value) : null
    return colour === null ? [] : [[name, colour]]
  })
  return Object.freeze(Object.fromEntries(entries))
}

/** `readSchemes` (:147-:154): each scheme the theme gives, when it paints a ground and its text. */
function readSchemes(answer: MobileAnswer): Readonly<Record<ColourScheme, SchemeValues | null>> {
  const read = (scheme: ColourScheme): SchemeValues | null => {
    const tokens = answer.tokens[scheme]
    const values = tokens ? readValues(tokens) : null
    return values !== null && REQUIRED.every((name) => name in values) ? values : null
  }
  return { light: read('light'), dark: read('dark') }
}

/** `overStudio`: the scheme's Studio colours with the theme's laid over them, under Studio's names. */
export function overStudio(values: SchemeValues, studio: StudioColours): StudioColours {
  const overlay = Object.entries(values)
    .map(([key, value]): [string, string] => [tokenName(key), value])
    .filter(([name]) => isStudioColour(name))
  return Object.freeze({ ...studio, ...Object.fromEntries(overlay) })
}

/** The painting for this answer, or null when it can't be painted (module comment). */
export function phonePaint(answer: MobileAnswer | null, studio: StudioDefaults = STUDIO_COLOURS): PhonePaint | null {
  if (answer === null) return null
  const schemes = readSchemes(answer)
  if (schemes.light === null && schemes.dark === null) return null
  const painted = (scheme: ColourScheme): StudioColours | null => {
    const values = schemes[scheme]
    return values === null ? null : overStudio(values, studio[scheme])
  }
  const [light, dark] = [painted('light'), painted('dark')]
  const tone = answer.tone !== null && schemes[answer.tone] !== null
    ? answer.tone
    : answer.source === 'fromLooks' ? (schemes.light !== null ? 'light' : 'dark') : null
  const shown = answer.mascot.states.filter((state) => state.clip !== null || state.still !== null)
  const mode = answer.mascot.mode
  return Object.freeze({
    colours: Object.freeze({ light: light ?? dark ?? studio.light, dark: dark ?? light ?? studio.dark }),
    tone,
    themed: Object.freeze({ light: themedNames(schemes.light), dark: themedNames(schemes.dark) }),
    fonts: answer.fonts,
    mascot: mode !== 'none' && shown.length > 0 ? Object.freeze({ mode, states: shown }) : null,
  })
}

function themedNames(values: SchemeValues | null): readonly string[] | null {
  return values === null ? null : Object.freeze(Object.keys(values))
}

/** The scheme a painting shows: its fixed tone, else the user's Light / Dark. */
export function paintScheme(paint: Pick<PhonePaint, 'tone'> | null, chosen: ColourScheme): ColourScheme {
  return paint?.tone ?? chosen
}

/** The colours drawn for the scheme the user chose: the painting's, or Studio's own without one. */
export function shownColours(
  paint: PhonePaint | null, chosen: ColourScheme, studio: StudioDefaults = STUDIO_COLOURS,
): StudioColours {
  const scheme = paintScheme(paint, chosen)
  return paint === null ? studio[scheme] : paint.colours[scheme]
}

/** `threadPaint`: Auto's box a card, the user's box primary at 10 % over the page, the avatar the accent disc. */
export function threadPaint(colours: StudioColours, sail: string = STUDIO_COLOURS.light.onStrong): ThreadPaint {
  const userFill = mixHex(colours.background, colours.primary, USER_TINT)
  return Object.freeze({
    autoFill: colours.card,
    autoBorder: colours.border,
    userFill,
    userBorder: mixHex(userFill, colours.primary, USER_TINT),
    avatar: colours.accent,
    sail,
  })
}

/** `tint`: a token colour at an alpha (the web's var(--x) / a), as #RRGGBBAA; an alpha the token has multiplies. */
export function tint(hex: string, alpha: number): string {
  const match = HEX.exec(hex)
  if (!match) throw new RangeError(`${hex} isn't a #RRGGBB or #RRGGBBAA token colour`)
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`${alpha} isn't an alpha from 0 to 1`)
  const own = match[2] === undefined ? 1 : parseInt(match[2], HEX_BASE) / ALPHA_MAX
  const byte = Math.round(alpha * own * ALPHA_MAX).toString(HEX_BASE).padStart(2, '0').toUpperCase()
  return `#${match[1]}${byte}`
}

/** Each scheme in order, for callers that list both. */
export const PHONE_SCHEMES: readonly ColourScheme[] = SCHEMES
