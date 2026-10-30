/**
 * What the browser would leave out of a theme's first paint and looks, refused before the theme ships.
 *
 * Core's browser takes boot/prepaint.json through its own gate before it paints anything
 * (frontend/lib/theme-host/boot-sanitize.ts `sanitizePrepaint`; mobile-paint.ts `bootTable` is the kit's
 * port), and its look runtime builds a theme's look spec from the kept table alone
 * (frontend/lib/theme-host/looks/spec.ts `lookSpecOf`): one choice knob for each table under `knobs`, one
 * number knob for each `numeric` rule's knob. Core's prepaint grammar (core/css-value.ts) accepts two
 * things that are lost there with no error, so a theme could pass every check and still ship broken:
 *
 * - a value the gate drops (`prepaintDropErrors`, BAD_CSS_VALUE): a gradient, color-mix() or another
 *   function it never runs, a character it refuses, more than 200 characters. Every value built on it
 *   with var() is then invalid at computed-value time, so the theme paints less and nothing says why;
 * - a looks/schema.json knob the kept table never paints (`unpaintedKnobErrors`, KNOB_NOT_PAINTED): the
 *   look spec leaves it out, so every look that has it fails, the presets included, and the look editor
 *   changes nothing.
 *
 * Both look only at a table core's prepaint checks pass. A table whose defaults don't fit what the gate
 * keeps is dropped whole by the browser (check design's PREPAINT_DEFAULTS_UNFIT), so there is no look spec
 * to hold the schema to and no KNOB_NOT_PAINTED for it. The codes, paths and sentences are core's reader's
 * (orchestrator/services/themes/first_paint.py and css_value.py `prepaint_drop_errors`, which refuse both on
 * upload once core ships them); `check design` and `check` report them ahead of that.
 */
import { echo, isRecord, own, prepaintErrors, PREPAINT_PATH, themeError, type JsonRecord, type ThemeError } from './core/css-value.ts'
import { validateLookSchema, type LookSchema } from './core/look-schema.ts'
import { parseJson } from './json.ts'
import { SCHEMA_PATH } from './looks.ts'
import { bootTable, bootValueProblem, type BootTable } from './mobile-paint.ts'

export const KNOB_NOT_PAINTED = 'KNOB_NOT_PAINTED'
/** The code core gives a prepaint value it refuses, a dropped one among them. */
export const DROPPED_VALUE = 'BAD_CSS_VALUE'
/** css-value.ts PREPAINT_MAX_ERRORS: a table's refusals stop at this many. */
const MAX_ERRORS = 20
const VARIABLE_PREFIX = '--'
const DROPPED = "the browser's first paint drops it, and every value built on it"

/** One cell of the table: its dotted path, the look it paints for and its variables. */
type Cell = readonly [path: string, look: string, variables: unknown]

/** Every option of every table under `knobs`. */
function knobCells(document: JsonRecord): Cell[] {
  const knobs = own(document, 'knobs')
  if (!isRecord(knobs)) return []
  return Object.keys(knobs).flatMap((knob) => {
    const options = knobs[knob]
    if (!isRecord(options)) return []
    return Object.keys(options).map((option): Cell => [`knobs.${knob}.${option}`, `${echo(knob)} "${echo(option)}"`, options[option]])
  })
}

/** Every cell of one pair table whose two knobs are named. */
function pairCells(pair: unknown, index: number): Cell[] {
  if (!isRecord(pair)) return []
  const [a, b, table] = [own(pair, 'a'), own(pair, 'b'), own(pair, 'table')]
  if (typeof a !== 'string' || typeof b !== 'string' || !isRecord(table)) return []
  return Object.keys(table).flatMap((row) => {
    const columns = table[row]
    if (!isRecord(columns)) return []
    const look = (column: string): string => `${echo(a)} "${echo(row)}" and ${echo(b)} "${echo(column)}"`
    return Object.keys(columns).map((column): Cell => [`pairs[${index}].table.${row}.${column}`, look(column), columns[column]])
  })
}

/** A refusal for each variable of one cell whose value the gate drops: the variable, the look and why. */
function cellDrops([path, look, variables]: Cell): ThemeError[] {
  if (!isRecord(variables)) return []
  return Object.keys(variables).flatMap((name) => {
    const problem = name.startsWith(VARIABLE_PREFIX) ? bootValueProblem(variables[name]) : null
    if (problem === null) return []
    const where = `${PREPAINT_PATH}#${echo(`${path}.${name}`)}`
    return [themeError(DROPPED_VALUE, where, `${where}: ${echo(name)} for ${look} is ${problem}: ${DROPPED}.`)]
  })
}

/** Every value of the table's knob and pair cells (the ones sanitizeVars reads) the first paint drops. */
export function prepaintDropErrors(document: unknown): ThemeError[] {
  if (!isRecord(document)) return []
  const pairs = own(document, 'pairs')
  const pairList = Array.isArray(pairs) ? pairs.flatMap((pair: unknown, index) => pairCells(pair, index)) : []
  return [...knobCells(document), ...pairList].flatMap(cellDrops).slice(0, MAX_ERRORS)
}

/** `lookSpecOf`'s knobs: each table's under `knobs`, then each numeric rule's knob. */
export function paintedKnobs(table: BootTable): ReadonlySet<string> {
  return new Set([...Object.keys(table.knobs), ...table.numeric.map((rule) => rule.knob)])
}

function notPainted(name: string): ThemeError {
  const knob = echo(name)
  const where = `${SCHEMA_PATH}#knobs.${knob}`
  return themeError(KNOB_NOT_PAINTED, where, (
    `${where}: "${knob}" is a knob the look table never paints: the browser builds a theme's looks from `
    + `${PREPAINT_PATH} alone (a choice knob for each table under "knobs", a number knob for each "numeric" `
    + `rule), so its look spec leaves "${knob}" out and every look fails, the presets included. Paint it `
    + 'there, or take it out of the schema.'
  ))
}

/** A KNOB_NOT_PAINTED for each knob of `schema` the table, as the browser keeps it, never paints. */
export function unpaintedKnobErrors(schema: LookSchema, prepaint: unknown): ThemeError[] {
  const kept = bootTable(prepaint)
  if (kept === null) return []
  const painted = paintedKnobs(kept)
  return Array.from(schema.knobs.keys()).filter((name) => !painted.has(name)).map(notPainted)
}

/** A file's JSON, or undefined when it is absent or not JSON (other checks refuse that). */
function jsonOf(files: ReadonlyMap<string, Uint8Array>, path: string): unknown {
  const raw = files.get(path)
  if (raw === undefined) return undefined
  const { data, error } = parseJson(raw, path)
  return error === null ? data : undefined
}

/** Both checks over a theme's files by path: empty without a table, or with one core's prepaint checks refuse. */
export function firstPaintErrors(files: ReadonlyMap<string, Uint8Array>): ThemeError[] {
  const table = jsonOf(files, PREPAINT_PATH)
  if (!isRecord(table) || prepaintErrors(table).length > 0) return []
  const { schema } = validateLookSchema(jsonOf(files, SCHEMA_PATH))
  return [...prepaintDropErrors(table), ...(schema === null ? [] : unpaintedKnobErrors(schema, table))]
}
