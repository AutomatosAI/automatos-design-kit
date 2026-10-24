/**
 * The brand kit `automatos-theme brief` reads (PRD-261 B-04a): the answer of core's `GET /api/documents/brand-kit`
 * saved to a file. Core answers the workspace's kit as `modules/documents/brand_kit.py`'s `BrandKit` dumps it, with
 * `brand_system.brand_kit_view`'s effective `palette` (every colour role, stored or derived) and `palette_source`
 * (each role `set` or `derived`), at the commit `src/core/README.md` names.
 *
 * The palette is read strictly: each role the brief measures must be a hex colour, as GET always answers it (core
 * stores a role as 6-digit hex; `#abc` is read as `#aabbcc`, as core's `parse_hex` reads it). Every other field is
 * read leniently, as core's `get_brand_kit` reads a stored kit: a field of the wrong type is taken as unset. Each text
 * becomes one plain line (`./core/plain-line.ts`), so nothing in the file can add a heading, a row or hidden words to
 * the brief. The company's contact details and the social handles are never read.
 */
import { oneLine } from './core/plain-line.ts'

/** The colour roles the brief measures; GET answers every one of them (core `PALETTE_ROLES`, less `rule`). */
export const MEASURED_ROLES = ['paper', 'surface', 'surface_2', 'ink', 'heading', 'muted', 'accent'] as const
export type MeasuredRole = (typeof MEASURED_ROLES)[number]
/** The one optional role: core derives it only when the kit's secondary colour is a second hue. */
export const SECOND_ACCENT_ROLE = 'accent_2'
/** The kit's own colours, from which core derives every role the owner has not set. */
export const KIT_COLOUR_FIELDS = ['primary_color', 'secondary_color', 'text_color'] as const
export type KitColourField = (typeof KIT_COLOUR_FIELDS)[number]
export const ACCENT_USES = ['sparing', 'bold'] as const
export type AccentUse = (typeof ACCENT_USES)[number]

/** One logo variant: its stored-file field, its link field (if it has one) and core's route and file stem for it. */
export interface LogoVariant {
  readonly stem: string
  readonly label: string
  readonly pathField: string
  readonly urlField: string | null
}

/** core `brand_logo.py`'s stems, each also the variant's route under the brand kit's (`document_brand_kit.py`). */
export const LOGO_VARIANTS: readonly LogoVariant[] = Object.freeze([
  { stem: 'logo', label: 'logo', pathField: 'logo_path', urlField: 'logo_url' },
  { stem: 'logo-dark', label: 'logo for dark grounds', pathField: 'logo_dark_path', urlField: null },
  { stem: 'logo-mono', label: 'one-colour logo', pathField: 'logo_mono_path', urlField: null },
  { stem: 'logo-mark', label: 'square mark', pathField: 'logo_mark_path', urlField: 'logo_mark_url' },
])

export type LogoState =
  | { readonly kind: 'uploaded'; readonly format: 'png' | 'jpeg' | 'other' }
  | { readonly kind: 'link'; readonly url: string }
  | { readonly kind: 'none' }

export interface Logo {
  readonly variant: LogoVariant
  readonly state: LogoState
}

/** An uploaded woff2 file (core `BrandFontFile`): its id names its route. */
export interface FontFile {
  readonly id: string
  readonly family: string
  readonly weight: number
  readonly style: string
  readonly fileName: string
}

export interface ToneWord {
  readonly word: string
  readonly meaning: string
}

/** What the brief reads of a brand kit. Colours are lower-case `#rrggbb`. */
export interface BriefKit {
  readonly name: string
  readonly tagline: string
  readonly roles: Readonly<Record<MeasuredRole, string>>
  readonly secondAccent: string | null
  /** Each role's source, `set` or `derived`, when the file says. */
  readonly sources: Readonly<Record<string, string>>
  readonly kitColours: Readonly<Record<KitColourField, string | null>>
  readonly accentUse: AccentUse | null
  readonly bodyFont: string
  readonly headingFont: string
  readonly fontFiles: readonly FontFile[]
  readonly logos: readonly Logo[]
  /** The logo's clear space, in logo heights (core `LogoRules.clear_space`). */
  readonly clearSpace: number | null
  readonly tone: readonly ToneWord[]
  readonly banned: readonly string[]
  readonly signOff: string
}

type JsonObject = Readonly<Record<string, unknown>>

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const SHORT_HEX_LENGTH = 4
const FONT_ID = /^[0-9a-f]{32}$/
const LINK = /^https?:\/\//
const PNG_EXTENSION = /\.png$/i
const JPEG_EXTENSION = /\.jpe?g$/i
const ROLE_SOURCES = ['set', 'derived']
/** How much of a refused value a refusal repeats. */
const SHOWN_TEXT_MAX = 40
const DEFAULT_WEIGHT = 400
const DEFAULT_STYLE = 'normal'
/** The route a brand kit file comes from, for the refusals. */
export const BRAND_KIT_ROUTE = 'GET /api/documents/brand-kit'

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `value` as one plain line, or '' when it is not a string. */
function text(value: unknown): string {
  return typeof value === 'string' ? oneLine(value) : ''
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter((item) => item !== '') : []
}

