/**
 * The phone view's contrast panel, measured with `automatos-theme check`'s own measure (theme-cli's
 * src/check/mobile-contrast.ts `measureMobile`, the port of core's review), so the panel and `check` never disagree:
 * the served theme's presets and prepaint table become the package files `check` reads (each preset at
 * looks/presets/<id>.look.json, the table at boot/prepaint.json, as JSON), then the subject the phone shows is picked:
 *
 * - `tokens`: the scheme on screen; a scheme the block leaves out is painted with the other's (the app's paint.ts
 *   `colours` :174-:189), so the panel shows that one, saying so;
 * - `fromLooks`: the member's look, a preset by id, or the table's defaults for no stored look; a look whose painting
 *   gives no ground or text is measured as it is (the review fails it) while the server sends the phone the defaults.
 *
 * No DOM.
 */
import {
  DEFAULTS_ID, measureMobile, SOURCE_LOOKS, SUBJECT_DEFAULTS, SUBJECT_PRESET, SUBJECT_SCHEME,
  type ContrastSubject, type MobileMeasure, type MobileOutcome,
} from '@automatos/theme-cli/mobile-contrast'
import type { PhoneScheme } from './settings.ts'
import { memberLook, type PhoneSource } from './skin.ts'

export const PRESETS_DIR = 'looks/presets/'
export const PRESET_SUFFIX = '.look.json'
export const PREPAINT_PATH = 'boot/prepaint.json'

const encoder = new TextEncoder()
const bytesOf = (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value))

/** The package files `check`'s measure reads, from the served theme. */
export function measuredFiles(source: PhoneSource): ReadonlyMap<string, Uint8Array> {
  const presets = source.presets.map((look): [string, Uint8Array] => [`${PRESETS_DIR}${look.id}${PRESET_SUFFIX}`, bytesOf(look)])
  const table: [string, Uint8Array][] = source.prepaint === null ? [] : [[PREPAINT_PATH, bytesOf(source.prepaint)]]
  return new Map([...presets, ...table])
}

/** The block measured as `check` measures it; null for a theme.json without a `mobile` block. */
export function measurePhone(source: PhoneSource): MobileMeasure | null {
  return measureMobile(source.manifest, measuredFiles(source))
}

/** Why the panel shows another subject than the one asked for. */
export type ShownNote = 'other-scheme' | 'defaults-sent' | null

export interface ShownSubject {
  readonly subject: ContrastSubject | null
  readonly note: ShownNote
}

export interface ShownChoice {
  readonly scheme: PhoneScheme
  /** The member's look (settings.ts): a preset id, NO_STORED_LOOK, or null for the default look. */
  readonly look: string | null
}

function schemeSubject(subjects: readonly ContrastSubject[], scheme: PhoneScheme): ShownSubject {
  const own = subjects.find((subject) => subject.kind === SUBJECT_SCHEME && subject.id === scheme)
  if (own !== undefined) return { subject: own, note: null }
  const other = subjects.find((subject) => subject.kind === SUBJECT_SCHEME) ?? null
  return { subject: other, note: other === null ? null : 'other-scheme' }
}

function lookSubject(source: PhoneSource, subjects: readonly ContrastSubject[], look: string | null): ShownSubject {
  const preset = memberLook(source.presets, look)
  const subject = preset === null
    ? subjects.find((entry) => entry.kind === SUBJECT_DEFAULTS && entry.id === DEFAULTS_ID)
    : subjects.find((entry) => entry.kind === SUBJECT_PRESET && entry.id === preset.id)
  if (subject === undefined) return { subject: null, note: null }
  return { subject, note: preset !== null && subject.missing.length > 0 ? 'defaults-sent' : null }
}

/** The subject the phone shows for the choice (module comment). */
export function shownSubject(source: PhoneSource, measure: MobileMeasure | null, choice: ShownChoice): ShownSubject {
  if (measure === null) return { subject: null, note: null }
  if (measure.source === SOURCE_LOOKS) return lookSubject(source, measure.presets ?? [], choice.look)
  return schemeSubject(measure.schemes ?? [], choice.scheme)
}

/** The panel's word for each outcome of the measure. */
export const OUTCOME_WORDS: Readonly<Record<MobileOutcome, string>> = Object.freeze({
  pass: 'Pass',
  fail: 'Fail',
  not_measured: 'Not measured',
})
