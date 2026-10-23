/**
 * `automatos-theme check design <theme folder>` (PRD-261 B-03d): a theme's design checked before any
 * of its code is written, so it starts accessible. Three lines, then the verdict:
 *
 * - `looks`: looks/schema.json and every looks/presets/*.look.json through core's own look validators
 *   (looks.ts over the vendored core/look-schema.ts), with core's codes.
 * - `prepaint`: boot/prepaint.json through core's prepaint checks (vendored core/css-value.ts), with
 *   core's codes; then its defaults and every preset must fit its table (contrast.ts `lookFits`, the
 *   host's first-paint rule): the host drops a table whose defaults don't fit, and paints the defaults
 *   for a look that doesn't. `not_measured` when the theme has no table.
 * - `contrast`: every pair design/contrast.json declares, on every preset as the first paint paints
 *   it (contrast.ts `paintLook`), by the look runtime's own ratio. A pair under its `min` (default
 *   4.5, WCAG AA for text) is an error naming the preset, both variables and the ratio; so is a pair
 *   that can't be measured (a variable the preset doesn't paint, or a value that isn't a colour).
 *   `not_measured` when the theme has no design/contrast.json.
 *
 * design/contrast.json is the kit's own file: pack never packs design/ (collect.ts PACKED_FOLDERS) and
 * the server never reads it. Its form:
 *   {"schema": "automatos-theme-contrast/v1", "pairs": [{"text": "--ring", "ground": "--background", "min": 3}]}
 * with `min` optional. The folder is read as it is on disk, nothing is built, nothing is sent anywhere.
 * Exit code 0 when no line is an error, 1 when one is, 2 for a usage error.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { CommandDeps } from '../cli-main.ts'
import { isHidden, statOf } from '../collect.ts'
import {
  CUSTOM_PROPERTY_PATTERN, echo, hasOwn, isFiniteNumber, isRecord, own, prepaintErrors, PREPAINT_PATH, themeError,
  type JsonRecord, type ThemeError,
} from '../core/css-value.ts'
import { parseJson } from '../json.ts'
import { lookFileErrors, presetIds, presetPaths, PRESETS_DIR, SCHEMA_PATH } from '../looks.ts'
import { pathErrors, type PackageEntry } from '../members.ts'
import type { Output } from '../output.ts'
import {
  contrastMeter, DEFAULT_PAIR_MIN, lookFits, measurePair, paintLook, type ContrastMeter, type ContrastPair, type PairMeasure,
} from './contrast.ts'
import {
  CORE_REPO, CORE_SHA, countsOf, LEVEL_ERROR, LEVEL_NOT_MEASURED, LEVEL_PASS, LEVELS, presetList, verdictOf,
  type CheckEntry, type Level,
} from './report.ts'

export const DESIGN_SUBCOMMAND = 'design'
export const DESIGN_USAGE = 'usage: automatos-theme check design <theme folder>'
export const DESIGN_CONTRAST_PATH = 'design/contrast.json'
export const DESIGN_CONTRAST_SCHEMA = 'automatos-theme-contrast/v1'
/** The kit's own codes; every other code a line lists is core's. */
export const DESIGN_CODES = Object.freeze({
  pairsFile: 'BAD_CONTRAST_PAIRS',
  underMin: 'CONTRAST_UNDER_MIN',
  notMeasured: 'CONTRAST_NOT_MEASURED',
  presetUnfit: 'PRESET_NOT_IN_PREPAINT',
  defaultsUnfit: 'PREPAINT_DEFAULTS_UNFIT',
})
const CONTRAST_FIELDS: readonly string[] = ['schema', 'pairs']
const PAIR_FIELDS: readonly string[] = ['text', 'ground', 'min']
/** WCAG contrast ratios run from 1:1 to 21:1. */
const RATIO_FLOOR = 1
const RATIO_CEILING = 21
const RATIO_DECIMALS = 2
const PRESETS_FOLDER = PRESETS_DIR.replace(/\/$/, '')
const LOOKS_PREFIX = 'looks/'
const EMPTY = new Uint8Array(0)
const EXIT_OK = 0
const EXIT_FAILED = 1
const EXIT_USAGE = 2
const NAME_WIDTH = 18
const LEVEL_WIDTH = 13
const ITEM_INDENT = '    '

