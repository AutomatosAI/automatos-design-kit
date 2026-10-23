/**
 * The isolated review of one Marketplace theme version (PRD-261 C-02b, D3-a: a person-run kit job).
 *
 * In order: no network (probe.ts); the package read and checked as core's reader checks it (the
 * kit's port, `@automatos/theme-cli/check`); its digest against the one the admin queue named;
 * source/ present; the JS rules on source/ (`@automatos/theme-rules`); the reproducible build
 * (rebuild.ts). The outcome is `pass` only when every check passed; a JS-rule warning is listed for
 * the reviewer and fails nothing. The reviewer pastes the summary (summary.ts) into the admin
 * queue's report note with that outcome; core refuses to approve without a passing note.
 */
import { checkPackage } from '@automatos/theme-cli/check'
import { readZip } from '@automatos/theme-cli/zip'
import { jsRuleFindings, sourceScripts, SOURCE_PREFIX, type JsFinding } from '@automatos/theme-rules'
import { packageDigest, sha256Hex } from '../../packages/theme-cli/src/digest.ts'
import type { ProbeResult } from './probe.ts'
import { compareDist, DIST_PREFIX, rebuildDist, type DistComparison, type Files } from './rebuild.ts'

export const REVIEW_SCHEMA = 'automatos-theme-review/v1'
const SHA256_HEX = /^[0-9a-f]{64}$/

export type Status = 'pass' | 'fail' | 'not_run'
export type Outcome = 'pass' | 'fail'

export interface Check {
  readonly name: string
  readonly status: Status
  readonly detail: string
  /** Plain lines under the check: the reasons, findings or differing files. */
  readonly items: readonly string[]
}

export interface ToolInfo {
  readonly kitCommit: string
  readonly node: string
  readonly vite: string
  readonly preset: string
}

export interface ReviewReport {
  readonly schema: typeof REVIEW_SCHEMA
  readonly id: string | null
  readonly version: string | null
  readonly expectedDigest: string
  readonly digest: string | null
  readonly zipSha256: string
  readonly tools: ToolInfo
  readonly outcome: Outcome
  readonly checks: readonly Check[]
  readonly findings: readonly JsFinding[]
}

export interface ReviewOptions {
  readonly workDir: string
  readonly tools: ToolInfo
  readonly probe: () => Promise<ProbeResult>
}

function check(name: string, status: Status, detail: string, items: readonly string[] = []): Check {
  return { name, status, detail, items }
}

function notRun(name: string, why: string): Check {
  return check(name, 'not_run', why)
}

interface Read {
  readonly files: Files | null
  readonly manifest: Readonly<Record<string, unknown>> | null
  readonly check: Check
}

