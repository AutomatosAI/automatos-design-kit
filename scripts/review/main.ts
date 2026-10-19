/**
 * The review workflow's command (.github/workflows/theme-review.yml), run inside
 * `docker run --network none`. Node runs this TypeScript directly (type stripping, Node 22.18+).
 *
 * Environment (set by the workflow; nothing else is read):
 * - REVIEW_PACKAGE: the downloaded .autotheme;
 * - EXPECTED_DIGEST: the package digest the admin queue shows for the version;
 * - REVIEW_WORK: a writable folder for the rebuild and report.json;
 * - REVIEW_SUMMARY: the job summary file to append to (optional);
 * - KIT_COMMIT: the kit commit that ran the review (optional).
 *
 * Exit 0 when the outcome is pass, 1 when it is fail, 2 when the job itself is misconfigured.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { probeNetwork } from './probe.ts'
import { reviewPackage, type ToolInfo } from './review.ts'
import { jobSummary, summaryText } from './summary.ts'

const EXIT_PASS = 0
const EXIT_FAIL = 1
const EXIT_MISCONFIGURED = 2
const REQUIRED = ['REVIEW_PACKAGE', 'EXPECTED_DIGEST', 'REVIEW_WORK'] as const

function versionOf(specifier: string): string {
  try {
    const manifest = createRequire(import.meta.url)(specifier) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function tools(): ToolInfo {
  return {
    kitCommit: process.env.KIT_COMMIT || 'unknown',
    node: process.version,
    vite: versionOf('vite/package.json'),
    preset: versionOf('@automatos/vite-preset/package.json'),
  }
}

async function run(): Promise<number> {
  const missing = REQUIRED.filter((name) => !process.env[name])
  if (missing.length > 0) {
    process.stderr.write(`::error title=Review not run::${missing.join(', ')} not set; the workflow sets them.\n`)
    return EXIT_MISCONFIGURED
  }
  const workDir = process.env.REVIEW_WORK as string
  mkdirSync(workDir, { recursive: true })
  const zip = readFileSync(process.env.REVIEW_PACKAGE as string)
  const expected = (process.env.EXPECTED_DIGEST as string).trim().toLowerCase()
  const report = await reviewPackage(zip, expected, { workDir, tools: tools(), probe: () => probeNetwork() })
  writeFileSync(join(workDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${summaryText(report)}\n`)
  const summaryFile = process.env.REVIEW_SUMMARY
  if (summaryFile) appendFileSync(summaryFile, jobSummary(report))
  return report.outcome === 'pass' ? EXIT_PASS : EXIT_FAIL
}

run().then(
  (code) => { process.exitCode = code },
  (error: unknown) => {
    const message = (error instanceof Error ? error.message : String(error)).split('\n')[0]
    process.stderr.write(`::error title=Review crashed::${message}\n`)
    const summaryFile = process.env.REVIEW_SUMMARY
    if (summaryFile) appendFileSync(summaryFile, `## Theme review: FAIL\n\nThe review crashed: ${message}\n`)
    process.exitCode = EXIT_FAIL
  },
)
