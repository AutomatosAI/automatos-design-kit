/**
 * What the server answers a phone for a theme: core's GET /api/themes/mobile/{install_id} `mobile` field, built
 * from the theme's own files with no database. A port of orchestrator/services/themes/mobile.py `_mobile_block`
 * (:174-:185) at the commit src/core/README.md names, for the harness's phone view and the theme CLI:
 *
 *   {source: 'tokens' | 'fromLooks', tone: 'light' | 'dark' | null, tokens: {light, dark},
 *    fonts: {sans | serif | mono: URL}, mascot: {mode, states: [{name, clip, still}]}}
 *
 * - `tokens` (`_block_colours` :111-:115): the block's own schemes exactly as theme.json writes them, a scheme it
 *   leaves out null, and tone null: the phone follows the device.
 * - `fromLooks` (`_look_colours` :142-:159): the member's look (here the one given; null for none) painted as the
 *   web's first paint paints it (mobile-paint.ts `paintLook`), placed under the tone `lookTone` gives it, the other
 *   scheme null. A look whose painting gives no --background or --foreground is replaced by the defaults
 *   (`_phone_look` :132-:139); defaults that paint neither give no answer (null), as no table does.
 * - Files (`_file_url` :80-:86, `_fonts` :89-:93, `_mascot` :101-:108): a URL only for a path the package holds and
 *   never for code; a font for each role the block names; for `clips` and `stills` each top-level `mascot.states`
 *   name's still (`assets/mascot/<name>.png`), and under `clips` its clip (`<name>.mp4`); `none` gives no states.
 *   `url` is the caller's: core's files route, or the harness's own files root.
 *
 * Null for a theme.json with no block, or a block that can't paint (no source, or nothing painted). Who may see the
 * answer, the private-code opt-in and revocation are the server's, and play no part here. Nothing here throws.
 */
import { isRecord, own, type JsonRecord } from './core/css-value.ts'
import { MOBILE_FONT_ROLES } from './core/mobile-manifest.ts'
import { lookTone, missingTokens, paintLook, type PhoneTone } from './mobile-paint.ts'

export const SOURCE_TOKENS = 'tokens'
export const SOURCE_LOOKS = 'fromLooks'
export const MASCOT_CLIPS = 'clips'
export const MASCOT_STILLS = 'stills'
export const MASCOT_NONE = 'none'
/** mobile.py MASCOT_DIR, CLIP_SUFFIX and STILL_SUFFIX: a state's files. */
export const MASCOT_DIR = 'assets/mascot/'
export const CLIP_SUFFIX = '.mp4'
export const STILL_SUFFIX = '.png'
/** mobile.py CODE_SUFFIXES: the phone never receives a code URL. */
const CODE_SUFFIXES: readonly string[] = ['.js', '.mjs', '.css']
const MOBILE_FIELD = 'mobile'
const SCHEMES = ['light', 'dark'] as const

export type MobileSource = typeof SOURCE_TOKENS | typeof SOURCE_LOOKS
export type MascotMode = typeof MASCOT_CLIPS | typeof MASCOT_STILLS | typeof MASCOT_NONE
export type FontRole = 'sans' | 'serif' | 'mono'
/** One scheme's colours by Studio token name, as the answer carries them (not yet read by the phone). */
export type AnswerScheme = Readonly<Record<string, unknown>>

export interface AnswerState {
  readonly name: string
  readonly clip: string | null
  readonly still: string | null
}

export interface MobileAnswer {
  readonly source: MobileSource
  readonly tone: PhoneTone | null
  readonly tokens: { readonly light: AnswerScheme | null; readonly dark: AnswerScheme | null }
  readonly fonts: Readonly<Partial<Record<FontRole, string>>>
  readonly mascot: { readonly mode: MascotMode; readonly states: readonly AnswerState[] }
}

/** The theme's files as the answer reads them. */
export interface AnswerFiles {
  /** boot/prepaint.json's JSON, or null when the theme has none. */
  readonly prepaint: unknown
  /** True when the theme holds a file at `path` (core: the package's file manifest lists it). */
  readonly has: (path: string) => boolean
  /** The URL a phone loads `path` from (core: serve.module_url; the harness: its files root). */
  readonly url: (path: string) => string
}