export interface DesignRow {
  readonly name: 'looks' | 'prepaint' | 'contrast'
  readonly level: Level
  readonly text: string
  readonly errors: readonly ThemeError[]
}

/** One pair (by its index in design/contrast.json) measured on one preset. */
export interface PresetMeasure {
  readonly preset: string
  readonly index: number
  readonly measure: PairMeasure
}

export interface DesignResult {
  readonly rows: readonly DesignRow[]
  readonly measures: readonly PresetMeasure[]
}

interface Preset {
  readonly id: string
  readonly path: string
  readonly look: JsonRecord
}

/** A design file: absent, refused with every reason, or read. */
type Read<T> =
  | { readonly state: 'absent' }
  | { readonly state: 'refused'; readonly errors: readonly ThemeError[] }
  | { readonly state: 'read'; readonly value: T }

const ABSENT = Object.freeze({ state: 'absent' as const })

function row(name: DesignRow['name'], level: Level, text: string, errors: readonly ThemeError[] = []): DesignRow {
  return { name, level, text, errors }
}

function entryAt(themeDir: string, path: string): PackageEntry[] {
  const kind = statOf(themeDir, path)
  if (kind === 'link') return [{ path, data: EMPTY, link: true }]
  return kind === 'file' ? [{ path, data: new Uint8Array(readFileSync(join(themeDir, path))) }] : []
}

/** A theme folder's design files, as on disk: the look schema, the presets, the prepaint table, design/contrast.json. */
export function readDesignFiles(themeDir: string): PackageEntry[] {
  const presets = statOf(themeDir, PRESETS_FOLDER) === 'folder'
    ? readdirSync(join(themeDir, PRESETS_FOLDER)).filter((name) => !isHidden(name)).map((name) => `${PRESETS_DIR}${name}`)
    : []
  const linkedFolder = entryAt(themeDir, PRESETS_FOLDER).filter((entry) => entry.link === true)
  const files = [SCHEMA_PATH, ...presetPaths(presets), PREPAINT_PATH, DESIGN_CONTRAST_PATH].flatMap((path) => entryAt(themeDir, path))
  return [...linkedFolder, ...files]
}

/** Each preset whose file is a JSON object, by its id (the file's name). */
function presetsOf(files: ReadonlyMap<string, Uint8Array>): Preset[] {
  return presetPaths(files.keys()).flatMap((path): Preset[] => {
    const { data } = parseJson(files.get(path) ?? EMPTY, path)
    const [id] = presetIds([path])
    return isRecord(data) && id !== undefined ? [{ id, path, look: data }] : []
  })
}

function tableOf(files: ReadonlyMap<string, Uint8Array>): Read<JsonRecord> {
  const raw = files.get(PREPAINT_PATH)
  if (raw === undefined) return ABSENT
  const { data, error } = parseJson(raw, PREPAINT_PATH)
  if (error !== null) return { state: 'refused', errors: [error] }
  const errors = prepaintErrors(data)
  return errors.length > 0 || !isRecord(data) ? { state: 'refused', errors } : { state: 'read', value: data }
}

function badPairs(where: string, message: string): ThemeError {
  return themeError(DESIGN_CODES.pairsFile, `${DESIGN_CONTRAST_PATH}#${where}`, message)
}

function unknownFields(record: JsonRecord, known: readonly string[], where: string, holds: string): ThemeError[] {
  return Object.keys(record).filter((key) => !known.includes(key))
    .map((key) => badPairs(`${where}${echo(key)}`, `"${echo(key)}" isn't a field of ${holds}.`))
}

function propertyName(value: unknown): string | null {
  return typeof value === 'string' && CUSTOM_PROPERTY_PATTERN.test(value) ? value : null
}

function ratioOf(value: unknown): number | null {
  return isFiniteNumber(value) && value >= RATIO_FLOOR && value <= RATIO_CEILING ? value : null
}

function nameError(where: string, field: string): ThemeError {
  return badPairs(`${where}.${field}`, `${where}.${field} must name a custom property, such as "--foreground".`)
}

