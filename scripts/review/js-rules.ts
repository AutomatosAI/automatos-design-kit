/**
 * The JS rules on a submission's source/ (PRD-261 §9, the automated stage).
 *
 * They refuse: fetch, XHR, WebSocket, EventSource, sendBeacon, document.cookie, localStorage, eval,
 * new Function, import() of URLs (or of a computed specifier), postMessage, created <script> or
 * <iframe>, navigator.serviceWorker, window.open, writes to location, computed globalThis/window
 * property access, `@/` and `next/*` imports, imports the host can't serve (sonner, a second
 * React; the vite-preset's own refusals), bundled React, and obfuscated or minified-only source.
 *
 * This is a lint for honest authors, by design: it reads the text, comments and strings included,
 * and can be bypassed (`globalThis['fe' + 'tch']` is caught, other spellings may not be). The
 * person who reviews every version is the control. A finding in a comment is still reported;
 * the reviewer reads the line.
 */
import { importRefusal, isSharedModule } from '@automatos/vite-preset'

export interface JsFinding {
  readonly code: string
  readonly path: string
  readonly line: number
  readonly message: string
  /** The offending line, trimmed and cut to a plain excerpt. */
  readonly excerpt: string
}

interface Rule {
  readonly code: string
  readonly pattern: RegExp
  readonly message: string
}

export const SOURCE_PREFIX = 'source/'
export const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const EXCERPT_MAX = 120
const MINIFIED_LINE = 1_000
const ESCAPES_MIN = 20
const ESCAPE_SHARE = 0.01

function rule(code: string, pattern: string, message: string, flags = ''): Rule {
  return Object.freeze({ code, pattern: new RegExp(pattern, `g${flags}`), message })
}

