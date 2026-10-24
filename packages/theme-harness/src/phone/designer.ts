/**
 * The skin designer's model (app/phone/designer/): a draft of a theme's `mobile` block, which the phone view paints and
 * measures as it changes and exports as skin.json, the file `automatos-theme skin` writes into theme.json. No DOM.
 *
 * A draft holds what the designer's controls set, each within what the vendored validator takes
 * (theme-cli's core/mobile-manifest.ts):
 *
 * - the source: `tokens`, the draft's own colours, or `fromLooks`, the member's look painted through the theme's
 *   boot/prepaint.json (the colours are kept under `fromLooks`, unused, so a switch back finds them);
 * - Light's colours, and Dark's or null: `tokens.light` is required and `tokens.dark` optional, and with no Dark the
 *   phone draws Light's colours under Dark too. Each value is one the validator takes ("H S% L%" or "#rrggbb"); a token
 *   the draft leaves out keeps Studio's colour on the phone;
 * - a font file for each role it gives one, and the mascot mode (absent from the block means `none`).
 *
 * A draft starts from the theme's own block (`draftFromBlock`), from Studio's own colours (`studioDraft`: Automatos
 * Go's Studio Light and Studio Dark, the triplets STUDIO_COLOURS is made from), or from a look turned into its tokens
 * (`lookDraft`: the server's paint of the look in the scheme of the tone it is drawn in, Studio's own in the other).
 * `blockOf` is the block it stands for and `designedSource` the theme with it; `encodeDraft` and `draftOf` carry it
 * through the phone view's address.
 */
import { isMobileColour, MOBILE_FONT_ROLES, MOBILE_MASCOT_MODES, MOBILE_TOKEN_NAMES, mobileErrors } from '@automatos/theme-cli/mobile'
import type { FontRole, MascotMode } from '@automatos/theme-cli/mobile-answer'
import { lookTone, missingTokens, paintLook } from '@automatos/theme-cli/mobile-paint'
import { STUDIO_DARK_SOURCE, STUDIO_LIGHT_SOURCE } from '@automatos/theme-cli/phone'
import { skinMascotFiles, withBlock } from '@automatos/theme-cli/skin-check'
import type { PhoneSource } from './skin.ts'

export const SKIN_SOURCES = ['tokens', 'fromLooks'] as const
export type SkinSource = (typeof SKIN_SOURCES)[number]
export type DraftSchemeName = 'light' | 'dark'
/** A scheme's colours by '--' token name, in MOBILE_TOKEN_NAMES's order. */
export type DraftScheme = Readonly<Record<string, string>>
export type DraftFonts = Readonly<Partial<Record<FontRole, string>>>

export interface SkinDraft {
  readonly source: SkinSource
  readonly light: DraftScheme
  /** Dark's colours; null: no Dark scheme, so the phone draws Light's under Dark too. */
  readonly dark: DraftScheme | null
  readonly fonts: DraftFonts
  readonly mascot: MascotMode
}

type Json = Readonly<Record<string, unknown>>

const MASCOT_NONE: MascotMode = 'none'
/** The role a file is tried in when asking the validator whether it is a phone font. */
const PROBE_ROLE = 'sans'
const FONTS_PATH = 'mobile.fonts'

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

function own(record: Json, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined
}

/** A scheme's colours: the block's tokens with a value the validator takes, in MOBILE_TOKEN_NAMES's order. */
export function schemeOf(values: unknown): DraftScheme {
  const given: Json = isRecord(values) ? values : {}
  const kept = MOBILE_TOKEN_NAMES.flatMap((name): [string, string][] => {
    const value = own(given, name)
    return isMobileColour(value) ? [[name, value]] : []
  })
  return Object.freeze(Object.fromEntries(kept))
}

function fontsOf(value: unknown): DraftFonts {
  const given: Json = isRecord(value) ? value : {}
  const kept = MOBILE_FONT_ROLES.flatMap((role): [string, string][] => {
    const path = own(given, role)
    return typeof path === 'string' ? [[role, path]] : []
  })
  return Object.freeze(Object.fromEntries(kept))
}

