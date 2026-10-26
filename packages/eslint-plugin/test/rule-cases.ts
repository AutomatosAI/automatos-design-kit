/**
 * A valid and an invalid line for every code the review reports. Each line is the second of its file (the
 * first is plain), so the test checks the line a finding lands on; a case runs as `src/entry.ts` unless it
 * names its file under the theme's `src/`. The valid line sits close to the invalid one where it can, so a
 * rule that reads too much fails. TypeScript and JavaScript alike: the plugin's parser reads no syntax.
 */
export interface RuleCase {
  readonly valid: string
  readonly invalid: string
  /** The file under the theme's src/, when where it sits decides the case. */
  readonly file?: string
}

/** theme-rules' longest readable line: a longer one is minified-only source. */
const MINIFIED_LINE = 1_000

export const CASES: Readonly<Record<string, RuleCase>> = Object.freeze({
  JS_FETCH: { valid: 'const prefetched = cache.get(key)', invalid: "const response = fetch('/api/data')" },
  JS_XHR: { valid: "const request = { method: 'GET' }", invalid: 'const request = new XMLHttpRequest()' },
  JS_WEBSOCKET: { valid: 'const socket = null', invalid: 'const socket = new WebSocket(address)' },
  JS_EVENTSOURCE: { valid: 'const stream = events.subscribe(render)', invalid: 'const stream = new EventSource(address)' },
  JS_SEND_BEACON: { valid: 'const sent = chat.send(text)', invalid: "navigator.sendBeacon('/log', body)" },
  JS_COOKIE: { valid: 'const title = document.title', invalid: 'const session = document.cookie' },
  JS_LOCAL_STORAGE: { valid: "writeThemeState('mode', 'dark')", invalid: "localStorage.setItem('mode', 'dark')" },
  JS_SESSION_STORAGE: {
    valid: "const mode = readThemeState('mode', { lifetime: 'session' })",
    invalid: "const mode = sessionStorage.getItem('mode')",
  },
  JS_INDEXED_DB: { valid: "const notes = readThemeState('notes')", invalid: "const request = indexedDB.open('notes')" },
  JS_EVAL: { valid: 'const value = evaluate(text)', invalid: 'const value = eval(text)' },
  JS_NEW_FUNCTION: { valid: 'const make = function () { return 1 }', invalid: "const make = new Function('return 1')" },
  JS_POST_MESSAGE: { valid: 'sendMessage(text)', invalid: "parent.postMessage(data, '*')" },
  JS_ELEMENT: { valid: "const tag = document.createElement('section')", invalid: "const tag = document.createElement('script')" },
  JS_SERVICE_WORKER: { valid: 'const online = navigator.onLine', invalid: "navigator.serviceWorker.register('/sw.js')" },
  JS_WINDOW_OPEN: { valid: 'drawer.open(link)', invalid: 'window.open(link)' },
  JS_LOCATION_WRITE: { valid: 'const next = location.pathname', invalid: 'location.href = next' },
  JS_COMPUTED_GLOBAL: { valid: 'const doc = globalThis.document', invalid: "const call = globalThis['fe' + 'tch']" },
  JS_BUNDLED_REACT: { valid: "const element = Symbol.for('play.element')", invalid: "const element = Symbol.for('react.element')" },
  JS_SPEECH_RECOGNITION: { valid: 'const listening = false', invalid: 'const listener = new webkitSpeechRecognition()' },
  JS_GET_USER_MEDIA: {
    valid: 'const devices = navigator.mediaDevices',
    invalid: 'const stream = navigator.mediaDevices.getUserMedia({ audio: true })',
  },
  JS_SPEECH_SYNTHESIS: { valid: 'const { phase, stop } = useVoice()', invalid: 'window.speechSynthesis.speak(utterance)' },
  JS_ALIAS_IMPORT: { valid: "import { cn } from './lib/utils.ts'", invalid: "import { cn } from '@/lib/utils'" },
  JS_NEXT_IMPORT: { valid: "import { next } from './next-step.ts'", invalid: "import Link from 'next/link'" },
  JS_IMPORT: { valid: "import { useState } from 'react'", invalid: "import { toast } from 'sonner'" },
  // From src/shell/frame.tsx: '../entry.ts' is source/entry.ts, '../../package.json' leaves source/.
  JS_PATH_IMPORT: {
    valid: "import { theme } from '../entry.ts'",
    invalid: "import manifest from '../../package.json'",
    file: 'shell/frame.tsx',
  },
  JS_DYNAMIC_IMPORT: { valid: "const page = import('./pages/home.tsx')", invalid: 'const page = import(pagePath)' },
  JS_MINIFIED: {
    valid: `const data = '${'a'.repeat(MINIFIED_LINE / 2)}'`,
    invalid: `const data = '${'a'.repeat(MINIFIED_LINE)}'`,
  },
  JS_OBFUSCATED: { valid: "const x0 = 'x'", invalid: "const _0x1f2e = 'x'" },
})