const RULES: readonly Rule[] = Object.freeze([
  rule('JS_FETCH', String.raw`\bfetch\s*\(`, 'calls fetch(): a theme reads data through the SDK, never the network.'),
  rule('JS_XHR', String.raw`\bXMLHttpRequest\b`, 'uses XMLHttpRequest: a theme reads data through the SDK.'),
  rule('JS_WEBSOCKET', String.raw`\bWebSocket\b`, 'opens a WebSocket: a theme reads data through the SDK.'),
  rule('JS_EVENTSOURCE', String.raw`\bEventSource\b`, 'opens an EventSource: a theme reads data through the SDK.'),
  rule('JS_SEND_BEACON', String.raw`\bsendBeacon\b`, 'calls sendBeacon: a theme sends nothing off the page.'),
  rule('JS_COOKIE', String.raw`\bdocument\s*\.\s*cookie\b`, 'touches document.cookie.'),
  rule('JS_LOCAL_STORAGE', String.raw`\blocalStorage\b`, "uses localStorage: a theme keeps state through the SDK's looks."),
  rule('JS_EVAL', String.raw`\beval\s*\(`, 'calls eval().'),
  rule('JS_NEW_FUNCTION', String.raw`\bnew\s+Function\s*\(`, 'builds code with new Function().'),
  rule('JS_POST_MESSAGE', String.raw`\bpostMessage\b`, 'calls postMessage.'),
  rule('JS_ELEMENT', String.raw`createElement(?:NS)?\s*\([^)]*?['"\x60]\s*(?:script|iframe)\s*['"\x60]`, 'creates a <script> or <iframe>.', 'i'),
  rule('JS_ELEMENT', String.raw`<\s*(?:script|iframe)\b`, 'writes a <script> or <iframe>.', 'i'),
  rule('JS_SERVICE_WORKER', String.raw`\bserviceWorker\b`, 'touches navigator.serviceWorker.'),
  rule('JS_WINDOW_OPEN', String.raw`\b(?:window|self|globalThis|top|parent)\s*\.\s*open\s*\(`, 'opens a window.'),
  rule('JS_LOCATION_WRITE', String.raw`(?<![\w$])(?<!\b(?:const|let|var)\s+)location\s*(?:\.\s*[A-Za-z]+\s*)?=(?![=>])`, 'writes to location: navigate through the SDK.'),
  rule('JS_LOCATION_WRITE', String.raw`\blocation\s*\.\s*(?:assign|replace)\s*\(`, 'navigates with location.assign/replace: navigate through the SDK.'),
  rule('JS_COMPUTED_GLOBAL', String.raw`\b(?:globalThis|window|self)\s*(?:\?\.\s*)?\[`, 'reads a computed property of globalThis/window.'),
  rule('JS_BUNDLED_REACT', String.raw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED|__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE|react\.production(?:\.min)?\.js|Symbol\.for\(\s*['"]react\.element['"]\s*\)`, "bundles React: the host's React comes through its import map."),
])

/** `from 'x'`, `import 'x'`, `import('x')`, `require('x')`: the quoted specifier is group 2. */
const STATIC_SPECIFIER = /\b(?:from|import|require)\s*\(?\s*(['"])([^'"\n]+)\1/g
/** Every `import(`; group 2 is the specifier when it is a literal. */
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(?:(['"\x60])([^'"\x60\n]*)\1)?/g
const URL_LIKE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/
const OBFUSCATED_NAME = /\b_0x[0-9a-fA-F]{4,}\b/
const ESCAPE = /\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/g

/** The 1-based line of each offset, from the line starts. */
function lineOf(starts: readonly number[], offset: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (starts[middle] <= offset) low = middle
    else high = middle - 1
  }
  return low + 1
}

function lineStarts(text: string): number[] {
  const starts = [0]
  for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) starts.push(index + 1)
  return starts
}

/** A plain excerpt: control characters dropped, whitespace collapsed, cut to EXCERPT_MAX. */
export function excerptOf(line: string): string {
  const plain = line.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > EXCERPT_MAX ? `${plain.slice(0, EXCERPT_MAX - 1)}…` : plain
}

interface SourceText {
  readonly path: string
  readonly text: string
  readonly lines: readonly string[]
  readonly starts: readonly number[]
}

function finding(source: SourceText, offset: number, code: string, message: string): JsFinding {
  const line = lineOf(source.starts, offset)
  return { code, path: source.path, line, message, excerpt: excerptOf(source.lines[line - 1] ?? '') }
}

function ruleFindings(source: SourceText): JsFinding[] {
  return RULES.flatMap((item) => Array.from(source.text.matchAll(item.pattern), (match) => (
    finding(source, match.index ?? 0, item.code, item.message)
  )))
}

/** Why a theme's source may not import `specifier`, or null. */
export function specifierProblem(specifier: string): { code: string; message: string } | null {
  if (specifier.startsWith('@/')) return { code: 'JS_ALIAS_IMPORT', message: `imports "${specifier}": core's @/ alias isn't available to a theme; use the SDK.` }
  if (specifier === 'next' || specifier.startsWith('next/')) {
    return { code: 'JS_NEXT_IMPORT', message: `imports "${specifier}": a theme can't use Next.js; use the SDK.` }
  }
  const refusal = importRefusal(specifier)
  return refusal === null ? null : { code: 'JS_IMPORT', message: refusal }
}

function importFindings(source: SourceText): JsFinding[] {
  return Array.from(source.text.matchAll(STATIC_SPECIFIER)).flatMap((match) => {
    const problem = specifierProblem(match[2])
    return problem === null ? [] : [finding(source, match.index ?? 0, problem.code, problem.message)]
  })
}

/** import() of a relative path or a shared module is fine; of a URL or a computed value it is not. */
function dynamicImportFindings(source: SourceText): JsFinding[] {
  return Array.from(source.text.matchAll(DYNAMIC_IMPORT)).flatMap((match) => {
    const specifier = match[2]
    if (specifier === undefined) {
      return [finding(source, match.index ?? 0, 'JS_DYNAMIC_IMPORT', 'calls import() on a computed value: import a relative path.')]
    }
    if (URL_LIKE.test(specifier)) {
      return [finding(source, match.index ?? 0, 'JS_DYNAMIC_IMPORT', `calls import() on a URL ("${excerptOf(specifier)}").`)]
    }
    const allowed = specifier.startsWith('./') || specifier.startsWith('../') || isSharedModule(specifier)
    return allowed ? [] : [finding(source, match.index ?? 0, 'JS_DYNAMIC_IMPORT', `calls import() on "${excerptOf(specifier)}": import a relative path.`)]
  })
}

/** Minified-only or obfuscated source: a very long line, _0x names, or a text full of escapes. */
function shapeFindings(source: SourceText): JsFinding[] {
  const found: JsFinding[] = []
  const long = source.lines.findIndex((line) => line.length > MINIFIED_LINE)
  if (long >= 0) {
    found.push(finding(source, source.starts[long], 'JS_MINIFIED', `has a line over ${MINIFIED_LINE} characters: ship readable source, not a minified build.`))
  }
  const named = OBFUSCATED_NAME.exec(source.text)
  if (named !== null) found.push(finding(source, named.index, 'JS_OBFUSCATED', 'has _0x… names, the mark of an obfuscator.'))
  const escapes = Array.from(source.text.matchAll(ESCAPE))
  if (escapes.length >= ESCAPES_MIN && escapes.length > source.text.length * ESCAPE_SHARE) {
    found.push(finding(source, escapes[0].index ?? 0, 'JS_OBFUSCATED', `has ${escapes.length} \\x/\\u escapes: write the text plainly.`))
  }
  return found
}

/** Every JS-rule finding in one source file. */
export function fileFindings(path: string, text: string): JsFinding[] {
  const source: SourceText = { path, text, lines: text.split('\n'), starts: lineStarts(text) }
  const found = [...ruleFindings(source), ...importFindings(source), ...dynamicImportFindings(source), ...shapeFindings(source)]
  return found.sort((a, b) => a.line - b.line || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
}

/** The source/ script files of a package, in path order. */
export function sourceScripts(files: ReadonlyMap<string, Uint8Array>): string[] {
  return Array.from(files.keys()).filter((path) => path.startsWith(SOURCE_PREFIX) && SCRIPT_FILE.test(path)).sort()
}

/** Every JS-rule finding across the package's source/ scripts. */
export function jsRuleFindings(files: ReadonlyMap<string, Uint8Array>): JsFinding[] {
  const decoder = new TextDecoder('utf-8')
  return sourceScripts(files).flatMap((path) => fileFindings(path, decoder.decode(files.get(path))))
}
