/**
 * The error shape the theme checks return, and how a message quotes the input back.
 *
 * Mirrors `theme_error` and `echo` in core's orchestrator/services/themes/contract.py (and their
 * TypeScript twins in frontend/lib/theme-host/css-value.ts): a message quotes at most ECHO_MAX
 * characters, with anything that could break the line or hide text shown as '?'.
 */

/** One refusal: a code, where it is (a file or a dotted field) and a sentence. */
export interface ThemeError {
  readonly code: string
  readonly path: string
  readonly message: string
}

const ECHO_MAX = 40
const ECHO_REPLACEMENT = '?'
const ELLIPSIS = '…'

/**
 * One character that doesn't belong in one line of plain text: a format character other than
 * ZWNJ/ZWJ, a control, a line or paragraph separator, private use, unassigned, or a variation
 * selector 17 to 256 (frontend/lib/text/plain-line.ts UNSAFE_TEXT).
 */
const UNSAFE_CHAR = /(?:(?![‌‍])\p{Cf}|[\p{Cc}\p{Zl}\p{Zp}\p{Co}\p{Cn}\u{E0100}-\u{E01EF}])/u

export function themeError(code: string, path: string, message: string): ThemeError {
  return Object.freeze({ code, path, message })
}

/** `text` as a message may quote it: unsafe characters as '?', at most ECHO_MAX characters. */
export function echo(text: string): string {
  const chars = Array.from(text)
  const shown = chars.slice(0, ECHO_MAX).map((char) => (UNSAFE_CHAR.test(char) ? ECHO_REPLACEMENT : char)).join('')
  return chars.length > ECHO_MAX ? `${shown}${ELLIPSIS}` : shown
}