/** One entry of "pairs" as a pair, or why it can't be one. */
function pairOf(item: unknown, index: number): ContrastPair | ThemeError[] {
  const where = `pairs[${index}]`
  if (!isRecord(item)) {
    const form = `{"text": "--foreground", "ground": "--background"}, with "min" when it isn't ${DEFAULT_PAIR_MIN}`
    return [badPairs(where, `${where} must be an object: ${form}.`)]
  }
  const text = propertyName(item.text)
  const ground = propertyName(item.ground)
  const min = ratioOf(hasOwn(item, 'min') ? item.min : DEFAULT_PAIR_MIN)
  const errors = [
    ...unknownFields(item, PAIR_FIELDS, `${where}.`, 'a pair: it holds "text", "ground" and "min"'),
    ...(text === null ? [nameError(where, 'text')] : []),
    ...(ground === null ? [nameError(where, 'ground')] : []),
    ...(min === null ? [badPairs(`${where}.min`, `${where}.min must be a contrast ratio from ${RATIO_FLOOR} to ${RATIO_CEILING}.`)] : []),
  ]
  return errors.length > 0 || text === null || ground === null || min === null ? errors : { text, ground, min }
}

function repeatErrors(pairs: readonly ContrastPair[]): ThemeError[] {
  return pairs.flatMap((pair, index) => {
    const first = pairs.findIndex((other) => other.text === pair.text && other.ground === pair.ground)
    return first === index ? [] : [badPairs(`pairs[${index}]`, `pairs[${index}] repeats pairs[${first}]: ${pair.text} on ${pair.ground}.`)]
  })
}

/** design/contrast.json's pairs, or every reason it can't be read as a list of pairs. */
function pairsOf(files: ReadonlyMap<string, Uint8Array>): Read<readonly ContrastPair[]> {
  const raw = files.get(DESIGN_CONTRAST_PATH)
  if (raw === undefined) return ABSENT
  const { data, error } = parseJson(raw, DESIGN_CONTRAST_PATH)
  if (error !== null) return { state: 'refused', errors: [error] }
  const form = `{"schema": "${DESIGN_CONTRAST_SCHEMA}", "pairs": [{"text": "--foreground", "ground": "--background"}]}`
  if (!isRecord(data)) return { state: 'refused', errors: [badPairs('', `${DESIGN_CONTRAST_PATH} must be a JSON object: ${form}.`)] }
  const items = own(data, 'pairs')
  const errors = [
    ...unknownFields(data, CONTRAST_FIELDS, '', `${DESIGN_CONTRAST_PATH}: it holds "schema" and "pairs"`),
    ...(own(data, 'schema') === DESIGN_CONTRAST_SCHEMA ? [] : [badPairs('schema', `"schema" must be "${DESIGN_CONTRAST_SCHEMA}".`)]),
    ...(Array.isArray(items) && items.length > 0 ? [] : [badPairs('pairs', '"pairs" must list at least one {"text", "ground"} pair.')]),
  ]
  const read = (Array.isArray(items) ? items : []).map(pairOf)
  const pairs = read.filter((item): item is ContrastPair => !Array.isArray(item))
  const all = [...errors, ...read.flatMap((item) => (Array.isArray(item) ? item : [])), ...repeatErrors(pairs)]
  return all.length > 0 ? { state: 'refused', errors: all } : { state: 'read', value: pairs }
}

function looksRow(files: ReadonlyMap<string, Uint8Array>, links: readonly ThemeError[]): DesignRow {
  const errors = [...links, ...lookFileErrors(files)]
  if (errors.length > 0) return row('looks', LEVEL_ERROR, `${SCHEMA_PATH} and its presets don't pass core's look validators.`, errors)
  const ids = presetList(files)
  return row('looks', LEVEL_PASS, `${ids.length} preset(s) pass ${SCHEMA_PATH}: ${ids.join(', ')}.`)
}

/** The defaults and every preset fit the table, or each look that doesn't. */
function fitErrors(table: JsonRecord, presets: readonly Preset[]): ThemeError[] {
  const defaults = lookFits(table, own(table, 'defaults')) ? [] : [themeError(DESIGN_CODES.defaultsUnfit, `${PREPAINT_PATH}#defaults`, (
    `The table's "defaults" don't name an option of every table it paints, so the host paints nothing from ${PREPAINT_PATH}.`
  ))]
  const unfit = presets.filter((preset) => !lookFits(table, preset.look)).map((preset) => themeError(DESIGN_CODES.presetUnfit, preset.path, (
    `Preset "${echo(preset.id)}" names a choice or value ${PREPAINT_PATH} has no entry for, so its first paint is the table's defaults.`
  )))
  return [...defaults, ...unfit]
}

