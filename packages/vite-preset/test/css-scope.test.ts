/**
 * The kit's CSS scope check gives the server's verdicts.
 *
 * Every `cssScope` case of core's shared corpus (orchestrator/tests/fixtures/themes/cases.json,
 * vendored at packages/theme-cli/test/fixtures/core/cases.json) runs here: a case's code is null
 * when the server accepts the CSS, otherwise every error the check returns carries that code.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CSS_ERROR_CODES, cssScopeErrors, STYLE_PATH, type ThemeError } from '../src/css-scope.ts'

interface ScopeCase {
  readonly name: string
  readonly css: string
  readonly code: string | null
}

interface Corpus {
  readonly cssScope: { readonly htmlClass: string; readonly cases: readonly ScopeCase[] }
}

const CORPUS_URL = new URL('../../theme-cli/test/fixtures/core/cases.json', import.meta.url)
const CORPUS = JSON.parse(readFileSync(fileURLToPath(CORPUS_URL), 'utf8')) as Corpus
const HTML_CLASS = CORPUS.cssScope.htmlClass

function expectVerdict(errors: readonly ThemeError[], code: string | null): void {
  errors.forEach((error) => {
    expect(Object.keys(error).sort()).toEqual(['code', 'message', 'path'])
    expect(CSS_ERROR_CODES).toContain(error.code)
    expect(error.path.startsWith(`${STYLE_PATH}:`)).toBe(true)
    expect(error.message).not.toContain('\n')
  })
  if (code === null) {
    expect(errors).toEqual([])
    return
  }
  expect(errors.length).toBeGreaterThan(0)
  expect(Array.from(new Set(errors.map((error) => error.code)))).toEqual([code])
}

describe('the CSS scope check, held to the core corpus', () => {
  it('reads the corpus', () => {
    expect(HTML_CLASS).toBe('hello')
    expect(CORPUS.cssScope.cases.length).toBeGreaterThan(40)
  })

  it.each([...CORPUS.cssScope.cases])('cssScope: $name', (testCase) => {
    expectVerdict(cssScopeErrors(testCase.css, HTML_CLASS), testCase.code)
  })
})

describe('the CSS scope check, beyond the corpus', () => {
  it('names the line of each refusal', () => {
    const errors = cssScopeErrors('html.hello .a { color: red; }\n\nbody { color: blue; }', HTML_CLASS)
    expect(errors.map((error) => error.path)).toEqual([`${STYLE_PATH}:3`])
  })

  it('stops at 20 errors', () => {
    const css = Array.from({ length: 30 }, (_, index) => `.a${index} { color: red; }`).join('\n')
    expect(cssScopeErrors(css, HTML_CLASS)).toHaveLength(20)
  })

  it('accepts an empty stylesheet and one of comments only', () => {
    expect(cssScopeErrors('', HTML_CLASS)).toEqual([])
    expect(cssScopeErrors('/* nothing */\n', HTML_CLASS)).toEqual([])
  })

  it('refuses @property and @scope, which the server does not list', () => {
    expect(cssScopeErrors('@property --hello-x { syntax: "*"; inherits: false; }', HTML_CLASS)[0]?.code).toBe('CSS_AT_RULE')
    expect(cssScopeErrors('@scope (.a) { html.hello .b { color: red; } }', HTML_CLASS)[0]?.code).toBe('CSS_AT_RULE')
  })

  it('reads an unquoted data: url as one token', () => {
    const css = 'html.hello .a { background: url(data:image/png;base64,iVBORw0KGgo=); }'
    expect(cssScopeErrors(css, HTML_CLASS)).toEqual([])
  })
})
