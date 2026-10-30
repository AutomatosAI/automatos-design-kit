/**
 * `node scripts/review/axe.ts` (PRD-261 B-02j): the axe part of the review's "Previews and accessibility" section, run
 * by theme-review.yml after the review has passed, on the runner, outside the review's no-network container. The
 * package is drawn in the kit's browser harness with `automatos-theme shots` (Chromium and WebKit, an axe scan of
 * each shot; axe-pass.ts), and what axe found is printed and appended to the job summary after the review's own text
 * (axe-report.ts). It never feeds back into the review: the review has written its report and outcome before this
 * starts, and this reads only the downloaded package and writes only to its own work folder and the job summary.
 *
 * Environment (set by the workflow; nothing else is read):
 * - REVIEW_PACKAGE: the downloaded .autotheme;
 * - AXE_WORK: a folder of its own for the laid-out package and the shots, never the review's work folder;
 * - REVIEW_SUMMARY: the job summary file to append to (optional).
 *
 * Exit code 0 whatever happens: report only. What went wrong is the text's "not run" line.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { runShots } from '../../packages/theme-cli/src/shots.ts'
import { axePass, type Shots } from './axe-pass.ts'
import { axeJobSummary, axeText, type AxeRun } from './axe-report.ts'

const EXIT_OK = 0
const REQUIRED = ['REVIEW_PACKAGE', 'AXE_WORK'] as const

const output = {
  out: (line: string): void => { process.stdout.write(`${line}\n`) },
  err: (line: string): void => { process.stderr.write(`${line}\n`) },
}

/** The kit's own `automatos-theme shots`, its output on this job's log. */
const kitShots: Shots = (themeDir, outDir) => (
  runShots(['shots', themeDir, '--out', outDir], output, { env: process.env, fetch: globalThis.fetch, cwd: process.cwd() })
)

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]
}

async function pass(): Promise<AxeRun> {
  const missing = REQUIRED.filter((name) => !process.env[name])
  if (missing.length > 0) return { status: 'not_run', why: `${missing.join(', ')} not set; the workflow sets them.` }
  const workDir = process.env.AXE_WORK as string
  try {
    mkdirSync(workDir, { recursive: true })
    return await axePass(readFileSync(process.env.REVIEW_PACKAGE as string), workDir, kitShots)
  } catch (error) {
    return { status: 'not_run', why: `the pass stopped: ${firstLine(error)}` }
  }
}

async function run(): Promise<void> {
  const text = axeText(await pass())
  process.stdout.write(`${text}\n`)
  const summaryFile = process.env.REVIEW_SUMMARY
  if (summaryFile) appendFileSync(summaryFile, axeJobSummary(text))
}

run().then(
  () => { process.exitCode = EXIT_OK },
  (error: unknown) => {
    process.stderr.write(`::warning title=Axe pass not reported::${firstLine(error)}\n`)
    process.exitCode = EXIT_OK
  },
)
