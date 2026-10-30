/**
 * PRD-261 B-02h: the real Runner (run.ts) from the kit's install, for kit.yml's harness job.
 *
 * - The server is the theme CLI's `automatos-theme dev <theme> --port LIGHTHOUSE_PORT` (the harness the shots draw
 *   in), started by Node; it answers 503 until its build is in, so the runner waits for a 200 on `/`, and stops when
 *   the command ends first or SERVER_TIMEOUT_MS passes. Stopping it is SIGTERM, which `dev` takes as Ctrl-C.
 * - Lighthouse is its own command (the `lighthouse` package's bin, pinned in the root package.json), run by Node with
 *   CHROME_PATH naming the Chromium Playwright installed for the shots, so no other browser is fetched or used.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import { HARNESS_HOST } from '@automatos/theme-harness/router'
import { themeCli } from '../../packages/theme-harness/shots/theme-cli.ts'
import { runNodeScript } from '../../packages/theme-cli/src/run-step.ts'
import { binOf, themeFolderProblem } from '../../packages/theme-cli/src/shots.ts'
import { LIGHTHOUSE_PORT, MANIFEST_FILE, themeFolders, THEMES_DIR } from './plan.ts'
import type { Runner, Serving } from './run.ts'

/** Each `dev` builds the harness before it serves: a cold CI runner's build, with room to spare. */
export const SERVER_TIMEOUT_MS = 300_000
const POLL_MS = 1_000
const MS_PER_SECOND = 1_000
const ANSWER_TIMEOUT_MS = 5_000
const COMMAND = 'lighthouse'
const LIGHTHOUSE_PACKAGE = 'lighthouse'

/** The pinned Lighthouse's version, from its package.json. */
export function lighthouseVersion(): string {
  const { version } = createRequire(import.meta.url)(`${LIGHTHOUSE_PACKAGE}/package.json`) as { readonly version?: unknown }
  return typeof version === 'string' ? version : 'unknown'
}

/** True once the server answers `/` with a 2xx. */
async function answers(origin: string): Promise<boolean> {
  try {
    return (await fetch(`${origin}/`, { signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS) })).ok
  } catch {
    return false
  }
}

/** Null once `origin` answers; why not, when the command ended first or the time ran out. */
async function untilServing(origin: string, ended: () => string | null, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const end = ended()
    if (end !== null) return `automatos-theme dev ${end} before it served ${origin}`
    if (await answers(origin)) return null
    await sleep(POLL_MS)
  }
  return `${origin} did not answer within ${timeoutMs / MS_PER_SECOND} s`
}

/** `automatos-theme dev <themeDir> --port <port>`, waited for until it serves. */
export async function serveTheme(themeDir: string, port: number, timeoutMs: number = SERVER_TIMEOUT_MS): Promise<Serving> {
  const origin = `http://${HARNESS_HOST}:${port}`
  const child = spawn(process.execPath, [themeCli(), 'dev', themeDir, '--port', String(port)], { stdio: ['ignore', 'inherit', 'inherit'] })
  let endedWith: string | null = null
  const ended = new Promise<void>((resolve) => {
    child.once('exit', (code, signal) => {
      endedWith = `ended (exit code ${code ?? signal})`
      resolve()
    })
    child.once('error', (error) => {
      endedWith = `could not start (${error.message})`
      resolve()
    })
  })
  const stop = async (): Promise<void> => {
    if (endedWith === null) child.kill('SIGTERM')
    await ended
  }
  const why = await untilServing(origin, () => endedWith, timeoutMs)
  return why === null ? { ok: true, origin, stop } : { ok: false, why, stop }
}

function readManifest(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

/** The Runner over the kit at `kitDir`: its themes/, `dev` on LIGHTHOUSE_PORT, and Lighthouse on Playwright's Chromium. */
export function installedRunner(kitDir: string): Runner {
  const require = createRequire(import.meta.url)
  const lighthouseBin = binOf(require, LIGHTHOUSE_PACKAGE, COMMAND)
  const env: NodeJS.ProcessEnv = { ...process.env, CHROME_PATH: chromium.executablePath() }
  const themesDir = join(kitDir, THEMES_DIR)
  return {
    themes: themeFolders(themesDir),
    problem: (theme) => themeFolderProblem(join(themesDir, theme), COMMAND),
    manifest: (theme) => readManifest(join(themesDir, theme, MANIFEST_FILE)),
    serve: (theme) => serveTheme(join(themesDir, theme), LIGHTHOUSE_PORT),
    lighthouse: (args) => runNodeScript(lighthouseBin, args, { cwd: kitDir, env }),
    readReport: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
  }
}
