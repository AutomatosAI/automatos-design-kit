/**
 * What the browser would leave out of a theme's first paint and looks: core's reader refuses it on upload, and so
 * does `pack` (check-package.ts), `check`, `check design` and the Marketplace review's Package check.
 *
 * A port of core's orchestrator/services/themes/first_paint.py (its TypeScript twin is
 * frontend/lib/theme-host/first-paint.ts), at the commit src/core/README.md names. Core's browser takes
 * boot/prepaint.json through its own gate before it paints anything (frontend/lib/theme-host/boot-sanitize.ts
 * `sanitizePrepaint`; mobile-paint.ts `bootTable` is the kit's port), and its look runtime builds a theme's look
 * spec from the kept table alone (frontend/lib/theme-host/looks/spec.ts `lookSpecOf`): one choice knob for each
 * table under `knobs`, one number knob for each `numeric` rule's knob. What core's prepaint grammar
 * (core/css-value.ts `prepaintErrors`) accepts but is lost there with no error is refused:
 *
 * - what the gate drops of the table (core/css-value.ts `prepaintDropErrors`, vendored): a table, a pair table or
 *   a numeric rule whose knob name it refuses (BAD_PREPAINT), and a cell's value it refuses (BAD_CSS_VALUE: a
 *   gradient, color-mix() or another function it never runs, a character it refuses, more than 200 characters).
 *   Every value built on a dropped one with var() is invalid at computed-value time, so the theme paints less and
 *   nothing says why;
 * - defaults that don't fit what the gate keeps (PREPAINT_DEFAULTS_UNFIT): the browser drops the whole table, so
 *   nothing is painted from it and the theme has no looks;
 * - a looks/schema.json knob the kept table never paints (KNOB_NOT_PAINTED): the look spec leaves it out, so every
 *   look that has it fails, the presets included, and the look editor changes nothing;
 * - a knob the kept table paints that the schema doesn't declare (KNOB_NOT_IN_SCHEMA): the look spec needs it in
 *   every look, and no look may carry it, so every look fails the same way.
 *
 * All of them look only at a table core's prepaint grammar accepted (it refuses the rest on its own). The codes,
 * paths and sentences are core's; the corpus's `firstPaint` and `packages` cases hold them to it
 * (test/core-corpus.test.ts).
 */
import { echo, isRecord, own, prepaintDropErrors, prepaintErrors, PREPAINT_PATH, themeError, type JsonRecord, type ThemeError } from './core/css-value.ts'
import type { LookSchema } from './core/look-schema.ts'
import { parseJson } from './json.ts'
import { checkedLookSchema, SCHEMA_PATH } from './looks.ts'
import { bootTable, type BootTable } from './mobile-paint.ts'

export const KNOB_NOT_PAINTED = 'KNOB_NOT_PAINTED'
export const KNOB_NOT_IN_SCHEMA = 'KNOB_NOT_IN_SCHEMA'
export const PREPAINT_DEFAULTS_UNFIT = 'PREPAINT_DEFAULTS_UNFIT'
/** first_paint.py FIRST_PAINT_ERROR_CODES. */
export const FIRST_PAINT_ERROR_CODES: readonly string[] = [
  'BAD_PREPAINT', 'BAD_CSS_VALUE', PREPAINT_DEFAULTS_UNFIT, KNOB_NOT_PAINTED, KNOB_NOT_IN_SCHEMA,
]
const SPEC = `the browser builds a theme's looks from ${PREPAINT_PATH} alone (a choice knob for each table under "knobs", `
  + 'a number knob for each "numeric" rule)'

/** first_paint.py `spec_knobs`, `lookSpecOf`'s knobs in its order: each table's under `knobs`, then each numeric rule's knob once. */
export function specKnobs(table: BootTable): string[] {
  const tables = Object.keys(table.knobs)
  const numbers = table.numeric.map((rule) => rule.knob)
  return [...tables, ...numbers.filter((knob, at) => !tables.includes(knob) && numbers.indexOf(knob) === at)]
}

