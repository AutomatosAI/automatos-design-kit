/**
 * The review's "Previews and accessibility" section (PRD-261 B-02j): report only. It is never one of the review's
 * checks, so the outcome (`pass` only when every check passed, review.ts) never counts it, and the person reviewing
 * decides what it means. Three parts:
 *
 * - the previews per preset (previews.ts): present, size, and which preset claims each;
 * - contrast from the package's presets against declared pairs: not measured, since core's look schema
 *   (looks/schema.json: `schema`, `look` and `knobs`, nothing else) declares no text and ground pairs, so nothing in a
 *   package says which of a preset's colours is text on which ground (the kit's own design/contrast.json is never
 *   packed). A `mobile` block's pairs are measured by core's own review report (its contrast check), so the line says
 *   whether theme.json has one;
 * - axe over harness shots of the package: not here. It runs after the review, outside the no-network container that
 *   runs this (scripts/review/axe.ts), and its result follows this text in the job summary, never feeding back into it.
 */
import type { Files, Manifest } from '../../packages/theme-cli/src/check/report.ts'
import { previewsLines, previewsReport, type PreviewsReport } from './previews.ts'

export const SECTION_TITLE = 'Previews and accessibility'
export const SECTION_HEAD = `${SECTION_TITLE} (report only: the outcome above does not count it; the person reviewing decides):`
export const SECTION_NOT_READ = `${SECTION_TITLE} (report only): not made, since the package was not read.`
export const CONTRAST_NOT_MEASURED = (
  'Contrast: not measured. Core\'s look schema declares no text and ground pairs, so nothing in the package says '
  + 'which of a preset\'s colours is text on which ground.'
)
export const MOBILE_BLOCK = 'theme.json has a "mobile" block: core\'s own review report measures its colour pairs.'
export const NO_MOBILE_BLOCK = 'theme.json has no "mobile" block.'
export const AXE_AFTER = (
  'Axe: run after this review, outside its no-network container, over harness shots of this package; what it finds '
  + 'follows this text in the job summary and never changes the outcome.'
)
const MOBILE_FIELD = 'mobile'
const NOT_MEASURED = 'not_measured'

export interface ContrastReport {
  readonly status: typeof NOT_MEASURED
  readonly reason: string
  /** True when theme.json has a `mobile` block, whose pairs core's review report measures. */
  readonly mobileBlock: boolean
}

export interface PreviewsAndAccessibility {
  readonly previews: PreviewsReport
  readonly contrast: ContrastReport
}

/** Contrast against declared pairs: the look schema declares none, so not measured; and whether a `mobile` block is there. */
export function contrastReport(manifest: Manifest): ContrastReport {
  return { status: NOT_MEASURED, reason: CONTRAST_NOT_MEASURED, mobileBlock: manifest[MOBILE_FIELD] !== undefined }
}

/** The section's previews and contrast, from the package's theme.json and files. */
export function previewsAndAccessibility(manifest: Manifest, files: Files): PreviewsAndAccessibility {
  return { previews: previewsReport(manifest, files), contrast: contrastReport(manifest) }
}

/** The section as plain lines: its head, then each part indented under it; one line when the package was not read. */
export function sectionLines(section: PreviewsAndAccessibility | null): string[] {
  if (section === null) return [SECTION_NOT_READ]
  const { contrast } = section
  const parts = [
    ...previewsLines(section.previews),
    contrast.reason,
    `  ${contrast.mobileBlock ? MOBILE_BLOCK : NO_MOBILE_BLOCK}`,
    AXE_AFTER,
  ]
  return [SECTION_HEAD, ...parts.map((line) => `  ${line}`)]
}
