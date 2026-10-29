/**
 * `automatos-theme check handoff <design folder>`: a design handoff checked before any of the theme is built
 * (guides/designing-a-theme.md, "The handoff"), so a knob the host can't take or a colour pair under its minimum is
 * fixed in the design. It reads the folder's `looks.json` (schema `automatos-theme-handoff/v1`). Three lines, then the
 * verdict:
 *
 * - `handoff`: the file's shape: the theme's id, the presets (one to twelve, each with a tone, a value for its knobs
 *   and the same named `#rrggbb` colours as every other), the default, the pairs and the optional phone block.
 * - `looks`: the knobs and the presets through core's own look validators (looks.ts over the vendored
 *   core/look-schema.ts), with core's codes, as if they were the theme's looks/schema.json and looks/presets/.
 * - `contrast`: every pair on every preset's colours, by the look runtime's own ratio (contrast.ts). A pair under its
 *   `min` (default 4.5) is an error naming the preset, both colours and the ratio.
 *
 * It reads the one file, builds nothing and sends nothing. Exit code 0 when no line is an error, 1 when one is, 2 for a
 * usage error or a path that is not a folder.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { CommandDeps } from '../cli-main.ts'
import { echo, isRecord, themeError, type JsonRecord, type ThemeError } from '../core/css-value.ts'
import { ID_PATTERN } from '../core/package-manifest.ts'
import { lookFileErrors, PRESETS_DIR, SCHEMA_PATH } from '../looks.ts'
import type { Output } from '../output.ts'
import { contrastMeter, DEFAULT_PAIR_MIN, measurePair, type ContrastMeter, type ContrastPair } from './contrast.ts'
import { CORE_REPO, CORE_SHA, countsOf, LEVEL_ERROR, LEVEL_NOT_MEASURED, LEVEL_PASS, LEVELS, verdictOf, type CheckEntry, type Level } from './report.ts'

export const HANDOFF_SUBCOMMAND = 'handoff'
export const HANDOFF_USAGE = 'usage: automatos-theme check handoff <design folder>'
export const HANDOFF_SCHEMA = 'automatos-theme-handoff/v1'
export const HANDOFF_FILE = 'looks.json'
/** The kit's own codes; every other code the looks line lists is core's. */
export const HANDOFF_CODES = Object.freeze({ shape: 'BAD_HANDOFF', underMin: 'CONTRAST_UNDER_MIN', notMeasured: 'CONTRAST_NOT_MEASURED' })
/** The host's boot carries at most twelve presets (guides/looks.md). */
export const MAX_PRESETS = 12
const RESERVED_PUBLISHERS: readonly string[] = ['automatos']
const FIELDS = ['schema', 'theme', 'default', 'knobs', 'presets', 'pairs', 'phone']
const PRESET_FIELDS = ['name', 'sub', 'tone', 'knobs', 'colours']
const PAIR_FIELDS = ['text', 'ground', 'min']
const PHONE_FIELDS = ['colours', 'fonts', 'mascot']
const TONES = ['light', 'dark']
const PHONE_COLOURS = ['looks', 'schemes']
const PHONE_ROLES = ['serif', 'sans', 'mono']
const PHONE_MASCOTS = ['clips', 'stills', 'none']
const HEX = /^#[0-9a-f]{6}$/i
/** The look schema id the handoff's knobs are checked under: any valid one serves. */
const LOOK_SCHEMA_ID = 'handoff-look/v1'
const RATIO_DECIMALS = 2
const EXIT_OK = 0
const EXIT_FAILED = 1
const EXIT_USAGE = 2
const NAME_WIDTH = 18
const LEVEL_WIDTH = 13
const ITEM_INDENT = '    '

export interface HandoffRow {
  readonly name: 'handoff' | 'looks' | 'contrast'
  readonly level: Level
  readonly text: string
  readonly errors: readonly ThemeError[]
}

const at = (path: string): string => `${HANDOFF_FILE}#${path}`
const bad = (path: string, message: string): ThemeError => themeError(HANDOFF_CODES.shape, at(path), `${at(path)}: ${message}`)

