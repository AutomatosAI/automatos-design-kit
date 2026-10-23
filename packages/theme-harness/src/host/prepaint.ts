/**
 * PRD-261 B-02e: what the browser harness puts on <html> for a theme, as core's host does before the theme draws.
 *
 * - The look: the theme's first-paint table (boot/prepaint.json) painted for the active look, a port of core's
 *   frontend/lib/theme-host/looks/paint.ts:24-91 (at 101a0bf33f64fb4f89af81b4293415be60b661ac) with
 *   boot-sanitize.ts:166-186's fit check: each choice knob's table in the table's order, then the pair tables,
 *   then each numeric rule as rgba(<rgb>,<alpha>); the table's default look when the look doesn't fit it; only
 *   names that pass CSS_VAR_NAME_PATTERN (boot-sanitize.ts:42). A name the table paints for another look comes off.
 * - The tone: the table's tone rule (host 1.1.0) for the active look under a theme whose tone follows its look;
 *   the theme's own tone under 'light' or 'dark'; the user's under 'user'.
 * - The classes: the base's (core's lib/ui-style.ts:76 styleHtmlClasses: 'studio' for Studio, none for Classic), the
 *   theme's htmlClass while it runs (a theme that failed has it taken off, as core's cleanup does), and the tone.
 * - The host's status attributes (core's constants.ts THEME_HOST_STATUS_ATTR and THEME_HOST_REASON_ATTR), and the
 *   harness's own two for the toolbar's reduced motion and forced colours. A page's script cannot turn the browser's
 *   media features on, so the build mirrors a theme's `@media (prefers-reduced-motion: reduce)` and
 *   `@media (forced-colors: active)` rules under these attributes (vite.harness.config.ts), and FORCED_COLORS_PREVIEW
 *   paints the system colours over the page, as a browser in forced colours would. The shots ask the browser itself
 *   for reduced motion (Playwright's emulation) and draw no forced-colours set: that is the toolbar's preview only.
 */
import type { PrepaintNumericRule, PrepaintTable, PrepaintVars, ThemeTone } from '../../../../scripts/looks/boot-types.ts'

export type { PrepaintTable, ThemeTone } from '../../../../scripts/looks/boot-types.ts'

type LookValues = Readonly<Record<string, unknown>>
type UnknownRecord = Readonly<Record<string, unknown>>

/** boot-sanitize.ts:42. */
export const CSS_VAR_NAME_PATTERN = /^--[a-z0-9-]{1,64}$/
/** paint.ts:20: the only numeric template the boot script paints. */
const RGBA_ALPHA = 'rgba-alpha'

const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** boot-sanitize.ts:166. */
function hasKey(table: unknown, key: unknown): boolean {
  return isRecord(table) && typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key)
}

/** boot-sanitize.ts:170. */
function numericFits(rule: PrepaintNumericRule, look: LookValues): boolean {
  const value = look[rule.knob]
  if (!isFiniteNumber(value) || value < rule.min || value > rule.max) return false
  if (rule.integer && value % 1 !== 0) return false
  if (!hasKey(rule.color.rgb, look[rule.color.knob])) return false
  if (rule.capTable === null) return true
  const [rowKnob, columnKnob] = rule.capTable
  if (rule.caps === null || !hasKey(rule.caps, look[rowKnob])) return false
  return hasKey(rule.caps[String(look[rowKnob])], look[columnKnob])
}

/** boot-sanitize.ts:182 lookFitsPrepaint: the look names an option of every table and fits every numeric rule. */
export function lookFits(table: PrepaintTable, look: LookValues): boolean {
  const knobs = Object.entries(table.knobs).every(([knob, options]) => hasKey(options, look[knob]))
  const pairs = table.pairs.every((pair) => hasKey(pair.table, look[pair.a]) && hasKey(pair.table[String(look[pair.a])], look[pair.b]))
  return knobs && pairs && table.numeric.every((rule) => numericFits(rule, look))
}

/** paint.ts:29. */
function paintable(vars: PrepaintVars | undefined): [string, string][] {
  if (vars === undefined) return []
  return Object.keys(vars)
    .filter((name) => CSS_VAR_NAME_PATTERN.test(name) && typeof vars[name] === 'string')
    .map((name): [string, string] => [name, vars[name]])
}

/** paint.ts:37. */
function numericVar(rule: PrepaintNumericRule, look: LookValues): [string, string] | null {
  if (rule.template !== RGBA_ALPHA || !CSS_VAR_NAME_PATTERN.test(rule.var)) return null
  const value = look[rule.knob]
  const colourKey = look[rule.color.knob]
  if (typeof value !== 'number' || !hasKey(rule.color.rgb, colourKey)) return null
  let alpha = value / rule.scale
  if (rule.capTable !== null && rule.caps !== null) {
    const row = rule.caps[String(look[rule.capTable[0]])]
    alpha = Math.min(alpha, row[String(look[rule.capTable[1]])])
  }
  return [rule.var, `rgba(${rule.color.rgb[String(colourKey)]},${alpha})`]
}

/** paint.ts:51. */
function walk(table: PrepaintTable, look: LookValues): [string, string][] {
  const knobs = Object.keys(table.knobs).flatMap((knob) => paintable(table.knobs[knob][String(look[knob])]))
  const pairs = table.pairs.flatMap((pair) => paintable(pair.table[String(look[pair.a])][String(look[pair.b])]))
  const numeric = table.numeric.flatMap((rule) => {
    const entry = numericVar(rule, look)
    return entry === null ? [] : [entry]
  })
  return [...knobs, ...pairs, ...numeric]
}