function prepaintRow(table: Read<JsonRecord>, presets: readonly Preset[], links: readonly ThemeError[]): DesignRow {
  if (links.length > 0) return row('prepaint', LEVEL_ERROR, `${PREPAINT_PATH} can't be read.`, links)
  if (table.state === 'absent') {
    const none = `No ${PREPAINT_PATH}: no look is painted before the theme's code runs, so no preset's colours can be read as data.`
    return row('prepaint', LEVEL_NOT_MEASURED, none)
  }
  if (table.state === 'refused') return row('prepaint', LEVEL_ERROR, `${PREPAINT_PATH} doesn't pass core's prepaint checks.`, table.errors)
  const errors = fitErrors(table.value, presets)
  if (errors.length > 0) return row('prepaint', LEVEL_ERROR, `${errors.length} look(s) don't fit ${PREPAINT_PATH}.`, errors)
  return row('prepaint', LEVEL_PASS, `${PREPAINT_PATH} passes core's prepaint checks; its defaults and ${presets.length} preset(s) fit it.`)
}

function unreadText(measure: PairMeasure): string {
  return measure.unread.map(({ name, value }) => (
    value === undefined ? `${name} is not painted` : `${name} is "${echo(value)}", not #rrggbb or an "H S% L%" triplet`
  )).join('; ')
}

/** The error for one measurement under its minimum or not measured; null when it passes. */
function measureError({ preset, index, measure }: PresetMeasure): ThemeError | null {
  if (measure.status === 'pass') return null
  const { pair, ratio } = measure
  const where = `${DESIGN_CONTRAST_PATH}#pairs[${index}]`
  const named = `Preset "${echo(preset)}": ${pair.text} on ${pair.ground}`
  if (ratio === null) return themeError(DESIGN_CODES.notMeasured, where, `${named} can't be measured: ${unreadText(measure)}.`)
  return themeError(DESIGN_CODES.underMin, where, `${named} is ${ratio.toFixed(RATIO_DECIMALS)}:1, under its minimum of ${pair.min}:1.`)
}

/** Every declared pair on every preset that fits the table; a preset that doesn't is one error. */
function measureAll(
  table: JsonRecord, presets: readonly Preset[], pairs: readonly ContrastPair[], meter: ContrastMeter,
): { readonly measures: readonly PresetMeasure[]; readonly errors: readonly ThemeError[] } {
  const measures = presets.filter((preset) => lookFits(table, preset.look)).flatMap((preset) => {
    const vars = paintLook(table, preset.look)
    return pairs.map((pair, index): PresetMeasure => ({ preset: preset.id, index, measure: measurePair(meter, vars, pair) }))
  })
  const unfit = presets.filter((preset) => !lookFits(table, preset.look)).map((preset) => themeError(
    DESIGN_CODES.notMeasured, preset.path, `Preset "${echo(preset.id)}" doesn't fit ${PREPAINT_PATH}, so none of its pairs can be measured.`,
  ))
  const errors = [...unfit, ...measures.flatMap((item) => measureError(item) ?? [])]
  return { measures, errors }
}

interface ContrastInputs {
  readonly pairs: Read<readonly ContrastPair[]>
  readonly table: Read<JsonRecord>
  readonly presets: readonly Preset[]
  readonly links: readonly ThemeError[]
}

