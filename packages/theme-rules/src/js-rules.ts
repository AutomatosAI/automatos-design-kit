/**
 * The JS rules on a submission's source/ (PRD-261 §9, the automated stage). RULES is the one table of
 * the text rules, exported as data, so every tool that reads a theme's source applies the same rows.
 *
 * Each finding has a severity. An error refuses the package; a warning is reported for the reviewer
 * to read and refuses nothing. No row warns today.
 *
 * They refuse: fetch, XHR, WebSocket, EventSource, sendBeacon, document.cookie, localStorage,
 * sessionStorage, indexedDB (a theme keeps state through the SDK's storage area, whose names
 * readThemeState, useThemeState and the rest are never refused), eval, new Function, import() of
 * URLs (or of a computed specifier), postMessage, created <script> or <iframe>,
 * navigator.serviceWorker, window.open, writes to location, computed globalThis/window property
 * access, `@/` and `next/*` imports, imports the host can't serve (sonner, a second
 * React; the vite-preset's own refusals), absolute paths and relative paths that leave source/ (in
 * imports, import(), import.meta.glob and `new URL(..., import.meta.url)`; the vite-preset's source
 * guard refuses the same in the build), bundled React, and obfuscated or minified-only source.
 *
 * They refuse audio the theme captures or makes itself (theme voice, SDK 1.2.0): getUserMedia (with
 * webkitGetUserMedia and mozGetUserMedia), SpeechRecognition and webkitSpeechRecognition, and
 * speechSynthesis. A theme talks to Auto by voice only through the SDK's voice area, whose names are
 * never refused. The three rows are core's audio_capture.py patterns (TV-C7, AUDIO_APIS, exported here
 * for the theme CLI's port of that check, which reads dist/): each name as
 * a whole identifier, not inside a longer one (`(?<![\w$])` and `(?![\w$])`, with `\w` read as Python
 * reads it in a text pattern: any letter or number, and `_`), in calls, property reads, strings and
 * comments alike. Core reads the bundle (dist/) and these rules read source/, so a name either one
 * finds is refused by both.
 *
 * This is a lint for honest authors, by design: it reads the text, comments and strings included,
 * and can be bypassed (`globalThis['fe' + 'tch']` is caught, other spellings may not be). The
 * person who reviews every version is the control. A finding in a comment is still reported;
 * the reviewer reads the line.
 */
import { posix } from 'node:path'
import { importRefusal, isSharedModule } from '@automatos/vite-preset'

/** An error refuses the package; a warning is reported for the reviewer and refuses nothing. */
export type Severity = 'error' | 'warning'

export interface JsFinding {
  readonly code: string
  readonly severity: Severity
  readonly path: string
  readonly line: number
  readonly message: string
  /** The offending line, trimmed and cut to a plain excerpt. */
  readonly excerpt: string
}

/**
 * One row of the table: every match of `pattern` in a script's text is a finding with this code. The
 * pattern is a global RegExp shared by every reader: read it with matchAll (which copies it), never
 * test or exec, which move its lastIndex.
 */
export interface Rule {
  readonly code: string
  readonly severity: Severity
  readonly pattern: RegExp
  readonly message: string
}

export const SOURCE_PREFIX = 'source/'
export const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const EXCERPT_MAX = 120
const MINIFIED_LINE = 1_000
const ESCAPES_MIN = 20
const ESCAPE_SHARE = 0.01
/** Where a theme keeps state instead of browser storage: the SDK's storage area. */
const STORAGE_AREA = "a theme keeps state through the SDK's storage area (useThemeState, readThemeState, writeThemeState)."

function rule(code: string, pattern: string, message: string, flags = '', severity: Severity = 'error'): Rule {
  return Object.freeze({ code, severity, pattern: new RegExp(pattern, `g${flags}`), message })
}

/**
 * The audio rows' severity, core's AUDIO_CAPTURE_LEVEL: the review refuses a theme that captures or makes
 * audio itself, as core's review blocks its bundle. A warning instead is this one constant.
 */
