// The looks tests' helpers, moved from core's lib/looks/__tests__/helpers.ts: a saved look of the user's
// own, the look's names on <html> and <html> put back as a fresh page has it. Its imports are the theme's own
// (src/lib/looks), and the two <html> classes clearRoot takes off are named here: Play's is theme.json's
// htmlClass, Studio's is core's STUDIO_HTML_CLASS (lib/ui-style.ts), the base style Play is drawn on.
// Core's memoryStorage and blockedStorage are not moved: only core's storage and store tests (host
// runtime, which stay in core) used them, and a theme's state goes through the SDK's storage area
// (test/support/memory-storage.ts).
import { MOTION_ATTRIBUTE } from '../../../src/lib/looks/document.ts'
import { LOOK_VAR_NAMES, STUDIO_TOKEN_NAMES } from '../../../src/lib/looks/engine.ts'
import { EMBER } from '../../../src/lib/looks/presets.ts'
import type { Look } from '../../../src/lib/looks/types.ts'
import { readThemeFile } from '../../source-files.ts'

/** Studio's class on <html> (core's lib/ui-style.ts STUDIO_HTML_CLASS): theme.json's base style. */
const STUDIO_HTML_CLASS = 'studio'

/** Play's class on <html>: theme.json's htmlClass. */
function playHtmlClass(): string {
  const { htmlClass } = JSON.parse(readThemeFile('theme.json')) as { readonly htmlClass?: unknown }
  if (typeof htmlClass !== 'string') throw new Error('theme.json names no htmlClass')
  return htmlClass
}

const PLAY_HTML_CLASS = playHtmlClass()

/** A valid saved look of the user's own. */
export function myLook(fields: Partial<Look> = {}): Look {
  return { ...EMBER, id: 'my-look-1', name: 'My look 1', sub: 'Saved just now', accent: 'rose', ground: 'indigo', ...fields }
}

/** Play's variables and Studio's tokens currently inline on <html> ('' where unset). */
export function rootVars(): Readonly<Record<string, string>> {
  const { style } = document.documentElement
  return Object.fromEntries(
    [...LOOK_VAR_NAMES, ...STUDIO_TOKEN_NAMES].map((name) => [name, style.getPropertyValue(name).trim()]),
  )
}

/** The look's names that are still set inline on <html>. */
export function lookNamesLeft(): readonly string[] {
  return Object.entries(rootVars()).filter(([, value]) => value !== '').map(([name]) => name)
}

/** <html> as a fresh page has it: no inline style, no motion mark, no style or tone class. */
export function clearRoot(): void {
  const root = document.documentElement
  root.removeAttribute('style')
  root.removeAttribute(MOTION_ATTRIBUTE)
  root.classList.remove(PLAY_HTML_CLASS, STUDIO_HTML_CLASS, 'light', 'dark')
}