/** paint.ts:65: the variables for `look`; the table's default look's when `look` doesn't fit; none when neither does. */
export function paintLook(table: PrepaintTable, look: LookValues): Readonly<Record<string, string>> {
  const painted = lookFits(table, look) ? look : table.defaults
  if (!lookFits(table, painted)) return {}
  return Object.fromEntries(walk(table, painted))
}

/** paint.ts:72: every variable the table can paint, for any look. */
export function paintNames(table: PrepaintTable): readonly string[] {
  const names = new Set<string>()
  const add = (vars: PrepaintVars): void => paintable(vars).forEach(([name]) => names.add(name))
  Object.values(table.knobs).forEach((options) => Object.values(options).forEach(add))
  table.pairs.forEach((pair) => Object.values(pair.table).forEach((row) => Object.values(row).forEach(add)))
  table.numeric.filter((rule) => CSS_VAR_NAME_PATTERN.test(rule.var)).forEach((rule) => names.add(rule.var))
  return Array.from(names)
}

/** A table as boot/prepaint.json holds one: its four parts, each of the right kind (the paint checks each entry). */
export function isPrepaintTable(value: unknown): value is PrepaintTable {
  if (!isRecord(value)) return false
  const { knobs, pairs, numeric, defaults } = value
  return isRecord(knobs) && Array.isArray(pairs) && Array.isArray(numeric) && isRecord(defaults)
}

/** The tone the table's tone rule gives `look`; null without a rule, or for a choice the rule doesn't name. */
export function lookTone(table: PrepaintTable | null, look: LookValues | null): ThemeTone | null {
  const rule = table?.tone
  if (rule === undefined || look === null) return null
  const choice = look[rule.knob]
  return hasKey(rule.values, choice) ? rule.values[String(choice)] : null
}

export type TonePolicy = 'from-look' | 'user' | 'light' | 'dark'

/** The tone the theme forces over the user's choice: its look's, or its own; null under 'user'. */
export function forcedTone(policy: TonePolicy, fromLook: ThemeTone | null): ThemeTone | null {
  if (policy === 'from-look') return fromLook
  return policy === 'user' ? null : policy
}

// ---- <html> ----

/** What the host is doing, as core's THEME_HOST_STATUS_ATTR says it. */
export type HostStatus = 'loading' | 'active' | 'failed'

export const HTML_ATTRS = Object.freeze({
  status: 'data-theme-host',
  reason: 'data-theme-host-reason',
  motion: 'data-harness-motion',
  forcedColors: 'data-harness-forced-colors',
})
export const MOTION_REDUCE = 'reduce'
export const FORCED_ACTIVE = 'active'
export const STUDIO_CLASS = 'studio'
export const TONE_CLASSES: readonly ThemeTone[] = Object.freeze(['light', 'dark'])

export interface HtmlPaint {
  readonly classes: readonly string[]
  readonly vars: Readonly<Record<string, string>>
  /** Every variable the theme's table can paint: those not in `vars` come off. */
  readonly names: readonly string[]
  readonly status: HostStatus
  readonly reason: string | null
  readonly reducedMotion: boolean
  readonly forcedColors: boolean
}

/** The classes on <html>: the base's, the theme's own while it runs, and the tone. */
export function htmlClasses(base: 'studio' | 'classic', htmlClass: string | null, tone: ThemeTone): string[] {
  return [...(base === 'studio' ? [STUDIO_CLASS] : []), ...(htmlClass === null ? [] : [htmlClass]), tone]
}

function setAttribute(root: HTMLElement, name: string, value: string | null): void {
  if (value === null) root.removeAttribute(name)
  else root.setAttribute(name, value)
}

/** Puts `paint` on `root`; every class in `managed` it doesn't name comes off, other classes stay. */
export function applyHtml(root: HTMLElement, paint: HtmlPaint, managed: readonly string[]): void {
  managed.filter((name) => !paint.classes.includes(name)).forEach((name) => root.classList.remove(name))
  paint.classes.forEach((name) => root.classList.add(name))
  paint.names.filter((name) => !Object.prototype.hasOwnProperty.call(paint.vars, name)).forEach((name) => root.style.removeProperty(name))
  Object.entries(paint.vars).forEach(([name, value]) => root.style.setProperty(name, value))
  setAttribute(root, HTML_ATTRS.status, paint.status)
  setAttribute(root, HTML_ATTRS.reason, paint.reason)
  setAttribute(root, HTML_ATTRS.motion, paint.reducedMotion ? MOTION_REDUCE : null)
  setAttribute(root, HTML_ATTRS.forcedColors, paint.forcedColors ? FORCED_ACTIVE : null)
}

export const PREVIEW_STYLE_ID = 'automatos-harness-forced-colors'
const FORCED = `html[${HTML_ATTRS.forcedColors}="${FORCED_ACTIVE}"]`

/** Forced colours as a browser paints them, roughly: the system colours over every author colour. */
export const FORCED_COLORS_PREVIEW = [
  `${FORCED} *, ${FORCED} *::before, ${FORCED} *::after { color: CanvasText !important; background-color: Canvas !important;`,
  '  border-color: CanvasText !important; outline-color: CanvasText !important; box-shadow: none !important;',
  '  text-shadow: none !important; background-image: none !important; }',
  `${FORCED} a, ${FORCED} a * { color: LinkText !important; }`,
  `${FORCED} button, ${FORCED} button * { color: ButtonText !important; background-color: ButtonFace !important; }`,
  `${FORCED} :focus-visible { outline: 2px solid Highlight !important; }`,
].join('\n')

/** Adds the forced colours preview once to the document's head; it paints only while the attribute is on. */
export function installPreviewStyle(doc: Document): void {
  if (doc.getElementById(PREVIEW_STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = PREVIEW_STYLE_ID
  style.textContent = FORCED_COLORS_PREVIEW
  doc.head.appendChild(style)
}