type Colours = Pick<MobileAnswer, 'source' | 'tone' | 'tokens'>

/** `_file_url`: the URL of a data file the theme holds, else null. */
function fileUrl(files: AnswerFiles, path: string): string | null {
  const code = CODE_SUFFIXES.some((suffix) => path.toLowerCase().endsWith(suffix))
  return !code && files.has(path) ? files.url(path) : null
}

/** `_fonts`: `{role: URL}` for each font role the block declares whose file the theme holds. */
function fontsOf(block: JsonRecord, files: AnswerFiles): MobileAnswer['fonts'] {
  const declared = own(block, 'fonts')
  const entries = Object.entries(isRecord(declared) ? declared : {}).flatMap(([role, path]): [string, string][] => {
    const url = MOBILE_FONT_ROLES.includes(role) && typeof path === 'string' ? fileUrl(files, path) : null
    return url === null ? [] : [[role, url]]
  })
  return Object.fromEntries(entries) as MobileAnswer['fonts']
}

const showsAuto = (mode: unknown): mode is typeof MASCOT_CLIPS | typeof MASCOT_STILLS => (
  mode === MASCOT_CLIPS || mode === MASCOT_STILLS
)

/** `_mascot`: the mode, and each top-level `mascot.states` name's clip (clips only) and still. */
function mascotOf(manifest: JsonRecord, block: JsonRecord, files: AnswerFiles): MobileAnswer['mascot'] {
  const mode = own(block, 'mascot')
  if (!showsAuto(mode)) return { mode: MASCOT_NONE, states: [] }
  const mascot = own(manifest, 'mascot')
  const states = isRecord(mascot) ? own(mascot, 'states') : undefined
  const names = Array.isArray(states) ? states.filter((name): name is string => typeof name === 'string') : []
  return {
    mode,
    states: names.map((name) => ({
      name,
      clip: mode === MASCOT_CLIPS ? fileUrl(files, `${MASCOT_DIR}${name}${CLIP_SUFFIX}`) : null,
      still: fileUrl(files, `${MASCOT_DIR}${name}${STILL_SUFFIX}`),
    })),
  }
}

/** `_block_colours`: the block's schemes as written; tone null. */
function blockColours(block: JsonRecord): Colours {
  const given = own(block, SOURCE_TOKENS)
  const schemes: JsonRecord = isRecord(given) ? given : {}
  const scheme = (name: string): AnswerScheme | null => {
    const values = own(schemes, name)
    return isRecord(values) ? { ...values } : null
  }
  return { source: SOURCE_TOKENS, tone: null, tokens: { light: scheme('light'), dark: scheme('dark') } }
}

/** `_look_colours`: the look (its defaults when it paints no ground or text) painted under its tone; null for nothing. */
function lookColours(manifest: JsonRecord, files: AnswerFiles, look: unknown): Colours | null {
  const kept = look !== null && missingTokens(paintLook(files.prepaint, look)).length > 0 ? null : look
  const painted = paintLook(files.prepaint, kept)
  if (missingTokens(painted).length > 0) return null
  const tone = lookTone(files.prepaint, kept, own(manifest, 'tone'))
  const tokens = Object.fromEntries(SCHEMES.map((scheme) => [scheme, scheme === tone ? painted : null]))
  return { source: SOURCE_LOOKS, tone, tokens: { light: tokens.light ?? null, dark: tokens.dark ?? null } }
}

/** The theme's `mobile` answer for `look` (the member's look; null for none), or null (module comment). */
export function mobileAnswer(manifest: unknown, files: AnswerFiles, look: unknown = null): MobileAnswer | null {
  const document: JsonRecord = isRecord(manifest) ? manifest : {}
  const block = own(document, MOBILE_FIELD)
  if (!isRecord(block)) return null
  let colours: Colours | null = null
  if (Object.prototype.hasOwnProperty.call(block, SOURCE_TOKENS)) colours = blockColours(block)
  else if (own(block, SOURCE_LOOKS) === true) colours = lookColours(document, files, look)
  if (colours === null) return null
  return { ...colours, fonts: fontsOf(block, files), mascot: mascotOf(document, block, files) }
}
