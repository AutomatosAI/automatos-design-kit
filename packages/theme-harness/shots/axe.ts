/**
 * PRD-261 B-02f: the axe scan of each shot. axe-core (through @axe-core/playwright) reads the theme's stage alone
 * (#harness-stage: the toolbar is the harness's, not the theme's) with its default rules; each shot keeps every
 * violation with its impact, the rule's help and the elements it found, and axe.json holds a folder's shots. A
 * critical violation fails the spec; the others are listed for the reviewer.
 */
import { writeFileSync } from 'node:fs'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { STAGE_ID } from '../src/host/router.ts'

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>
type AxeViolation = AxeResults['violations'][number]

export const AXE_FILE = 'axe.json'
/** The impact that fails the spec. */
export const CRITICAL = 'critical'

export interface ShotViolation {
  readonly id: string
  readonly impact: string | null
  readonly help: string
  readonly helpUrl: string
  /** Each element the rule found, as axe's selector. */
  readonly targets: readonly string[]
}

export interface ShotScan {
  readonly shot: string
  readonly violations: readonly ShotViolation[]
  readonly passes: number
  readonly incomplete: number
}

function violationOf(violation: AxeViolation): ShotViolation {
  const targets = violation.nodes.map((node) => node.target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : String(part))).join(' '))
  return { id: violation.id, impact: violation.impact ?? null, help: violation.help, helpUrl: violation.helpUrl, targets }
}

/** axe over the theme's stage, as it is drawn now. */
export async function scanShot(page: Page, shot: string): Promise<ShotScan> {
  const results = await new AxeBuilder({ page }).include(`#${STAGE_ID}`).analyze()
  return { shot, violations: results.violations.map(violationOf), passes: results.passes.length, incomplete: results.incomplete.length }
}

/** One line per critical violation: the shot, the rule, how many elements and the rule's help. */
export function criticalViolations(scans: readonly ShotScan[]): string[] {
  return scans.flatMap((scan) =>
    scan.violations
      .filter((violation) => violation.impact === CRITICAL)
      .map((violation) => `${scan.shot}: ${violation.id} (${violation.targets.length} elements): ${violation.help}`),
  )
}

/** Writes a folder's scans as axe.json: two-space JSON with a closing newline. */
export function writeAxeReport(file: string, scans: readonly ShotScan[]): void {
  writeFileSync(file, `${JSON.stringify({ scans }, null, 2)}\n`)
}
