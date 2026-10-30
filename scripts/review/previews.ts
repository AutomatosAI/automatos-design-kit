/**
 * The previews of the review's "Previews and accessibility" section (PRD-261 B-02j, report.ts): report only, never a
 * check, so the review's outcome never counts them (review.ts).
 *
 * Each preset's previews as the Marketplace listing claims them, by theme-cli's check/previews.ts (the port of core's
 * listings.py `previews_by_preset`: a file stem `<preset>` or `<preset>-<screen>` belongs to that preset, the longest
 * preset id first), with each file's size in bytes; a preset with none says so. Then the previews theme.json lists that
 * no preset claims (the listing shows them apart from every preset), and the files in assets/previews/ theme.json
 * doesn't list (packed, never shown). Core's reader has already held every listed preview to its rules (a PNG of at
 * most 512 KB in assets/previews/, at most 16, each in the package), so nothing here refuses one.
 */
import { PREVIEW_DIR, previewsCheck } from '../../packages/theme-cli/src/check/previews.ts'
import type { Files, Manifest } from '../../packages/theme-cli/src/check/report.ts'

export interface PreviewFile {
  readonly path: string
  readonly bytes: number
  /** The screen the stem names after its preset (`<preset>-<screen>`), or null for the preset's own preview. */
  readonly screen: string | null
}

export interface PresetPreviewFiles {
  readonly id: string
  /** True for theme.json's default look. */
  readonly default: boolean
  /** Its previews, in theme.json's order; none when the listing shows it with none. */
  readonly previews: readonly PreviewFile[]
}

export interface PreviewsReport {
  /** The listing card's cover: the first preview theme.json lists, or null with none. */
  readonly cover: string | null
  readonly presets: readonly PresetPreviewFiles[]
  /** Listed in theme.json, claimed by no preset. */
  readonly unclaimed: readonly PreviewFile[]
  /** In assets/previews/, not listed in theme.json: packed, never shown. */
  readonly unlisted: readonly PreviewFile[]
}

function previewFile(files: Files, path: string, screen: string | null): PreviewFile {
  return { path, bytes: files.get(path)?.length ?? 0, screen }
}

/** The previews per preset, the unclaimed and the unlisted, from the package's theme.json and files. */
export function previewsReport(manifest: Manifest, files: Files): PreviewsReport {
  const entry = previewsCheck(manifest, files)
  const listed = new Set([...entry.presets.flatMap((preset) => preset.previews.map((item) => item.path)), ...entry.otherPreviews])
  const unlisted = Array.from(files.keys()).filter((path) => path.startsWith(PREVIEW_DIR) && !listed.has(path)).sort()
  return {
    cover: entry.cover,
    presets: entry.presets.map((preset) => ({
      id: preset.id,
      default: preset.default,
      previews: preset.previews.map((item) => previewFile(files, item.path, item.screen)),
    })),
    unclaimed: entry.otherPreviews.map((path) => previewFile(files, path, null)),
    unlisted: unlisted.map((path) => previewFile(files, path, null)),
  }
}

function fileText(file: PreviewFile): string {
  return `${file.path}, ${file.bytes} bytes${file.screen === null ? '' : `, screen ${file.screen}`}`
}

const plural = (count: number): string => `${count} preview${count === 1 ? '' : 's'}`

/** A preset's item and, under it, one line per preview it claims. */
function presetLines(preset: PresetPreviewFiles): string[] {
  const name = preset.default ? `${preset.id} (default look)` : preset.id
  if (preset.previews.length === 0) return [`- ${name}: no preview`]
  return [`- ${name}: ${plural(preset.previews.length)}`, ...preset.previews.map((file) => `    ${fileText(file)}`)]
}

/** The previews' lines: what the listing shows, then each preset with its files, each unclaimed preview and unlisted file. */
export function previewsLines(report: PreviewsReport): string[] {
  const listed = report.presets.reduce((sum, preset) => sum + preset.previews.length, 0) + report.unclaimed.length
  const head = report.cover === null
    ? 'Previews: theme.json lists none, so the Marketplace listing shows none.'
    : `Previews: ${plural(listed)} listed; the listing's cover is ${report.cover}, the first theme.json lists.`
  const items = [
    ...report.presets.flatMap(presetLines),
    ...report.unclaimed.map((file) => `- claimed by no preset (the listing shows it apart): ${fileText(file)}`),
    ...report.unlisted.map((file) => `- not listed in theme.json (packed, never shown): ${fileText(file)}`),
  ]
  return [head, ...items.map((item) => `  ${item}`)]
}