export const AUDIO_CAPTURE_SEVERITY: Severity = 'error'
/** What a theme uses instead of its own audio: the SDK's voice area. */
const VOICE_AREA = "use the SDK's voice area instead (voice.VoiceButton, useVoice, readVoiceLevels)."
/**
 * audio_capture.py `_ALONE_BEFORE` and `_ALONE_AFTER`: not part of a longer identifier. Python's `\w` in
 * a text pattern is any letter or number and `_`; JavaScript's (even with the `u` flag) is ASCII only, so
 * the class names the Unicode properties.
 */
const ALONE_BEFORE = String.raw`(?<![\p{L}\p{N}_$])`
const ALONE_AFTER = String.raw`(?![\p{L}\p{N}_$])`

/** One browser audio API a theme may not use itself (audio_capture.py AudioApi): its rule's code and its words. */
export interface AudioApi {
  readonly code: string
  /** The name core's check reports it by. */
  readonly name: string
  /** What it does, as core's sentences say it. */
  readonly does: string
  /** Every spelling, each a whole identifier: a global pattern, read with matchAll as the table's are. */
  readonly pattern: RegExp
}

/** audio_capture.py AUDIO_APIS, in its order, with each rule's message. */
const AUDIO_SPECS = [
  {
    code: 'JS_GET_USER_MEDIA', name: 'getUserMedia', spellings: 'getUserMedia|webkitGetUserMedia|mozGetUserMedia', does: 'opens the microphone',
    message: 'calls getUserMedia: a theme that opens the microphone or camera by itself can record the person using it, with no AI voice caption and no stop control;',
  },
  {
    code: 'JS_SPEECH_RECOGNITION', name: 'SpeechRecognition', spellings: '(?:webkit)?SpeechRecognition', does: 'listens to the microphone',
    message: "uses SpeechRecognition: a theme that listens by itself can send the microphone's audio to the browser vendor's speech service, with no AI voice caption and no stop control;",
  },
  {
    code: 'JS_SPEECH_SYNTHESIS', name: 'speechSynthesis', spellings: 'speechSynthesis', does: 'speaks',
    message: 'uses speechSynthesis: a theme that speaks by itself can speak as Auto with no AI notice and no stop control;',
  },
] as const

const audioPattern = (spellings: string): RegExp => new RegExp(`${ALONE_BEFORE}(?:${spellings})${ALONE_AFTER}`, 'gu')

/** The audio APIs the review refuses in source/ and core's audioCapture check blocks in dist/, with one pattern each. */
export const AUDIO_APIS: readonly AudioApi[] = Object.freeze(AUDIO_SPECS.map(({ code, name, does, spellings }) => (
  Object.freeze({ code, name, does, pattern: audioPattern(spellings) })
)))

/** The audio rows of the table: each API's pattern, refused at AUDIO_CAPTURE_SEVERITY. */
const AUDIO_RULES: readonly Rule[] = AUDIO_SPECS.map(({ code, message }, index) => (
  Object.freeze({ code, severity: AUDIO_CAPTURE_SEVERITY, pattern: AUDIO_APIS[index].pattern, message: `${message} ${VOICE_AREA}` })
))

export const RULES: readonly Rule[] = Object.freeze([
  rule('JS_FETCH', String.raw`\bfetch\s*\(`, 'calls fetch(): a theme reads data through the SDK, never the network.'),
  rule('JS_XHR', String.raw`\bXMLHttpRequest\b`, 'uses XMLHttpRequest: a theme reads data through the SDK.'),
  rule('JS_WEBSOCKET', String.raw`\bWebSocket\b`, 'opens a WebSocket: a theme reads data through the SDK.'),
  rule('JS_EVENTSOURCE', String.raw`\bEventSource\b`, 'opens an EventSource: a theme reads data through the SDK.'),
  rule('JS_SEND_BEACON', String.raw`\bsendBeacon\b`, 'calls sendBeacon: a theme sends nothing off the page.'),
  rule('JS_COOKIE', String.raw`\bdocument\s*\.\s*cookie\b`, 'touches document.cookie.'),
  rule('JS_LOCAL_STORAGE', String.raw`\blocalStorage\b`, `uses localStorage: ${STORAGE_AREA}`),
  rule('JS_SESSION_STORAGE', String.raw`\bsessionStorage\b`, `uses sessionStorage: ${STORAGE_AREA}`),
  rule('JS_INDEXED_DB', String.raw`\bindexedDB\b`, `uses indexedDB: ${STORAGE_AREA}`),
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
  ...AUDIO_RULES,
])

