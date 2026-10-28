/**
 * `node scripts/lighthouse/main.ts` (PRD-261 B-02h), run by kit.yml's harness job after the shots, from the kit's
 * folder: Lighthouse over every theme under themes/ drawn in the browser harness (plan.ts), its HTML and JSON reports
 * written to REPORT_DIR, and the scores as one table (summary.ts) printed and added to the job summary
 * (GITHUB_STEP_SUMMARY, when set).
 *
 * Report only: the exit code is 0 whatever the scores, whatever run failed, and even when nothing could run (a
 * warning then says why). kit.yml's step also continues on an error, so the build never fails on Lighthouse.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installedRunner, lighthouseVersion } from './installed.ts'
import { REPORT_DIR } from './plan.ts'
import { measureAll } from './run.ts'
import { summaryTable } from './summary.ts'

const EXIT_OK = 0
const KIT_DIR = fileURLToPath(new URL('../..', import.meta.url))

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split('\n')[0]
}

async function main(): Promise<number> {
  try {
    const reportDir = resolve(KIT_DIR, REPORT_DIR)
    mkdirSync(reportDir, { recursive: true })
    const results = await measureAll(installedRunner(KIT_DIR), reportDir)
    const table = summaryTable(results, lighthouseVersion())
    process.stdout.write(`${table}\n`)
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (summaryFile) appendFileSync(summaryFile, table)
  } catch (error) {
    process.stderr.write(`::warning title=Lighthouse not run::${firstLine(error)}\n`)
  }
  return EXIT_OK
}

main().then((code) => { process.exitCode = code })