function mascotOf(value: unknown): MascotMode {
  return typeof value === 'string' && MOBILE_MASCOT_MODES.includes(value) ? (value as MascotMode) : MASCOT_NONE
}

const STUDIO_LIGHT: DraftScheme = schemeOf(STUDIO_LIGHT_SOURCE)
/** Studio Dark redefines what it changes and the rest cascades from Light, as in CSS. */
const STUDIO_DARK: DraftScheme = schemeOf({ ...STUDIO_LIGHT_SOURCE, ...STUDIO_DARK_SOURCE })

/** Studio's own colours for a scheme, for the block's tokens. */
export function studioScheme(scheme: DraftSchemeName): DraftScheme {
  return scheme === 'dark' ? STUDIO_DARK : STUDIO_LIGHT
}

/** A draft of Studio's own colours, Light and Dark, with no fonts and no mascot. */
export function studioDraft(): SkinDraft {
  const draft: SkinDraft = { source: 'tokens', light: STUDIO_LIGHT, dark: STUDIO_DARK, fonts: Object.freeze({}), mascot: MASCOT_NONE }
  return Object.freeze(draft)
}

/** The draft a `mobile` block stands for; a block from the looks keeps Studio's colours for a switch to tokens. */
export function draftFromBlock(block: unknown): SkinDraft {
  const given: Json = isRecord(block) ? block : {}
  const tokens = own(given, 'tokens')
  const fromLooks = own(given, 'fromLooks') === true && tokens === undefined
  const schemes: Json = isRecord(tokens) ? tokens : {}
  const dark = own(schemes, 'dark')
  const draft: SkinDraft = {
    source: fromLooks ? 'fromLooks' : 'tokens',
    light: fromLooks ? STUDIO_LIGHT : schemeOf(own(schemes, 'light')),
    dark: fromLooks ? STUDIO_DARK : isRecord(dark) ? schemeOf(dark) : null,
    fonts: fontsOf(own(given, 'fonts')),
    mascot: mascotOf(own(given, 'mascot')),
  }
  return Object.freeze(draft)
}

/**
 * A look turned into its tokens: the server's paint of it (theme-cli's mobile-paint `paintLook`, the defaults for a
 * look that doesn't fit the table) in the scheme of the tone it is drawn in (`lookTone`), Studio's own colours in the
 * other; null when the painting gives no ground or text, so there is nothing to start from.
 */
export function lookDraft(prepaint: unknown, look: unknown, manifestTone: unknown): SkinDraft | null {
  const painted = paintLook(prepaint, look)
  if (missingTokens(painted).length > 0) return null
  const scheme = schemeOf(painted)
  const studio = studioDraft()
  return Object.freeze(lookTone(prepaint, look, manifestTone) === 'dark' ? { ...studio, dark: scheme } : { ...studio, light: scheme })
}

/** The `mobile` block a draft stands for: its source, then the fonts it gives and its mascot when not `none`. */
export function blockOf(draft: SkinDraft): Json {
  const schemes = draft.dark === null ? { light: draft.light } : { light: draft.light, dark: draft.dark }
  const colours = draft.source === 'fromLooks' ? { fromLooks: true } : { tokens: schemes }
  const fonts = Object.keys(draft.fonts).length > 0 ? { fonts: draft.fonts } : {}
  const mascot = draft.mascot === MASCOT_NONE ? {} : { mascot: draft.mascot }
  return { ...colours, ...fonts, ...mascot }
}

/** The theme as the phone view reads it with the draft as its `mobile` block. */
export function designedSource(source: PhoneSource, draft: SkinDraft): PhoneSource {
  return { ...source, manifest: withBlock(source.manifest, blockOf(draft)) }
}

