/**
 * theme.json written back with one top-level field set, keeping the author's own layout: the field's value is
 * replaced where it stands (`"<field>": ...` at the start of a line), or the field is added after the last one, and
 * every other line stays as it was.
 *
 * - `withStringList` (previews): a list of strings, laid out one item a line, as Play's theme.json lays out its
 *   previews.
 * - `withField` (skin): any JSON value, such as the `mobile` block, laid out as JSON with two-space steps under the
 *   field's own indent; the value it replaces is found by reading the text from the field's `{` or `[` to the one
 *   that closes it (strings and their escapes skipped).
 *
 * The edit is read back before it is used: when the text does not parse to the document with that field set (a
 * layout this edit can't follow, such as the field written on one line with another), the whole file is written
 * again as JSON with two-space indents instead.
 */

const INDENT_STEP = '  '
/** The indent of the document's first field, which a field added at the end takes. */
const FIELD_INDENT = /^([ \t]+)"/m
const OBJECT_OPEN = '{'
const OBJECT_CLOSE = '}'
const LIST_OPEN = '['
const LIST_CLOSE = ']'
const QUOTE = '"'
const ESCAPE = '\\'
const BOM = '\uFEFF'
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g

type JsonObject = Readonly<Record<string, unknown>>

/** `list` as theme.json lays one out: `[`, one item a line under `indent` plus one step, then `]` at `indent`. */
function listText(list: readonly string[], indent: string): string {
  if (list.length === 0) return '[]'
  const items = list.map((item, index) => `${indent}${INDENT_STEP}${JSON.stringify(item)}${index < list.length - 1 ? ',' : ''}`)
  return ['[', ...items, `${indent}]`].join('\n')
}

/** `value` as JSON with two-space steps, each line after the first under `indent`. */
function valueText(value: unknown, indent: string): string {
  return JSON.stringify(value, null, INDENT_STEP.length).split('\n').join(`\n${indent}`)
}

/** The field's name as a pattern: its JSON string, regex specials escaped. */
function nameSource(field: string): string {
  return JSON.stringify(field).replace(REGEX_SPECIALS, '\\$&')
}

/** `"<field>": [ ... ]` at the start of a line, its indent captured; a list of plain paths holds no `]`. */
function fieldPattern(field: string): RegExp {
  return new RegExp(`^([ \\t]*)${nameSource(field)}[ \\t]*:[ \\t]*\\[[^\\]]*\\]`, 'm')
}

/** `"<field>":` at the start of a line and the space after it, its indent captured. */
function keyPattern(field: string): RegExp {
  return new RegExp(`^([ \\t]*)${nameSource(field)}[ \\t]*:[ \\t]*`, 'm')
}

/** `text` with `"<field>": <rendered>` added after the last field, or null when the field's name is in it already. */
function appended(text: string, field: string, render: (indent: string) => string): string | null {
  const close = text.lastIndexOf(OBJECT_CLOSE)
  if (close < 0 || text.includes(JSON.stringify(field))) return null
  const indent = FIELD_INDENT.exec(text)?.[1] ?? INDENT_STEP
  const before = text.slice(0, close).trimEnd()
  const comma = before.endsWith(OBJECT_OPEN) ? '' : ','
  return `${before}${comma}\n${indent}${JSON.stringify(field)}: ${render(indent)}\n${text.slice(close)}`
}

/** `text` with the field's list replaced in place or added at the end, or null when the layout gives no place for it. */
function spliced(text: string, field: string, list: readonly string[]): string | null {
  const found = fieldPattern(field).exec(text)
  if (found === null) return appended(text, field, (indent) => listText(list, indent))
  const indent = found[1]
  const member = `${indent}${JSON.stringify(field)}: ${listText(list, indent)}`
  return `${text.slice(0, found.index)}${member}${text.slice(found.index + found[0].length)}`
}

/** The index just past the JSON object or list that opens at `start`, or -1 when none opens there or it never closes. */
export function valueEnd(text: string, start: number): number {
  if (text[start] !== OBJECT_OPEN && text[start] !== LIST_OPEN) return -1
  let depth = 0
  let quoted = false
  for (let at = start; at < text.length; at += 1) {
    const char = text[at]
    if (quoted) {
      if (char === ESCAPE) at += 1
      else if (char === QUOTE) quoted = false
    } else if (char === QUOTE) {
      quoted = true
    } else if (char === OBJECT_OPEN || char === LIST_OPEN) {
      depth += 1
    } else if (char === OBJECT_CLOSE || char === LIST_CLOSE) {
      depth -= 1
      if (depth === 0) return at + 1
    }
  }
  return -1
}

/** `text` with the field's object or list replaced in place or the field added at the end, or null (module comment). */
function splicedValue(text: string, field: string, value: unknown): string | null {
  const found = keyPattern(field).exec(text)
  if (found === null) return appended(text, field, (indent) => valueText(value, indent))
  const end = valueEnd(text, found.index + found[0].length)
  if (end < 0) return null
  const indent = found[1]
  return `${text.slice(0, found.index)}${indent}${JSON.stringify(field)}: ${valueText(value, indent)}${text.slice(end)}`
}

/** True when `text` parses to the JSON text `expected` (a leading BOM allowed, as the server's reader allows one). */
function readsAs(text: string, expected: string): boolean {
  try {
    return JSON.stringify(JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text)) === expected
  } catch {
    return false
  }
}

/** The edit when it reads back as `changed`, else `changed` written whole. */
function keptOrWhole(edited: string | null, changed: JsonObject): string {
  if (edited !== null && readsAs(edited, JSON.stringify(changed))) return edited
  return `${JSON.stringify(changed, null, INDENT_STEP.length)}\n`
}

/** theme.json's `text` with its top-level `field` set to `list`; `document` is that text as parsed. */
export function withStringList(text: string, document: JsonObject, field: string, list: readonly string[]): string {
  return keptOrWhole(spliced(text, field, list), { ...document, [field]: [...list] })
}

/** theme.json's `text` with its top-level `field` set to the JSON `value`; `document` is that text as parsed. */
export function withField(text: string, document: JsonObject, field: string, value: unknown): string {
  return keptOrWhole(splicedValue(text, field, value), { ...document, [field]: value })
}
