/**
 * The `jsRules` check: the Marketplace review's JS rules on the package's source/ (`@automatos/theme-rules`).
 *
 * The same table the review job (scripts/review/review.ts) runs: an error-severity finding refuses
 * the package, so the check is an error; warnings alone (a theme that listens, or opens the
 * microphone or camera) are listed for the reviewer, so the check is a warning, each line starting
 * `warning: ` so it can't pass for a refusal. A package with no source/ (a theme folder with no
 * src/) installs privately but can't be reviewed for the Marketplace, and its JS rules are not measured.
 */
import { jsRuleFindings, sourceScripts, SOURCE_PREFIX, type JsFinding } from '@automatos/theme-rules'
import { WARNING_PREFIX } from '../cli-main.ts'
import { LEVEL_ERROR, LEVEL_NOT_MEASURED, LEVEL_PASS, LEVEL_WARNING, type CheckEntry, type CheckText, type Files } from './report.ts'

export const NO_SOURCE = (
  'The package has no source/ (the theme folder has no src/), so there is nothing to run the JS rules on: '
  + 'it installs privately, but the Marketplace review refuses it.'
)

export interface JsEntry extends CheckEntry {
  readonly status: 'checked' | 'no_source'
  readonly scripts: number
  readonly findings: readonly JsFinding[]
  readonly reason: string
}

function reasonOf(errors: number, warnings: number, scripts: number): string {
  if (errors > 0) return `${errors} finding(s) in source/ refuse the package${warnings > 0 ? `, and ${warnings} warning(s)` : ''}.`
  if (warnings > 0) return `Nothing refused; ${warnings} warning(s) in source/ for the reviewer to read.`
  return `No findings in ${scripts} source script(s).`
}

/** The `jsRules` entry: every finding of the rules table on source/, in path and line order. */
export function jsRulesCheck(files: Files): JsEntry {
  const hasSource = Array.from(files.keys()).some((path) => path.startsWith(SOURCE_PREFIX))
  if (!hasSource) return { level: LEVEL_NOT_MEASURED, status: 'no_source', scripts: 0, findings: [], reason: NO_SOURCE }
  const findings = jsRuleFindings(files)
  const scripts = sourceScripts(files).length
  const errors = findings.filter((finding) => finding.severity === 'error').length
  const warnings = findings.length - errors
  const level = errors > 0 ? LEVEL_ERROR : warnings > 0 ? LEVEL_WARNING : LEVEL_PASS
  return { level, status: 'checked', scripts, findings, reason: reasonOf(errors, warnings, scripts) }
}

function findingItem(finding: JsFinding): string {
  const line = `${finding.code} ${finding.path}:${finding.line} ${finding.message} | ${finding.excerpt}`
  return finding.severity === 'warning' ? `${WARNING_PREFIX}${line}` : line
}

/** The `jsRules` line: its reason, and each finding with its file and line. */
export function describeJs(entry: JsEntry): CheckText {
  return { text: entry.reason, items: entry.findings.map(findingItem) }
}
