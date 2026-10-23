/**
 * The recommended config as ESLint runs it (Linter, flat config): the seeded file fails with its three
 * codes and the review's own messages, a warning code warns, TypeScript and JSX lint without a parser
 * package, no comment is read as a directive, and a file is read at its path under source/.
 */
import { resolve } from 'node:path'
import { fileFindings, SOURCE_PREFIX } from '@automatos/theme-rules'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin, { NAMESPACE } from '../src/index.ts'
import { SETTINGS_KEY, THEME_SOURCE_DIR } from '../src/rules.ts'
import { parseText } from '../src/text-parser.ts'
import { SEEDED_CODES, SEEDED_FILE, SEEDED_TEXT } from './seeded.ts'

/** A theme folder that need not exist: Linter reads only the text it is given. */
const THEME = resolve('/theme')
const ERROR = 2
const WARNING = 1

interface Reported {
  readonly ruleId: string | null
  readonly severity: number
  readonly line: number
}

function lint(text: string, file: string, extra: readonly Linter.Config[] = []): Linter.LintMessage[] {
  const linter = new Linter({ cwd: THEME })
  return linter.verify(text, [plugin.configs.recommended, ...extra], resolve(THEME, THEME_SOURCE_DIR, file))
}

function reported(messages: readonly Linter.LintMessage[]): Reported[] {
  return messages.map(({ ruleId, severity, line }) => ({ ruleId, severity, line }))
}

function finding(code: string, line: number, severity = ERROR): Reported {
  return { ruleId: `${NAMESPACE}/${code}`, severity, line }
}

describe('the recommended config', () => {
  it("fails a seeded file with fetch(), globalThis['fe'+'tch'] and an @/x import, with the three codes", () => {
    expect(reported(lint(SEEDED_TEXT, SEEDED_FILE))).toEqual(SEEDED_CODES.map((code, index) => finding(code, index + 1)))
  })

  it("reports the review's own message for each finding", () => {
    const review = fileFindings(`${SOURCE_PREFIX}${SEEDED_FILE}`, SEEDED_TEXT)
    expect(lint(SEEDED_TEXT, SEEDED_FILE).map((message) => message.message)).toEqual(review.map((item) => item.message))
  })

  it('reports a warning code as a warning, which refuses nothing', () => {
    const messages = lint('const listener = new webkitSpeechRecognition()', 'voice.ts')
    expect(reported(messages)).toEqual([finding('JS_SPEECH_RECOGNITION', 1, WARNING)])
  })

  it('lints TypeScript and JSX with no parser package, and passes plain theme code', () => {
    const text = [
      "import { useState } from 'react'",
      'type Props = { readonly label: string }',
      'export function Label({ label }: Props): JSX.Element {',
      '  const [open, setOpen] = useState<boolean>(false)',
      '  return <button onClick={() => setOpen(!open)}>{label}</button>',
      '}',
    ].join('\n')
    expect(lint(text, 'components/label.tsx')).toEqual([])
  })

  it("reads no comment as a directive: a disable comment hides nothing, and one naming another plugin's rule is inert", () => {
    const text = [
      `// eslint-disable-next-line ${NAMESPACE}/JS_FETCH`,
      'const data = fetch(address)',
      '// eslint-disable-next-line @next/next/no-img-element',
      'const image = media.still',
    ].join('\n')
    expect(reported(lint(text, SEEDED_FILE))).toEqual([finding('JS_FETCH', 2)])
  })

  it('reads a file at its path under source/: one import stays inside or leaves by where the file sits', () => {
    const text = "import { theme } from '../entry.ts'"
    expect(lint(text, 'shell/frame.tsx')).toEqual([])
    expect(reported(lint(text, 'entry.ts'))).toEqual([finding('JS_PATH_IMPORT', 1)])
  })

  it("stops with an error naming the file when it is outside the theme's src/", () => {
    const inner = { settings: { [SETTINGS_KEY]: { sourceRoot: resolve(THEME, THEME_SOURCE_DIR, 'inner') } } }
    expect(() => lint('const ready = true', 'entry.ts', [inner])).toThrow(/is outside the theme's src\//)
  })
})

describe('the text parser', () => {
  it('gives an empty Program, no tokens or comments, spanning the text as ESLint counts lines', () => {
    const text = 'one\r\ntwo three\nfour'
    expect(parseText(text)).toEqual({
      type: 'Program',
      sourceType: 'module',
      body: [],
      comments: [],
      tokens: [],
      range: [0, text.length],
      loc: { start: { line: 1, column: 0 }, end: { line: 4, column: 4 } },
    })
  })
})