function notPainted(name: string): ThemeError {
  const knob = echo(name)
  const where = `${SCHEMA_PATH}#knobs.${knob}`
  return themeError(KNOB_NOT_PAINTED, where, (
    `${where}: "${knob}" is a knob the look table never paints: ${SPEC}, so its look spec leaves "${knob}" out `
    + 'and every look fails, the presets included. Paint it there, or take it out of the schema.'
  ))
}

function notInSchema(name: string, table: BootTable, document: JsonRecord): ThemeError {
  const knob = echo(name)
  const rules = own(document, 'numeric')
  const at = Math.max(0, (Array.isArray(rules) ? rules : []).findIndex((rule: unknown) => isRecord(rule) && own(rule, 'knob') === name))
  const where = Object.prototype.hasOwnProperty.call(table.knobs, name) ? `${PREPAINT_PATH}#knobs.${knob}` : `${PREPAINT_PATH}#numeric[${at}].knob`
  return themeError(KNOB_NOT_IN_SCHEMA, where, (
    `${where}: "${knob}" is a knob the table paints that ${SCHEMA_PATH} doesn't declare: ${SPEC}, so its look spec `
    + `needs "${knob}" in every look and no look may carry it, and every look fails, the presets included. Declare `
    + 'it in the schema, or take it out of the table.'
  ))
}

function unfit(): ThemeError {
  const where = `${PREPAINT_PATH}#defaults`
  return themeError(PREPAINT_DEFAULTS_UNFIT, where, (
    `${where}: "defaults" don't fit what the browser's first paint keeps of the table (an option of every knob `
    + 'table, a cell of every pair table, and for every numeric rule a value in range and a colour it keeps), so it '
    + 'drops the whole table: nothing is painted from it and the theme has no looks.'
  ))
}

/** first_paint.py `unpainted_knob_errors`: a KNOB_NOT_PAINTED for each knob of `schema` the kept table never paints. */
export function unpaintedKnobErrors(schema: LookSchema, prepaint: unknown): ThemeError[] {
  const kept = bootTable(prepaint)
  if (kept === null) return []
  const painted = specKnobs(kept)
  return Array.from(schema.knobs.keys()).filter((name) => !painted.includes(name)).map(notPainted)
}

/** first_paint.py `unknown_knob_errors`: a KNOB_NOT_IN_SCHEMA for each knob the kept table paints and `schema` lacks. */
export function unknownKnobErrors(schema: LookSchema, prepaint: unknown): ThemeError[] {
  const kept = bootTable(prepaint)
  if (kept === null || !isRecord(prepaint)) return []
  return specKnobs(kept).filter((name) => !schema.knobs.has(name)).map((name) => notInSchema(name, kept, prepaint))
}

/** first_paint.py `first_paint_table_errors`: every refusal above for one table and the theme's checked look schema (null: none). */
export function firstPaintTableErrors(schema: LookSchema | null, table: unknown): ThemeError[] {
  if (!isRecord(table) || prepaintErrors(table).length > 0) return []
  const dropped = prepaintDropErrors(table)
  if (bootTable(table) === null) return [...dropped, unfit()]
  return schema === null ? dropped : [...dropped, ...unpaintedKnobErrors(schema, table), ...unknownKnobErrors(schema, table)]
}

/**
 * first_paint.py `first_paint_errors`, over a theme's files by path: the table held to the look schema the reader
 * checked (looks.ts `checkedLookSchema`). Empty without a table, or with one that isn't JSON (other checks refuse that).
 */
export function firstPaintErrors(files: ReadonlyMap<string, Uint8Array>): ThemeError[] {
  const raw = files.get(PREPAINT_PATH)
  if (raw === undefined) return []
  const { data, error } = parseJson(raw, PREPAINT_PATH)
  return error === null ? firstPaintTableErrors(checkedLookSchema(files), data) : []
}
