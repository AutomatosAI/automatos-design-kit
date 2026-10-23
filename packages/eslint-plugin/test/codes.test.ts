/**
 * The plugin's rules are the review's codes: one rule per code in @automatos/theme-rules, its RULES table
 * and its other checks alike, held to every code literal in theme-rules' source, so a code added there
 * without a rule here fails. The recommended config runs each at the table's severity, on every script
 * file the review reads.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { RULES, SCRIPT_FILE } from '@automatos/theme-rules'
import { describe, expect, it } from 'vitest'
import plugin, { NAMESPACE, SCRIPT_EXTENSIONS } from '../src/index.ts'
import { CHECK_CODES, CODES, levelOf } from '../src/codes.ts'
import { THEME_SOURCE_DIR } from '../src/rules.ts'

/** theme-rules' source folder, found as Node resolves the package. */
const THEME_RULES_SRC = dirname(createRequire(import.meta.url).resolve('@automatos/theme-rules'))
const CODE_LITERAL = /(['"`])(JS_[A-Z0-9_]+)\1/g
const MANIFEST = new URL('../package.json', import.meta.url)

/** Every code literal in theme-rules' source files, sorted. */
function reportedCodes(): string[] {
  const files = readdirSync(THEME_RULES_SRC, { encoding: 'utf8', recursive: true }).filter((path) => path.endsWith('.ts'))
  const codes = files.flatMap((path) => (
    Array.from(readFileSync(join(THEME_RULES_SRC, path), 'utf8').matchAll(CODE_LITERAL), (match) => match[2])
  ))
  return Array.from(new Set(codes)).sort()
}

describe('the rules', () => {
  it('are one per code theme-rules reports, its table and its checks, named by the code', () => {
    const codes = reportedCodes()
    expect(codes).toContain('JS_FETCH')
    expect(Object.keys(plugin.rules).sort()).toEqual(codes)
    expect([...CODES].sort()).toEqual(codes)
  })

  it("cover every code of the RULES table, and the checks' codes are not in it", () => {
    const tableCodes = new Set(RULES.map((row) => row.code))
    expect(Array.from(tableCodes).filter((code) => plugin.rules[code] === undefined)).toEqual([])
    expect(CHECK_CODES.filter((code) => tableCodes.has(code))).toEqual([])
  })
})

describe('the recommended config', () => {
  const config = plugin.configs.recommended

  it("runs every rule at its code's level: a warning row warns, every other code is an error", () => {
    const warnings = new Set(RULES.filter((row) => row.severity === 'warning').map((row) => row.code))
    expect(warnings.size).toBeGreaterThan(0)
    const expected = Object.fromEntries(CODES.map((code) => [`${NAMESPACE}/${code}`, warnings.has(code) ? 'warn' : 'error']))
    expect(config.rules).toEqual(expected)
    CODES.forEach((code) => expect(levelOf(code), code).toBe(warnings.has(code) ? 'warn' : 'error'))
  })

  it('lints every script file the review reads, under the theme\'s src/', () => {
    expect(SCRIPT_FILE.source).toBe(String.raw`\.(?:${SCRIPT_EXTENSIONS.join('|')})$`)
    expect(config.files).toEqual([`${THEME_SOURCE_DIR}/**/*.{${SCRIPT_EXTENSIONS.join(',')}}`])
  })

  it('names the plugin itself, under its namespace, with the package name and version', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { name: string; version: string }
    expect(config.plugins?.[NAMESPACE]).toBe(plugin)
    expect(plugin.meta).toEqual({ name: manifest.name, version: manifest.version, namespace: NAMESPACE })
    expect(manifest.name.startsWith(`${NAMESPACE}/`)).toBe(true)
  })
})
