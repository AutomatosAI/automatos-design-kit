/**
 * PRD-261 B-02h: the Lighthouse runs, one theme at a time (plan.ts has what is measured). For each theme: why the
 * harness can't draw its folder (it is then not served), else `automatos-theme dev` serving it, every run of it in
 * turn, and the server stopped. A run that fails, or a theme that is not served, is a row that says why; nothing here
 * throws for one, so every other run still happens. What starts processes and reads files is the Runner (installed.ts
 * gives the real one; the tests give their own).
 */
import { lighthouseArgs, pageAddress, reportBase, runsOf, JSON_REPORT_SUFFIX, type LighthouseRun } from './plan.ts'
import { scoresOf, type RunResult } from './summary.ts'

/** A theme served by `automatos-theme dev`, or why it isn't; `stop` ends the command either way. */
export type Serving =
  | { readonly ok: true; readonly origin: string; readonly stop: () => Promise<void> }
  | { readonly ok: false; readonly why: string; readonly stop: () => Promise<void> }

export interface Runner {
  /** The themes to measure, by folder name under themes/. */
  readonly themes: readonly string[]
  /** Why the harness can't draw the theme's folder (theme-cli's themeFolderProblem), or null. */
  readonly problem: (theme: string) => string | null
  /** The theme's theme.json, parsed, or null when it can't be read. */
  readonly manifest: (theme: string) => unknown
  /** Starts `automatos-theme dev` over the theme; resolves once it answers, or to why it doesn't. */
  readonly serve: (theme: string) => Promise<Serving>
  /** Lighthouse's command with these arguments; resolves to its exit code. */
  readonly lighthouse: (args: readonly string[]) => Promise<number>
  /** A report file's text, or null when there is no such file. */
  readonly readReport: (path: string) => string | null
}

const EXIT_OK = 0

/** One run against the served theme: its scores from the JSON report, or why there are none. */
export async function measure(run: LighthouseRun, origin: string, runner: Runner, reportDir: string): Promise<RunResult> {
  const base = reportBase(reportDir, run)
  const code = await runner.lighthouse(lighthouseArgs(pageAddress(origin, run.page), run.factor, base))
  if (code !== EXIT_OK) return { run, failure: `Lighthouse exited with code ${code}` }
  const text = runner.readReport(`${base}${JSON_REPORT_SUFFIX}`)
  if (text === null) return { run, failure: 'Lighthouse wrote no JSON report' }
  const scores = scoresOf(text)
  return typeof scores === 'string' ? { run, failure: scores } : { run, scores }
}

/** Every run of one theme, its server started first and stopped after, whatever happened. */
export async function measureTheme(theme: string, runner: Runner, reportDir: string): Promise<RunResult[]> {
  const runs = runsOf(theme, runner.manifest(theme))
  const problem = runner.problem(theme)
  if (problem !== null) return runs.map((run) => ({ run, failure: `not drawn: ${problem}` }))
  const serving = await runner.serve(theme)
  try {
    if (!serving.ok) return runs.map((run) => ({ run, failure: `the harness did not start: ${serving.why}` }))
    const results: RunResult[] = []
    for (const run of runs) results.push(await measure(run, serving.origin, runner, reportDir))
    return results
  } finally {
    await serving.stop()
  }
}

/** Every theme's runs, one theme at a time (one port, one server). */
export async function measureAll(runner: Runner, reportDir: string): Promise<RunResult[]> {
  const results: RunResult[] = []
  for (const theme of runner.themes) results.push(...(await measureTheme(theme, runner, reportDir)))
  return results
}