function contrastRow(inputs: ContrastInputs, meter: ContrastMeter): DesignResult {
  const { pairs, table, presets, links } = inputs
  const alone = (level: Level, text: string, errors: readonly ThemeError[] = []): DesignResult => (
    { rows: [row('contrast', level, text, errors)], measures: [] }
  )
  if (links.length > 0) return alone(LEVEL_ERROR, `${DESIGN_CONTRAST_PATH} can't be read.`, links)
  if (pairs.state === 'absent') {
    return alone(LEVEL_NOT_MEASURED, `No ${DESIGN_CONTRAST_PATH}: the theme declares no text and ground pairs, so contrast isn't measured.`)
  }
  if (pairs.state === 'refused') return alone(LEVEL_ERROR, `${DESIGN_CONTRAST_PATH} isn't a list of pairs this check can measure.`, pairs.errors)
  const count = pairs.value.length
  if (table.state !== 'read' || !lookFits(table.value, own(table.value, 'defaults'))) {
    const message = `The ${count} pair(s) can't be measured without a ${PREPAINT_PATH} the host paints from.`
    const why = themeError(DESIGN_CODES.notMeasured, PREPAINT_PATH, message)
    return alone(LEVEL_ERROR, `No preset's colours can be read, so ${count} pair(s) aren't measured.`, [why])
  }
  if (presets.length === 0) return alone(LEVEL_NOT_MEASURED, `No preset to measure the ${count} pair(s) on.`)
  const { measures, errors } = measureAll(table.value, presets, pairs.value, meter)
  const scope = `${count} pair(s) on ${presets.length} preset(s)`
  const level = errors.length > 0 ? LEVEL_ERROR : LEVEL_PASS
  const text = errors.length > 0 ? `${errors.length} problem(s) in ${scope}.` : `${scope}, each at or above its minimum.`
  return { rows: [row('contrast', level, text, errors)], measures }
}

/** The design check over a theme's design files (readDesignFiles), measured with `meter`. */
export function checkDesignFiles(entries: readonly PackageEntry[], meter: ContrastMeter): DesignResult {
  const linked = entries.filter((entry) => entry.link === true)
  const linksUnder = (prefix: string): ThemeError[] => pathErrors(linked.filter((entry) => entry.path.startsWith(prefix)))
  const files = new Map(entries.filter((entry) => entry.link !== true).map((entry): [string, Uint8Array] => [entry.path, entry.data]))
  const presets = presetsOf(files)
  const table = tableOf(files)
  const contrast = contrastRow({ pairs: pairsOf(files), table, presets, links: linksUnder(DESIGN_CONTRAST_PATH) }, meter)
  const looks = looksRow(files, linksUnder(LOOKS_PREFIX))
  const rows = [looks, prepaintRow(table, presets, linksUnder(PREPAINT_PATH)), ...contrast.rows]
  return { rows, measures: contrast.measures }
}

/** The design check of a theme folder, as `check design` runs it. */
export async function checkDesign(themeDir: string): Promise<DesignResult> {
  return checkDesignFiles(readDesignFiles(themeDir), await contrastMeter())
}

/** The lines a person reads: what the check runs against, one line per check (and its items), the verdict. */
export function designLines(themeDir: string, result: DesignResult): string[] {
  const against = `the look and prepaint validators of ${CORE_REPO} at ${CORE_SHA}, and ${DESIGN_CONTRAST_PATH} (kit only)`
  const header = `automatos-theme check design ${themeDir}: ${against}`
  const lines = result.rows.flatMap((item) => [
    `${item.name.padEnd(NAME_WIDTH)}${item.level.padEnd(LEVEL_WIDTH)}${item.text}`,
    ...item.errors.map((error) => `${ITEM_INDENT}${error.code} ${error.path}: ${error.message}`),
  ])
  const checks = Object.fromEntries(result.rows.map((item): [string, CheckEntry] => [item.name, { level: item.level }]))
  const summary = countsOf(checks)
  return [header, ...lines, `verdict: ${verdictOf(checks)} (${LEVELS.map((level) => `${summary[level]} ${level}`).join(', ')})`]
}

/** The folder `check design <folder>` names, or null when the arguments don't make one. */
function parseDesign(argv: readonly string[], cwd: string): string | null {
  try {
    const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {} })
    const [command, subcommand, themeDir, ...extra] = positionals
    if (command !== 'check' || subcommand !== DESIGN_SUBCOMMAND || themeDir === undefined || extra.length > 0) return null
    return resolve(cwd, themeDir)
  } catch {
    return null
  }
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** `check design` (check/index.ts hands it every `check design ...`): the lines, then the exit code. */
export async function designCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  const themeDir = parseDesign(argv, deps.cwd)
  if (themeDir === null) {
    output.err(DESIGN_USAGE)
    return EXIT_USAGE
  }
  if (!isFolder(themeDir)) {
    output.err(`${themeDir} is not a folder: check design takes a theme folder.`)
    return EXIT_USAGE
  }
  const result = await checkDesign(themeDir)
  designLines(themeDir, result).forEach((line) => output.out(line))
  return result.rows.some((item) => item.level === LEVEL_ERROR) ? EXIT_FAILED : EXIT_OK
}
