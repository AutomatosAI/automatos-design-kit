/**
 * theme.json written back with one top-level list of strings set, keeping the author's own layout: the list is
 * replaced where it stands (`"<field>": [ ... ]` at the start of a line), or added after the last field, and every
 * other line stays as it was. The new list is laid out one item a line, as Play's theme.json lays out its previews.
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
const BOM = '\uFEFF'
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g

type JsonObject = Readonly<Record<string, unknown>>

/** `list` as theme.json lays one out: `[`, one item a line under `indent` plus one step, then `]` at `indent`. */
function listText(list: readonly string[], indent: string): string {
  if (list.length === 0) return '[]'
  const items = list.map((item, index) => `${indent}${INDENT_STEP}${JSON.stringify(item)}${index < list.length - 1 ? ',' : ''}`)
  return ['[', ...items, `${indent}]`].join('\n')
}

/** `"<field>": [ ... ]` at the start of a line, its indent captured; a list of plain paths holds no `]`. */
function fieldPattern(field: string): RegExp {
  const name = JSON.stringify(field).replace(REGEX_SPECIALS, '\\$&')
  return new RegExp(`^([ \\t]*)${name}[ \\t]*:[ \\t]*\\[[^\\]]*\\]`, 'm')
}

/** `text` with the field's list replaced in place or added at the end, or null when the layout gives no place for it. */
function spliced(text: string, field: string, list: readonly string[]): string | null {
  const found = fieldPattern(field).exec(text)
  if (found !== null) {
    const indent = found[1]
    const member = `${indent}${JSON.stringify(field)}: ${listText(list, indent)}`
    return `${text.slice(0, found.index)}${member}${text.slice(found.index + found[0].length)}`
  }
  const close = text.lastIndexOf(OBJECT_CLOSE)
  if (close < 0 || text.includes(JSON.stringify(field))) return null
  const indent = FIELD_INDENT.exec(text)?.[1] ?? INDENT_STEP
  const before = text.slice(0, close).trimEnd()
  const comma = before.endsWith(OBJECT_OPEN) ? '' : ','
  return `${before}${comma}\n${indent}${JSON.stringify(field)}: ${listText(list, indent)}\n${text.slice(close)}`
}

/** True when `text` parses to the JSON text `expected` (a leading BOM allowed, as the server's reader allows one). */
function readsAs(text: string, expected: string): boolean {
  try {
    return JSON.stringify(JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text)) === expected
  } catch {
    return false
  }
}

/** theme.json's `text` with its top-level `field` set to `list`; `document` is that text as parsed. */
export function withStringList(text: string, document: JsonObject, field: string, list: readonly string[]): string {
  const changed = { ...document, [field]: [...list] }
  const edited = spliced(text, field, list)
  if (edited !== null && readsAs(edited, JSON.stringify(changed))) return edited
  return `${JSON.stringify(changed, null, INDENT_STEP.length)}\n`
}