function unknownFields(record: JsonRecord, known: readonly string[], path: string): ThemeError[] {
  return Object.keys(record).filter((key) => !known.includes(key)).map((key) => bad(path ? `${path}.${key}` : key, `"${echo(key)}" is not a field of a handoff here.`))
}

function idErrors(theme: unknown): ThemeError[] {
  if (typeof theme !== 'string' || !ID_PATTERN.test(theme)) return [bad('theme', 'the theme\'s id is publisher/name, in lower-case letters, digits and dashes.')]
  return RESERVED_PUBLISHERS.includes(theme.split('/')[0]) ? [bad('theme', 'the automatos publisher is reserved for Automatos\'s own themes.')] : []
}

function colourErrors(colours: unknown, path: string, names: readonly string[] | null): ThemeError[] {
  if (!isRecord(colours) || Object.keys(colours).length === 0) return [bad(path, 'colours are named #rrggbb values, one or more.')]
  const wrong = Object.entries(colours).filter(([, value]) => typeof value !== 'string' || !HEX.test(value))
  const errors = wrong.map(([name]) => bad(`${path}.${name}`, 'a colour is #rrggbb.'))
  const keys = Object.keys(colours).sort()
  if (names !== null && keys.join() !== [...names].sort().join()) errors.push(bad(path, 'every preset names the same colours.'))
  return errors
}

function presetShapeErrors(id: string, preset: unknown, names: readonly string[] | null): ThemeError[] {
  const path = `presets.${id}`
  if (!isRecord(preset)) return [bad(path, 'a preset is an object.')]
  return [
    ...unknownFields(preset, PRESET_FIELDS, path),
    ...(TONES.includes(String(preset.tone)) ? [] : [bad(`${path}.tone`, 'a preset\'s tone is light or dark.')]),
    ...(isRecord(preset.knobs) ? [] : [bad(`${path}.knobs`, 'a preset gives a value for each knob.')]),
    ...colourErrors(preset.colours, `${path}.colours`, names),
  ]
}

function presetsErrors(presets: unknown, fallback: unknown): ThemeError[] {
  if (!isRecord(presets)) return [bad('presets', 'the presets are an object of preset ids.')]
  const entries = Object.entries(presets)
  const count = entries.length === 0 || entries.length > MAX_PRESETS ? [bad('presets', `one to ${MAX_PRESETS} presets.`)] : []
  const first = entries.map(([, preset]) => (isRecord(preset) && isRecord(preset.colours) ? Object.keys(preset.colours) : null)).find((names) => names !== null) ?? null
  const shapes = entries.flatMap(([id, preset]) => presetShapeErrors(id, preset, first))
  const named = typeof fallback === 'string' && Object.hasOwn(presets, fallback) ? [] : [bad('default', 'the default is one of the presets\' ids.')]
  return [...count, ...shapes, ...named]
}

function pairsErrors(pairs: unknown): ThemeError[] {
  if (!Array.isArray(pairs)) return [bad('pairs', 'the pairs are a list of {text, ground, min}.')]
  return pairs.flatMap((pair, index): ThemeError[] => {
    const path = `pairs[${index}]`
    if (!isRecord(pair)) return [bad(path, 'a pair is {text, ground, min}.')]
    const named = typeof pair.text === 'string' && typeof pair.ground === 'string' ? [] : [bad(path, 'a pair names two colours, text and ground.')]
    const min = pair.min === undefined || (typeof pair.min === 'number' && pair.min >= 1 && pair.min <= 21) ? [] : [bad(`${path}.min`, 'a minimum is a ratio from 1 to 21.')]
    return [...unknownFields(pair, PAIR_FIELDS, path), ...named, ...min]
  })
}

function phoneErrors(phone: unknown): ThemeError[] {
  if (phone === undefined) return []
  if (!isRecord(phone)) return [bad('phone', 'the phone block is an object.')]
  const fonts = isRecord(phone.fonts) ? phone.fonts : {}
  const faces = Object.values(fonts)
  return [
    ...unknownFields(phone, PHONE_FIELDS, 'phone'),
    ...(phone.colours === undefined || PHONE_COLOURS.includes(String(phone.colours)) ? [] : [bad('phone.colours', 'looks or schemes.')]),
    ...(phone.mascot === undefined || PHONE_MASCOTS.includes(String(phone.mascot)) ? [] : [bad('phone.mascot', 'clips, stills or none.')]),
    ...Object.keys(fonts).filter((role) => !PHONE_ROLES.includes(role)).map((role) => bad(`phone.fonts.${role}`, 'a font\'s role is serif, sans or mono.')),
    ...(new Set(faces).size === faces.length ? [] : [bad('phone.fonts', 'each role takes a face of its own: the phone takes one file per role.')]),
  ]
}