/** The scheme the designer edits for the scheme on screen: Dark's own colours, or Light's when there is no Dark. */
export function editedScheme(draft: SkinDraft, shown: DraftSchemeName): DraftSchemeName {
  return shown === 'dark' && draft.dark !== null ? 'dark' : 'light'
}

const without = (values: Json, key: string): Json => Object.fromEntries(Object.entries(values).filter(([name]) => name !== key))

/** The draft with one token of a scheme set to `value`, or left to Studio's colour for null. */
export function withToken(draft: SkinDraft, scheme: DraftSchemeName, token: string, value: string | null): SkinDraft {
  const base = scheme === 'dark' ? draft.dark ?? draft.light : draft.light
  const next = schemeOf(value === null ? without(base, token) : { ...base, [token]: value })
  return Object.freeze(scheme === 'dark' ? { ...draft, dark: next } : { ...draft, light: next })
}

/** The draft with a Dark scheme of its own (Studio Dark's colours when it had none), or with none. */
export function withDark(draft: SkinDraft, on: boolean): SkinDraft {
  return Object.freeze({ ...draft, dark: on ? draft.dark ?? STUDIO_DARK : null })
}

/** The draft with a font file for a role, or none (Studio's face) for null. */
export function withFont(draft: SkinDraft, role: FontRole, path: string | null): SkinDraft {
  const fonts = path === null ? without(draft.fonts, role) : { ...draft.fonts, [role]: path }
  return Object.freeze({ ...draft, fonts: fontsOf(fonts) })
}

/** The draft as the phone view's address carries it. */
export function encodeDraft(draft: SkinDraft): string {
  return JSON.stringify(draft)
}

/** A draft from what the address carried, each field kept only within what the validator takes; null for no object. */
export function draftOf(value: unknown): SkinDraft | null {
  if (!isRecord(value)) return null
  const dark = own(value, 'dark')
  const draft: SkinDraft = {
    source: own(value, 'source') === 'fromLooks' ? 'fromLooks' : 'tokens',
    light: schemeOf(own(value, 'light')),
    dark: isRecord(dark) ? schemeOf(dark) : null,
    fonts: fontsOf(own(value, 'fonts')),
    mascot: mascotOf(own(value, 'mascot')),
  }
  return Object.freeze(draft)
}

/** The draft an address's text names, or null when there is none or it isn't JSON. */
export function decodeDraft(text: string | null): SkinDraft | null {
  if (text === null) return null
  try {
    return draftOf(JSON.parse(text))
  } catch {
    return null
  }
}

/** The theme's files the validator takes as a phone font (a .ttf or .otf in assets/fonts/mobile/), in their order. */
export function fontFiles(assets: readonly string[]): string[] {
  return assets.filter((path) => {
    const probe = { mobile: { fromLooks: true, fonts: { [PROBE_ROLE]: path } } }
    return !mobileErrors(probe).some((error) => error.path.startsWith(FONTS_PATH))
  })
}

/** The state names of theme.json's top-level `mascot`, which the phone's mascot modes need files for. */
export function mascotStates(manifest: Json): string[] {
  const mascot = own(manifest, 'mascot')
  const states = isRecord(mascot) ? own(mascot, 'states') : undefined
  return Array.isArray(states) ? states.filter((name): name is string => typeof name === 'string') : []
}

export interface StateFile {
  readonly path: string
  /** True when the theme holds the file. */
  readonly held: boolean
}

export interface StateFiles {
  readonly name: string
  readonly files: readonly StateFile[]
}

/** Each state's files a mascot mode needs (as `automatos-theme skin` names them), and whether the theme holds each. */
export function stateFiles(manifest: Json, mode: MascotMode, assets: readonly string[]): StateFiles[] {
  const held = new Set(assets)
  return mascotStates(manifest).map((name) => ({
    name,
    files: skinMascotFiles({ mascot: { states: [name] } }, { mascot: mode }).map((path) => ({ path, held: held.has(path) })),
  }))
}
