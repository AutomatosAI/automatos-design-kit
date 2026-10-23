/**
 * `check --rebuild` runs the review job's own rebuild (scripts/review/rebuild.ts): a theme built with
 * the kit's preset, as its author builds it, rebuilds byte for byte and passes; a dist/ changed after
 * the build is an error naming the file. Real Vite builds, so each test has a long timeout.
 */
import { appendFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildThemeFolder } from '../../../scripts/review/rebuild.ts'
import { HELLO_DIR, HELLO_ENTRY, ranCheck, removeTempFolders, tempFolder } from './check-support.ts'

/** A cold runner's Vite build of the theme, twice (the author's and the rebuild). */
const BUILD_TIMEOUT_MS = 120_000
const HELLO_CSS = '.hello-frame { min-height: 100vh; }\n.hello-content { padding: 24px; }\n'
/** What an author's theme folder holds beside src/ (the build writes dist/). */
const COPIED = ['theme.json', 'README.md', 'looks']

afterEach(removeTempFolders)

/** The hello theme as its author ships it: src/ built with the kit's preset into dist/. */
async function builtHello(): Promise<string> {
  const root = join(tempFolder(), 'hello')
  for (const path of COPIED) cpSync(join(HELLO_DIR, path), join(root, path), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src/entry.js'), `import './theme.css'\n${HELLO_ENTRY}`)
  writeFileSync(join(root, 'src/theme.css'), HELLO_CSS)
  await buildThemeFolder(root, 'src/entry.js')
  return root
}

function levelOf(out: readonly string[], name: string): string | undefined {
  return out.find((line) => line.startsWith(`${name} `))?.split(/\s+/)[1]
}

describe('check --rebuild', () => {
  it('passes a theme whose source/ rebuilds to its dist/ byte for byte', async () => {
    const ran = await ranCheck(['check', await builtHello(), '--rebuild'])
    expect(levelOf(ran.out, 'reproducibleBuild')).toBe('pass')
    expect(levelOf(ran.out, 'jsRules')).toBe('pass')
    expect(ran.code).toBe(0)
  }, BUILD_TIMEOUT_MS)

  it('is an error when dist/ was changed after the build', async () => {
    const root = await builtHello()
    appendFileSync(join(root, 'dist/entry.js'), '// changed after the build\n')
    const ran = await ranCheck(['check', root, '--rebuild'])
    expect(levelOf(ran.out, 'reproducibleBuild')).toBe('error')
    expect(ran.out).toContain('    differs: dist/entry.js')
    expect(ran.code).toBe(1)
  }, BUILD_TIMEOUT_MS)
})