/** Every refusal of the handoff's shape. */
export function shapeErrors(data: unknown): ThemeError[] {
  if (!isRecord(data)) return [bad('', 'the handoff is a JSON object.')]
  return [
    ...unknownFields(data, FIELDS, ''),
    ...(data.schema === HANDOFF_SCHEMA ? [] : [bad('schema', `the schema is ${HANDOFF_SCHEMA}.`)]),
    ...idErrors(data.theme),
    ...(isRecord(data.knobs) ? [] : [bad('knobs', 'the knobs are an object of knob names.')]),
    ...presetsErrors(data.presets, data.default),
    ...pairsErrors(data.pairs),
    ...phoneErrors(data.phone),
  ]
}

const encoder = new TextEncoder()
const asFile = (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value))

/** The knobs and presets as the theme's look files, for core's validators. */
function lookFiles(data: JsonRecord): ReadonlyMap<string, Uint8Array> {
  const schema = { schema: 'automatos-look-schema/v1', look: { schema: LOOK_SCHEMA_ID }, knobs: data.knobs }
  const presets = isRecord(data.presets) ? Object.entries(data.presets) : []
  const files = presets.map(([id, preset]): [string, Uint8Array] => {
    const fields = isRecord(preset) ? preset : {}
    const knobs = isRecord(fields.knobs) ? fields.knobs : {}
    const look = { schema: LOOK_SCHEMA_ID, id, name: fields.name, sub: fields.sub ?? '', ...knobs }
    return [`${PRESETS_DIR}${id}.look.json`, asFile(look)]
  })
  return new Map([[SCHEMA_PATH, asFile(schema)], ...files])
}

/** A core refusal, its paths in the handoff's words. */
function inHandoff(error: ThemeError): ThemeError {
  const rename = (text: string): string => text
    .replaceAll(SCHEMA_PATH, HANDOFF_FILE)
    .replace(new RegExp(`${PRESETS_DIR}([^#:\\s]+)\\.look\\.json`, 'g'), `${HANDOFF_FILE}#presets.$1`)
  return themeError(error.code, rename(error.path), rename(error.message))
}

function looksRow(data: JsonRecord): HandoffRow {
  const errors = lookFileErrors(lookFiles(data)).map(inHandoff)
  const count = isRecord(data.presets) ? Object.keys(data.presets).length : 0
  return errors.length > 0
    ? { name: 'looks', level: LEVEL_ERROR, text: 'The knobs or presets don\'t pass core\'s look validators.', errors }
    : { name: 'looks', level: LEVEL_PASS, text: `The knobs and ${count} preset(s) pass core's look validators.`, errors }
}

function pairsOf(data: JsonRecord): ContrastPair[] {
  const pairs = Array.isArray(data.pairs) ? data.pairs.filter(isRecord) : []
  return pairs.map((pair) => ({ text: String(pair.text), ground: String(pair.ground), min: typeof pair.min === 'number' ? pair.min : DEFAULT_PAIR_MIN }))
}

function pairError(preset: string, pair: ContrastPair, meter: ContrastMeter, colours: Readonly<Record<string, string>>): ThemeError[] {
  const measure = measurePair(meter, colours, pair)
  const where = at(`presets.${preset}`)
  if (measure.status === 'pass') return []
  if (measure.status === 'not_measured') {
    return [themeError(HANDOFF_CODES.notMeasured, where, `${where}: ${pair.text} on ${pair.ground} can't be measured: ${measure.unread.map((item) => item.name).join(' and ')} isn't one of its colours.`)]
  }
  const ratio = (measure.ratio ?? 0).toFixed(RATIO_DECIMALS)
  return [themeError(HANDOFF_CODES.underMin, where, `${where}: ${pair.text} on ${pair.ground} is ${ratio}:1, under ${pair.min}:1.`)]
}

