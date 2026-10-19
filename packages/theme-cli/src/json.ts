/**
 * A package file's JSON, read as the server reads it (core contract.py `parse_json`).
 *
 * Refused as BAD_JSON: bytes that aren't UTF-8 JSON text (a leading BOM is allowed), nesting past
 * JSON_MAX_DEPTH, and a lone surrogate escape such as "\ud800", which no UTF-8 writer can carry.
 */
import { themeError, type ThemeError } from './core/css-value.ts'

export const JSON_MAX_DEPTH = 32
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

export interface ParsedJson {
  readonly data: unknown
  readonly error: ThemeError | null
}

/** True when `data` has arrays or objects nested past `limit` (walked without recursion). */
function nestsDeeperThan(data: unknown, limit: number): boolean {
  const stack: Array<readonly [unknown, number]> = [[data, 1]]
  while (stack.length > 0) {
    const [node, depth] = stack.pop() as readonly [unknown, number]
    if (typeof node !== 'object' || node === null) continue
    if (depth > limit) return true
    const children = Array.isArray(node) ? node : Object.values(node)
    children.forEach((child: unknown) => stack.push([child, depth + 1]))
  }
  return false
}

/** True when a key or a string anywhere in `data` holds a lone surrogate. */
function holdsLoneSurrogate(data: unknown): boolean {
  const stack: unknown[] = [data]
  while (stack.length > 0) {
    const node = stack.pop()
    if (typeof node === 'string' && LONE_SURROGATE.test(node)) return true
    if (typeof node !== 'object' || node === null) continue
    if (Array.isArray(node)) {
      stack.push(...node)
    } else {
      Object.entries(node).forEach(([key, value]) => stack.push(key, value))
    }
  }
  return false
}

function badJson(path: string, message: string): ParsedJson {
  return { data: null, error: themeError('BAD_JSON', path, message) }
}

/** `raw` as JSON, or BAD_JSON saying why it can't be. */
export function parseJson(raw: Uint8Array, path: string): ParsedJson {
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  } catch {
    return badJson(path, `${path} is not valid JSON text.`)
  }
  if (nestsDeeperThan(data, JSON_MAX_DEPTH)) return badJson(path, `${path} nests deeper than ${JSON_MAX_DEPTH} levels.`)
  if (holdsLoneSurrogate(data)) return badJson(path, `${path} holds text that isn't valid Unicode.`)
  return { data, error: null }
}
