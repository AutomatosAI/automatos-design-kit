/**
 * Play's own lint, as `npm run lint` runs it in Play's folder: its eslint.config.js loads the plugin's
 * recommended config, so a seeded file under Play's src/ fails with the three codes; and its `lint`
 * script runs eslint over src/ with no warning allowed. kit.yml's Lint step runs that script over Play's
 * real src/, which must trip no rule.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { NAMESPACE } from '../src/index.ts'
import { THEME_SOURCE_DIR } from '../src/rules.ts'
import { SEEDED_CODES, SEEDED_FILE, SEEDED_TEXT } from './seeded.ts'

const PLAY = resolve(fileURLToPath(new URL('../../../themes/play', import.meta.url)))
const PLUGIN_MANIFEST = new URL('../package.json', import.meta.url)
const LINT_SCRIPT = `eslint ${THEME_SOURCE_DIR} --max-warnings 0`
/** Loading ESLint, Play's config and the plugin on a cold runner. */
const LINT_TIMEOUT_MS = 30_000

interface Manifest {
  readonly name: string
  readonly scripts?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

function manifestAt(path: string | URL): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

describe("Play's lint", () => {
  it('runs eslint over src/, fails on a warning too, and pins the eslint the plugin peers on', () => {
    const play = manifestAt(join(PLAY, 'package.json'))
    const plugin = manifestAt(PLUGIN_MANIFEST)
    expect(play.scripts?.lint).toBe(LINT_SCRIPT)
    expect(play.devDependencies?.eslint).toBe(plugin.peerDependencies?.eslint)
    expect(plugin.devDependencies?.eslint).toBe(plugin.peerDependencies?.eslint)
    expect(play.devDependencies?.[plugin.name]).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it("fails a seeded src/ file with the three codes, through Play's eslint.config.js", async () => {
    const eslint = new ESLint({ cwd: PLAY })
    const [result] = await eslint.lintText(SEEDED_TEXT, { filePath: join(PLAY, THEME_SOURCE_DIR, SEEDED_FILE) })
    expect(result.messages.map((message) => message.ruleId)).toEqual(SEEDED_CODES.map((code) => `${NAMESPACE}/${code}`))
    expect(result.errorCount).toBe(SEEDED_CODES.length)
    expect(result.warningCount).toBe(0)
  }, LINT_TIMEOUT_MS)
})