function contrastRow(data: JsonRecord, meter: ContrastMeter): HandoffRow {
  const pairs = pairsOf(data)
  const presets = isRecord(data.presets) ? Object.entries(data.presets) : []
  if (pairs.length === 0) return { name: 'contrast', level: LEVEL_NOT_MEASURED, text: 'The handoff declares no colour pairs, so contrast isn\'t measured.', errors: [] }
  const errors = presets.flatMap(([id, preset]) => {
    const colours = isRecord(preset) && isRecord(preset.colours) ? (preset.colours as Record<string, string>) : {}
    return pairs.flatMap((pair) => pairError(id, pair, meter, colours))
  })
  const scope = `${pairs.length} pair(s) on ${presets.length} preset(s)`
  return errors.length > 0
    ? { name: 'contrast', level: LEVEL_ERROR, text: `${errors.length} problem(s) in ${scope}.`, errors }
    : { name: 'contrast', level: LEVEL_PASS, text: `${scope}, each at or above its minimum.`, errors }
}

/** The handoff check over the folder's looks.json, measured with `meter`. */
export function checkHandoffText(text: string | null, meter: ContrastMeter): HandoffRow[] {
  if (text === null) return [{ name: 'handoff', level: LEVEL_ERROR, text: `The folder has no ${HANDOFF_FILE}.`, errors: [bad('', `a handoff carries its knobs and presets in ${HANDOFF_FILE}.`)] }]
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return [{ name: 'handoff', level: LEVEL_ERROR, text: `${HANDOFF_FILE} isn't JSON.`, errors: [bad('', 'the file must be JSON.')] }]
  }
  const shape = shapeErrors(data)
  const first: HandoffRow = shape.length > 0
    ? { name: 'handoff', level: LEVEL_ERROR, text: `${HANDOFF_FILE} isn't a handoff this kit can build from.`, errors: shape }
    : { name: 'handoff', level: LEVEL_PASS, text: `${HANDOFF_FILE} is a ${HANDOFF_SCHEMA} handoff.`, errors: [] }
  if (!isRecord(data)) return [first]
  return [first, looksRow(data), contrastRow(data, meter)]
}

function handoffLines(folder: string, rows: readonly HandoffRow[]): string[] {
  const header = `automatos-theme check handoff ${folder}: the look validators of ${CORE_REPO} at ${CORE_SHA}, and the handoff's colour pairs (kit only)`
  const lines = rows.flatMap((item) => [
    `${item.name.padEnd(NAME_WIDTH)}${item.level.padEnd(LEVEL_WIDTH)}${item.text}`,
    ...item.errors.map((error) => `${ITEM_INDENT}${error.code} ${error.path}: ${error.message}`),
  ])
  const checks = Object.fromEntries(rows.map((item): [string, CheckEntry] => [item.name, { level: item.level }]))
  const summary = countsOf(checks)
  return [header, ...lines, `verdict: ${verdictOf(checks)} (${LEVELS.map((level) => `${summary[level]} ${level}`).join(', ')})`]
}

function parseHandoff(argv: readonly string[], cwd: string): string | null {
  try {
    const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {} })
    const [command, subcommand, folder, ...extra] = positionals
    if (command !== 'check' || subcommand !== HANDOFF_SUBCOMMAND || folder === undefined || extra.length > 0) return null
    return resolve(cwd, folder)
  } catch {
    return null
  }
}

/** `check handoff` (check/index.ts hands it every `check handoff ...`): the lines, then the exit code. */
export async function handoffCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  const folder = parseHandoff(argv, deps.cwd)
  if (folder === null) {
    output.err(HANDOFF_USAGE)
    return EXIT_USAGE
  }
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    output.err(`${folder} is not a folder: check handoff takes the design's handoff folder.`)
    return EXIT_USAGE
  }
  const file = join(folder, HANDOFF_FILE)
  const text = existsSync(file) ? readFileSync(file, 'utf8') : null
  const rows = checkHandoffText(text, await contrastMeter())
  handoffLines(folder, rows).forEach((line) => output.out(line))
  return rows.some((item) => item.level === LEVEL_ERROR) ? EXIT_FAILED : EXIT_OK
}
