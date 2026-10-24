/**
 * A skin checked before it is written: a theme.json `mobile` block (skin.json holds exactly one) held to everything
 * `automatos-theme skin` refuses, so the harness's skin designer offers a file only when the command would take it.
 * Two passes, the second only when the first passed, as pack stops after a pass that refused anything:
 *
 * 1. the vendored validator (core/mobile-manifest.ts `mobileErrors`) on the theme's theme.json with the block in
 *    place of its own: BAD_MOBILE or UNKNOWN_FIELD, each naming the field (the theme's top-level `mascot` states and
 *    `engines.automatos` are read with it, as core reads them);
 * 2. the files and the contrast: each font the block names, and for `clips` or `stills` each state's files (pack's
 *    MOBILE_MASCOT_FILES: the .mp4 and .png, or the .png), are the theme's (MISSING_FILE); and `check`'s own measure
 *    (check/mobile-contrast.ts `measureMobile`) finds no pair under its minimum and no colour set without a ground or
 *    text (MOBILE_CONTRAST, one per problem, in `check`'s words).
 *
 * `skinFixes` names, for a tokens block that failed the measure, the nearest passing value of each failing pair's
 * first token (phone/nearest-passing.ts). Pure: the caller says which files the theme has and hands over the ones the
 * measure reads, so the command reads a folder and the harness its served files.
 */
import { measureMobile, OUTCOME_FAIL, SUBJECT_SCHEME, type MobileMeasure } from './check/mobile-contrast.ts'
import { isRecord, own, themeError, type JsonRecord, type ThemeError } from './core/css-value.ts'
import { mobileErrors } from './core/mobile-manifest.ts'
import { CLIP_SUFFIX, MASCOT_CLIPS, MASCOT_DIR, MASCOT_STILLS, STILL_SUFFIX } from './mobile-answer.ts'
import { nearestPassing } from './phone/nearest-passing.ts'

export const MOBILE_FIELD = 'mobile'
export const SKIN_FILE = 'skin.json'
export const MISSING_FILE_CODE = 'MISSING_FILE'
export const CONTRAST_CODE = 'MOBILE_CONTRAST'
const SOURCE_TOKENS = 'tokens'
const FONTS_FIELD = 'fonts'
const MASCOT_FIELD = 'mascot'
const STATES_FIELD = 'states'
const INDENT = 2

/** The theme's files, as the check reads them. */
export interface SkinFiles {
  /** True when the theme holds a file at `path` (a package path, such as assets/mascot/hello.png). */
  readonly has: (path: string) => boolean
  /** The files the measure reads under `fromLooks`: looks/presets/*.look.json and boot/prepaint.json, by path. */
  readonly measured: ReadonlyMap<string, Uint8Array>
}

export interface SkinCheck {
  /** Every reason the block is refused; empty when it is taken. */
  readonly problems: readonly ThemeError[]
  /** The block measured, once the validator took it; null before. */
  readonly measure: MobileMeasure | null
}

/** One failing pair's fix: the scheme, the token to change and its nearest passing value. */
export interface SkinFix {
  readonly scheme: string
  readonly token: string
  readonly value: string
  readonly background: string
}

/** theme.json with `block` as its `mobile` block. */
export function withBlock(manifest: JsonRecord, block: unknown): JsonRecord {
  return { ...manifest, [MOBILE_FIELD]: block }
}

/** The font files a block names, in the order it names them. */
export function skinFontFiles(block: unknown): string[] {
  const fonts = isRecord(block) ? own(block, FONTS_FIELD) : undefined
  return isRecord(fonts) ? Object.values(fonts).filter((path): path is string => typeof path === 'string') : []
}

/** The files a block's mascot mode needs: each top-level `mascot.states` name's .mp4 and .png under clips, .png under stills. */
export function skinMascotFiles(manifest: JsonRecord, block: unknown): string[] {
  const mode = isRecord(block) ? own(block, MASCOT_FIELD) : undefined
  const suffixes = mode === MASCOT_CLIPS ? [CLIP_SUFFIX, STILL_SUFFIX] : mode === MASCOT_STILLS ? [STILL_SUFFIX] : []
  const mascot = own(manifest, MASCOT_FIELD)
  const states = isRecord(mascot) ? own(mascot, STATES_FIELD) : undefined
  const names = Array.isArray(states) ? states.filter((name): name is string => typeof name === 'string') : []
  return names.flatMap((name) => suffixes.map((suffix) => `${MASCOT_DIR}${name}${suffix}`))
}

function missingFiles(manifest: JsonRecord, block: unknown, files: SkinFiles): ThemeError[] {
  const fonts = skinFontFiles(block).filter((path) => !files.has(path))
    .map((path) => themeError(MISSING_FILE_CODE, path, `"mobile.fonts" names ${path}, which isn't in the theme.`))
  const mode = isRecord(block) ? String(own(block, MASCOT_FIELD)) : ''
  const mascot = skinMascotFiles(manifest, block).filter((path) => !files.has(path))
    .map((path) => themeError(MISSING_FILE_CODE, path, `"mobile.mascot" "${mode}" needs ${path}, which isn't in the theme.`))
  return [...fonts, ...mascot]
}

/** Every reason `automatos-theme skin` refuses `block` for this theme, and the block measured (module comment). */
export function checkSkin(manifest: JsonRecord, block: unknown, files: SkinFiles): SkinCheck {
  const document = withBlock(manifest, block)
  const invalid = mobileErrors(document)
  if (invalid.length > 0) return { problems: invalid, measure: null }
  const measure = measureMobile(document, files.measured)
  const contrast = measure !== null && measure.status === OUTCOME_FAIL
    ? measure.problems.map((problem) => themeError(CONTRAST_CODE, MOBILE_FIELD, problem))
    : []
  return { problems: [...missingFiles(manifest, block, files), ...contrast], measure }
}

/** For a tokens block, each failing pair's nearest passing value of its first token; none under fromLooks. */
export function skinFixes(block: unknown, measure: MobileMeasure | null): SkinFix[] {
  const tokens = isRecord(block) ? own(block, SOURCE_TOKENS) : undefined
  if (measure === null || !isRecord(tokens)) return []
  return (measure.schemes ?? []).filter((subject) => subject.kind === SUBJECT_SCHEME).flatMap((subject) => {
    const scheme = own(tokens, subject.id)
    if (!isRecord(scheme)) return []
    return subject.pairs.filter((pair) => pair.status === OUTCOME_FAIL).flatMap((pair): SkinFix[] => {
      const value = nearestPassing(scheme, pair)
      return value === null ? [] : [{ scheme: subject.id, token: pair.foreground, value, background: pair.background }]
    })
  })
}

/** The block as skin.json holds it: JSON with two-space indents and a closing line break. */
export function skinText(block: unknown): string {
  return `${JSON.stringify(block, null, INDENT)}\n`
}