/** The zip read and checked as core's reader checks it. */
function readPackage(zip: Buffer): Read {
  let entries: ReturnType<typeof readZip>
  try {
    entries = readZip(zip)
  } catch (error) {
    return { files: null, manifest: null, check: check('Package', 'fail', `Not a readable zip: ${String(error)}`) }
  }
  const checked = checkPackage(entries)
  if (checked.manifest === null) {
    const items = checked.errors.map((error) => `${error.code} ${error.path}: ${error.message}`)
    return { files: null, manifest: null, check: check('Package', 'fail', "Core's reader would refuse it.", items) }
  }
  const files = new Map(Array.from(checked.files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  return { files, manifest: checked.manifest, check: check('Package', 'pass', `${files.size} files pass the server's checks (kit port).`) }
}

function digestCheck(digest: string, expected: string): Check {
  if (!SHA256_HEX.test(expected)) return check('Digest', 'fail', 'The expected digest is not 64 lower-case hex characters.')
  if (digest === expected) return check('Digest', 'pass', 'The package is the version the admin queue named.')
  return check('Digest', 'fail', `The package's digest ${digest} is not the expected ${expected}: wrong file or changed bytes.`)
}

function sourceCheck(files: Files): Check {
  const all = Array.from(files.keys()).filter((path) => path.startsWith(SOURCE_PREFIX))
  if (all.length === 0) return check('Source', 'fail', 'No source/: a Marketplace theme ships its source for the reproducible build.')
  return check('Source', 'pass', `${all.length} files under source/, ${sourceScripts(files).length} of them scripts.`)
}

/** What a reviewer reads before a warning's line, so it can't pass for a refusal. */
export const WARNING_ITEM_PREFIX = 'warning: '

function findingItem(item: JsFinding): string {
  const line = `${item.code} ${item.path}:${item.line} ${item.message} | ${item.excerpt}`
  return item.severity === 'warning' ? `${WARNING_ITEM_PREFIX}${line}` : line
}

/** Errors fail the check; warnings alone pass it, each listed for the reviewer to read. */
function jsCheck(findings: readonly JsFinding[], scripts: number): Check {
  if (findings.length === 0) return check('JS rules', 'pass', `No findings in ${scripts} source scripts.`)
  const items = findings.map(findingItem)
  if (findings.every((item) => item.severity === 'warning')) {
    const noun = findings.length === 1 ? 'warning' : 'warnings'
    return check('JS rules', 'pass', `Nothing refused; ${findings.length} ${noun} in source/ for the reviewer to read.`, items)
  }
  return check('JS rules', 'fail', `${findings.length} findings in source/.`, items)
}

function comparisonItems(comparison: DistComparison): string[] {
  return [
    ...comparison.differing.map((path) => `differs: ${path}`),
    ...comparison.onlyInPackage.map((path) => `only in the package: ${path}`),
    ...comparison.onlyInBuild.map((path) => `only in the rebuild: ${path}`),
  ]
}

/** source/ rebuilt with the kit's preset; the package digest with the rebuilt dist/ must match. */
async function buildCheck(files: Files, digest: string, workDir: string): Promise<Check> {
  const rebuilt = await rebuildDist(files, workDir)
  if (!rebuilt.ok) return check('Reproducible build', 'fail', rebuilt.error)
  const comparison = compareDist(files, rebuilt.dist)
  const hashes: Record<string, string> = {}
  files.forEach((data, path) => { if (!path.startsWith(DIST_PREFIX)) hashes[path] = sha256Hex(data) })
  rebuilt.dist.forEach((data, path) => { hashes[path] = sha256Hex(data) })
  const rebuiltDigest = packageDigest(hashes)
  if (comparison.same && rebuiltDigest === digest) {
    return check('Reproducible build', 'pass', `dist/ rebuilt byte for byte from ${rebuilt.entry} (${rebuilt.dist.size} files); same digest.`)
  }
  const detail = `The rebuild of source/ (entry ${rebuilt.entry}) gives digest ${rebuiltDigest}, not ${digest}.`
  return check('Reproducible build', 'fail', detail, comparisonItems(comparison))
}

function text(manifest: Readonly<Record<string, unknown>> | null, key: string): string | null {
  const value = manifest?.[key]
  return typeof value === 'string' ? value : null
}

function report(base: Omit<ReviewReport, 'outcome' | 'schema'>): ReviewReport {
  const outcome: Outcome = base.checks.every((item) => item.status === 'pass') ? 'pass' : 'fail'
  return { schema: REVIEW_SCHEMA, ...base, outcome }
}

/** Reviews one package's bytes against the digest the admin queue named. */
export async function reviewPackage(zip: Buffer, expectedDigest: string, options: ReviewOptions): Promise<ReviewReport> {
  const empty = { id: null, version: null, expectedDigest, digest: null, zipSha256: sha256Hex(zip), tools: options.tools, findings: [] }
  const probe = await options.probe()
  const network = probe.isolated
    ? check('No network', 'pass', 'Every probe failed.', probe.lines)
    : check('No network', 'fail', 'A probe got through: the review stopped before reading the package.', probe.lines)
  if (!probe.isolated) return report({ ...empty, checks: [network] })
  const read = readPackage(zip)
  if (read.files === null) {
    const skipped = ['Digest', 'Source', 'JS rules', 'Reproducible build'].map((name) => notRun(name, 'The package was refused.'))
    return report({ ...empty, checks: [network, read.check, ...skipped] })
  }
  const files = read.files
  const digest = packageDigest(Object.fromEntries(Array.from(files, ([path, data]): [string, string] => [path, sha256Hex(data)])))
  const source = sourceCheck(files)
  const findings = jsRuleFindings(files)
  const build = source.status === 'pass' ? await buildCheck(files, digest, options.workDir) : notRun('Reproducible build', 'No source/ to build.')
  const checks = [network, read.check, digestCheck(digest, expectedDigest), source, jsCheck(findings, sourceScripts(files).length), build]
  return report({ ...empty, id: text(read.manifest, 'id'), version: text(read.manifest, 'version'), digest, checks, findings })
}