/** `from 'x'`, `import 'x'`, `import('x')`, `require('x')`: the quoted specifier is group 2. */
const STATIC_SPECIFIER = /\b(?:from|import|require)\s*\(?\s*(['"])([^'"\n]+)\1/g
/** Every `import(`; group 2 is the specifier when it is a literal. */
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(?:(['"\x60])([^'"\x60\n]*)\1)?/g
const URL_LIKE = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/
/** `new URL('<path>', import.meta.url)`: the path is group 2. */
const ASSET_URL = /\bnew\s+URL\s*\(\s*(['"\x60])([^'"\x60\n]+)\1\s*,\s*import\.meta\.url\b/g
/** `import.meta.glob(<pattern or [patterns]>`: group 1 is the pattern argument. */
const GLOB_CALL = /\bimport\.meta\.glob\s*(?:<[^>()]*>)?\s*\(\s*(\[[^\]]*\]|(['"\x60])[^'"\x60\n]*\2)/g
const QUOTED = /(['"\x60])([^'"\x60\n]*)\1/g
const ABSOLUTE_PATH = /^(?:\/|file:|[A-Za-z]:[\\/])/i
const RELATIVE_PATH = /^\.\.?(?:\/|$)/
const SOURCE_ROOT = SOURCE_PREFIX.slice(0, -1)
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

function finding(source: SourceText, offset: number, code: string, message: string, severity: Severity = 'error'): JsFinding {
  const line = lineOf(source.starts, offset)
  return { code, severity, path: source.path, line, message, excerpt: excerptOf(source.lines[line - 1] ?? '') }
}

function ruleFindings(source: SourceText): JsFinding[] {
  return RULES.flatMap((item) => Array.from(source.text.matchAll(item.pattern), (match) => (
    finding(source, match.index ?? 0, item.code, item.message, item.severity)
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

/** Why the file at `from` may not refer to `specifier` by path, or null: absolute, or leaving source/. */
export function pathProblem(specifier: string, from: string): { code: string; message: string } | null {
  const path = specifier.replace(/^!/, '').replace(/[?#].*$/s, '')
  if (ABSOLUTE_PATH.test(path)) {
    return { code: 'JS_PATH_IMPORT', message: `refers to "${excerptOf(path)}", an absolute path: refer to files under source/ by a relative path.` }
  }
  if (!RELATIVE_PATH.test(path)) return null
  const target = posix.normalize(posix.join(posix.dirname(from), path))
  if (target === SOURCE_ROOT || target.startsWith(SOURCE_PREFIX)) return null
  return { code: 'JS_PATH_IMPORT', message: `refers to "${excerptOf(path)}", which leaves source/: a theme builds from its own source only.` }
}

interface Reference {
  readonly offset: number
  readonly specifier: string
}

function references(text: string, pattern: RegExp, group: number, keep: (match: RegExpMatchArray) => boolean = () => true): Reference[] {
  return Array.from(text.matchAll(pattern)).flatMap((match) => (
    match[group] !== undefined && keep(match) ? [{ offset: match.index ?? 0, specifier: match[group] }] : []
  ))
}

/** Every path a script refers to: imports, require(), template import(), import.meta.glob, new URL. */
function pathReferences(text: string): Reference[] {
  const globs = Array.from(text.matchAll(GLOB_CALL)).flatMap((match) => (
    references(match[1], QUOTED, 2).map((item) => ({ offset: match.index ?? 0, specifier: item.specifier }))
  ))
  return [
    ...references(text, STATIC_SPECIFIER, 2),
    ...references(text, DYNAMIC_IMPORT, 2, (match) => match[1] === '\x60'),
    ...references(text, ASSET_URL, 2),
    ...globs,
  ]
}

function pathFindings(source: SourceText): JsFinding[] {
  return pathReferences(source.text).flatMap(({ offset, specifier }) => {
    const problem = pathProblem(specifier, source.path)
    return problem === null ? [] : [finding(source, offset, problem.code, problem.message)]
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
  const found = [
    ...ruleFindings(source),
    ...importFindings(source),
    ...pathFindings(source),
    ...dynamicImportFindings(source),
    ...shapeFindings(source),
  ]
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
