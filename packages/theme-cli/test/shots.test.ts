/**
 * `automatos-theme shots` (PRD-261 B-02f): the harness build, then the shots, each with the theme folder and the out
 * folder in the environment, from the harness's folder, the second only once the first passed; a usage error, a
 * folder that is no theme folder and a theme whose look data isn't built yet run nothing. The steps run through a
 * stand-in here; kit CI's harness job runs them for real. The kit's install holds both configs and both commands.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OUT_ENV, THEME_ENV } from '@automatos/theme-harness/router'
import { afterEach, describe, expect, it } from 'vitest'
import { run } from '../src/cli-main.ts'
import {
  DEFAULT_OUT, HARNESS_BUILD_CONFIG, HARNESS_SHOTS_CONFIG, installedTools, runShots, SHOTS_USAGE, type ShotsTools,
} from '../src/shots.ts'

const HARNESS = '/kit/packages/theme-harness'
const VITE = '/kit/node_modules/vite/bin/vite.js'
const PLAYWRIGHT = '/kit/node_modules/@playwright/test/cli.js'
const FAILED_BUILD = 3

interface Ran {
  readonly script: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

/** A theme folder: theme.json naming a default look, src/entry.ts, and its presets unless `built` is false. */
function themeFolder(built = true): string {
  const folder = mkdtempSync(join(tmpdir(), 'shots-'))
  folders.push(folder)
  mkdirSync(join(folder, 'src'))
  writeFileSync(join(folder, 'theme.json'), JSON.stringify({ id: 'example/sample', look: 'dusk' }))
  writeFileSync(join(folder, 'src/entry.ts'), 'export default {}\n')
  if (built) {
    mkdirSync(join(folder, 'looks/presets'), { recursive: true })
    writeFileSync(join(folder, 'looks/presets/dusk.look.json'), '{}\n')
  }
  return folder
}

/** runShots with stand-in tools whose steps answer `codes` in turn. */
function shots(argv: readonly string[], cwd: string, codes: readonly number[] = [0, 0]) {
  const ran: Ran[] = []
  const out: string[] = []
  const err: string[] = []
  const tools: ShotsTools = {
    harnessDir: HARNESS,
    viteBin: VITE,
    playwrightBin: PLAYWRIGHT,
    run: (script, args, options) => {
      ran.push({ script, args, cwd: options.cwd, env: options.env })
      return codes[ran.length - 1] ?? 0
    },
  }
  const deps = { env: { KEEP: 'kept' }, fetch: globalThis.fetch, cwd }
  const code = runShots(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, deps, () => tools)
  return { code, ran, out, err }
}

describe('automatos-theme shots', () => {
  it('builds the harness, then runs the shots, both from the harness with the two folders in the environment', () => {
    const theme = themeFolder()
    const result = shots(['shots', theme, '--out', 'pictures'], theme)
    expect(result.code).toBe(0)
    expect(result.ran.map(({ script, args, cwd }) => ({ script, args, cwd }))).toEqual([
      { script: VITE, args: ['build', '--config', join(HARNESS, HARNESS_BUILD_CONFIG)], cwd: HARNESS },
      { script: PLAYWRIGHT, args: ['test', '--config', join(HARNESS, HARNESS_SHOTS_CONFIG)], cwd: HARNESS },
    ])
    result.ran.forEach(({ env }) => {
      expect(env[THEME_ENV]).toBe(theme)
      expect(env[OUT_ENV]).toBe(join(theme, 'pictures'))
      expect(env.KEEP).toBe('kept')
    })
    expect(result.out).toEqual([join(theme, 'pictures')])
  })

  it(`writes to ./${DEFAULT_OUT} unless --out names a folder`, () => {
    const theme = themeFolder()
    expect(shots(['shots', '.'], theme).ran[0].env[OUT_ENV]).toBe(join(theme, DEFAULT_OUT))
  })

  it("stops at a failed build with the build's exit code, and never runs the shots", () => {
    const result = shots(['shots', '.'], themeFolder(), [FAILED_BUILD])
    expect(result.code).toBe(FAILED_BUILD)
    expect(result.ran).toHaveLength(1)
    expect(result.err).toEqual([`automatos-theme shots: the harness build failed (exit code ${FAILED_BUILD}).`])
  })

  it("ends with the shots' exit code when they fail", () => {
    const result = shots(['shots', '.'], themeFolder(), [0, 1])
    expect([result.code, result.ran.length, result.out]).toEqual([1, 2, []])
  })

  it.each([[['shots']], [['shots', 'a', 'b']], [['shots', 'a', '--to', 'x']]])('%j is a usage error and runs nothing', (argv) => {
    const result = shots(argv, themeFolder())
    expect([result.code, result.err, result.ran]).toEqual([2, [SHOTS_USAGE], []])
  })

  it('refuses a folder with no theme.json, and a theme whose presets are not built yet, running nothing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'shots-'))
    folders.push(empty)
    const none = shots(['shots', '.'], empty)
    expect([none.code, none.ran]).toEqual([1, []])
    expect(none.err[0]).toContain('has no theme.json')
    const unbuilt = shots(['shots', '.'], themeFolder(false))
    expect([unbuilt.code, unbuilt.ran]).toEqual([1, []])
    expect(unbuilt.err[0]).toContain("run the theme's build first")
  })

  it('is the command table\'s shots row: a usage error through run()', async () => {
    const err: string[] = []
    const code = await run(['shots'], { out: () => undefined, err: (line) => err.push(line) }, { env: {}, fetch: globalThis.fetch, cwd: process.cwd() })
    expect([code, err]).toEqual([2, [SHOTS_USAGE]])
  })

  it("finds the harness's two configs and both commands in the kit's install", () => {
    const tools = installedTools()
    expect(existsSync(join(tools.harnessDir, HARNESS_BUILD_CONFIG))).toBe(true)
    expect(existsSync(join(tools.harnessDir, HARNESS_SHOTS_CONFIG))).toBe(true)
    expect(existsSync(tools.viteBin)).toBe(true)
    expect(existsSync(tools.playwrightBin)).toBe(true)
  })
})