/** `#rrggbb` in lower case for a hex colour, else null. */
export function hexColour(value: unknown): string | null {
  if (typeof value !== 'string' || !HEX.test(value)) return null
  const digits = value.toLowerCase()
  if (digits.length !== SHORT_HEX_LENGTH) return digits
  return `#${[...digits.slice(1)].map((digit) => digit + digit).join('')}`
}

/** How a value that is not a colour is named in a refusal: missing, its text (cut short) or its JSON type. */
function shownValue(value: unknown): string {
  if (value === undefined) return 'missing'
  if (typeof value === 'string') return `"${oneLine(value).slice(0, SHOWN_TEXT_MAX)}"`
  if (value === null) return 'null'
  return Array.isArray(value) ? 'a list' : typeof value === 'object' ? 'an object' : `a ${typeof value}`
}

/** The measured roles, or a sentence per role that is missing or not a colour. */
function readRoles(palette: JsonObject): Record<MeasuredRole, string> | string[] {
  const problems = MEASURED_ROLES
    .filter((role) => hexColour(palette[role]) === null)
    .map((role) => `palette.${role} is ${shownValue(palette[role])}: every colour role is a hex colour such as #1a1a2e, as ${BRAND_KIT_ROUTE} answers it.`)
  if (hexColour(palette[SECOND_ACCENT_ROLE]) === null && palette[SECOND_ACCENT_ROLE] !== undefined) {
    problems.push(`palette.${SECOND_ACCENT_ROLE} is ${shownValue(palette[SECOND_ACCENT_ROLE])}: a hex colour, or left out.`)
  }
  if (problems.length > 0) return problems
  return Object.fromEntries(MEASURED_ROLES.map((role) => [role, hexColour(palette[role]) ?? ''])) as Record<MeasuredRole, string>
}

function readSources(value: unknown): Record<string, string> {
  if (!isObject(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, source]) => typeof source === 'string' && ROLE_SOURCES.includes(source)))
    as Record<string, string>
}

function logoState(kit: JsonObject, variant: LogoVariant): LogoState {
  const stored = text(kit[variant.pathField])
  if (stored !== '') {
    const format = PNG_EXTENSION.test(stored) ? 'png' : JPEG_EXTENSION.test(stored) ? 'jpeg' : 'other'
    return { kind: 'uploaded', format }
  }
  const url = variant.urlField === null ? '' : text(kit[variant.urlField])
  return LINK.test(url) ? { kind: 'link', url } : { kind: 'none' }
}

function fontFile(value: unknown): FontFile | null {
  if (!isObject(value) || typeof value.id !== 'string' || !FONT_ID.test(value.id)) return null
  return {
    id: value.id,
    family: text(value.family),
    weight: typeof value.weight === 'number' ? value.weight : DEFAULT_WEIGHT,
    style: text(value.style) || DEFAULT_STYLE,
    fileName: text(value.file_name),
  }
}

/** Core's lenient reading of `voice.tone`: a plain string is a word with no meaning (brand_system `tone_words`). */
function toneWords(voice: JsonObject): ToneWord[] {
  const entries: readonly unknown[] = Array.isArray(voice.tone) ? voice.tone : []
  return entries
    .map((entry) => (typeof entry === 'string' ? { word: text(entry), meaning: '' }
      : isObject(entry) ? { word: text(entry.word), meaning: text(entry.meaning) } : { word: '', meaning: '' }))
    .filter((entry) => entry.word !== '')
}

function accentUse(value: unknown): AccentUse | null {
  return ACCENT_USES.find((use) => use === value) ?? null
}

/** Everything but the palette, read leniently. */
function readRest(kit: JsonObject): Omit<BriefKit, 'roles' | 'secondAccent'> {
  const voice: JsonObject = isObject(kit.voice) ? kit.voice : {}
  const rules: JsonObject = isObject(kit.logo_rules) ? kit.logo_rules : {}
  const files: readonly unknown[] = Array.isArray(kit.font_files) ? kit.font_files : []
  return {
    name: text(kit.name),
    tagline: text(kit.tagline),
    sources: readSources(kit.palette_source),
    kitColours: Object.fromEntries(KIT_COLOUR_FIELDS.map((field) => [field, hexColour(kit[field])])) as Record<KitColourField, string | null>,
    accentUse: accentUse(kit.accent_use),
    bodyFont: text(kit.font_family),
    headingFont: text(kit.heading_font),
    fontFiles: files.map(fontFile).filter((file): file is FontFile => file !== null),
    logos: LOGO_VARIANTS.map((variant) => ({ variant, state: logoState(kit, variant) })),
    clearSpace: typeof rules.clear_space === 'number' ? rules.clear_space : null,
    tone: toneWords(voice),
    banned: texts(voice.banned_phrases),
    signOff: text(voice.sign_off),
  }
}

/** The brief's reading of a parsed brand kit file, or every reason it can't be one. */
export function readBriefKit(data: unknown): BriefKit | string[] {
  if (!isObject(data)) return [`it is not a JSON object: save the answer of ${BRAND_KIT_ROUTE}.`]
  if (!isObject(data.palette)) {
    return [`it has no palette: save the answer of ${BRAND_KIT_ROUTE}, which holds every colour role.`]
  }
  const roles = readRoles(data.palette)
  if (Array.isArray(roles)) return roles
  return { ...readRest(data), roles, secondAccent: hexColour(data.palette[SECOND_ACCENT_ROLE]) }
}
