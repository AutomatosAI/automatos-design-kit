/**
 * The package's files, and Play's eslint.config.js, are plain text: printable ASCII and LF line ends.
 * A character outside that is written as an escape (`\u2028`), because a raw U+2028 or U+2029 ends a
 * regular expression literal early (TypeScript, Node's type stripping and Vite all refuse the file, so the
 * plugin cannot load), and any invisible character hides from a diff and a review.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PLAY_CONFIG = fileURLToPath(new URL('../../../themes/play/eslint.config.js', import.meta.url))
const TEXT_EXTENSIONS = new Set(['.ts', '.js', '.json', '.md'])
const SKIPPED_DIRS = new Set(['node_modules'])
/** Any character but printable ASCII and LF: tab, CR, other controls and every non-ASCII character. */
const NOT_PLAIN = /[^\x20-\x7e\n]/gu
const HEX = 16
const CODE_POINT_DIGITS = 4

/** Every text file under `dir`, outside installed packages. */
function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : textFiles(path)
    return entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

/** Each character of `text` that is not plain, as `<name>:<line> U+XXXX`. */
function notPlainIn(name: string, text: string): string[] {
  return text.split('\n').flatMap((line, index) => Array.from(line.matchAll(NOT_PLAIN), (match) => {
    const point = match[0].codePointAt(0)?.toString(HEX).toUpperCase().padStart(CODE_POINT_DIGITS, '0')
    return `${name}:${index + 1} U+${point}`
  }))
}

function storyFiles(): string[] {
  return [...textFiles(PACKAGE_ROOT), PLAY_CONFIG].map((path) => relative(REPO_ROOT, path))
}

describe("the plugin's files", () => {
  it('are found: its source, its tests, its manifest and README, and Play\'s config', () => {
    const files = storyFiles()
    const expected = ['src/text-parser.ts', 'test/linter.test.ts', 'package.json', 'README.md']
      .map((path) => relative(REPO_ROOT, join(PACKAGE_ROOT, path)))
    expect(files).toEqual(expect.arrayContaining([...expected, relative(REPO_ROOT, PLAY_CONFIG)]))
  })

  it('hold only printable ASCII and LF line ends, so every other character is written as an escape', () => {
    const found = storyFiles().flatMap((path) => notPlainIn(path, readFileSync(join(REPO_ROOT, path), 'utf8')))
    expect(found).toEqual([])
  })

  it('name the file, line and code point of a raw character, invisible ones included', () => {
    expect(notPlainIn('x.ts', 'const a = 1\nconst b = /[\u2028\u2029]/u\tc\r')).toEqual([
      'x.ts:2 U+2028', 'x.ts:2 U+2029', 'x.ts:2 U+0009', 'x.ts:2 U+000D',
    ])
    expect(notPlainIn('x.ts', 'plain text, `quoted` and ~escaped\\u2028~\n')).toEqual([])
  })
})
