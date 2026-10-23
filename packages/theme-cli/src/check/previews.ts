/**
 * The `previews` check: each preview theme.json lists, by the preset its Marketplace listing shows it under.
 *
 * Core's reader has already held every listed preview to its rules (a PNG of at most 512 KB in
 * assets/previews/, at most 16, each in the package). This is the listing's rule, core's
 * orchestrator/services/themes/listings.py `previews_by_preset` and `_owner_preset` at the commit
 * report.ts's CORE_SHA names: a file stem `<preset>` or `<preset>-<screen>` belongs to that preset,
 * the longest preset id first. A preview no preset claims is listed apart from every preset, which
 * is a warning; a theme with no previews passes, and its listing shows none.
 */
import { byText } from '../collect.ts'
import { presetList, LEVEL_PASS, LEVEL_WARNING, type CheckEntry, type CheckText, type Files, type Manifest } from './report.ts'

export const PREVIEW_DIR = 'assets/previews/'
export const PREVIEW_SUFFIX = '.png'
const SCREEN_SEPARATOR = '-'

export const NO_PREVIEWS = 'theme.json lists no previews, so the Marketplace listing shows none.'
export const UNCLAIMED = (
  '{count} preview(s) belong to no preset (a preview is named <preset>.png or <preset>-<screen>.png), '
  + 'so the listing shows them apart from every preset.'
)

export interface PresetPreviews {
  readonly id: string
  readonly default: boolean
  readonly previews: ReadonlyArray<{ readonly screen: string | null; readonly path: string }>
}

export interface PreviewsEntry extends CheckEntry {
  readonly status: 'none' | 'checked'
  readonly presets: readonly PresetPreviews[]
  readonly otherPreviews: readonly string[]
  readonly reason: string
}

/** listings.py `_owner_preset`: the preset and screen a preview's file stem belongs to, the longest id first. */
export function ownerPreset(stem: string, presets: readonly string[]): { preset: string; screen: string | null } | null {
  const longestFirst = [...presets].sort((a, b) => b.length - a.length)
  for (const preset of longestFirst) {
    if (stem === preset) return { preset, screen: null }
    if (stem.startsWith(`${preset}${SCREEN_SEPARATOR}`)) return { preset, screen: stem.slice(preset.length + SCREEN_SEPARATOR.length) }
  }
  return null
}

/** listings.py `_preview_paths`: the previews theme.json lists that are in the package, in order. */
function previewPaths(manifest: Manifest, files: Files): string[] {
  const listed = Array.isArray(manifest.previews) ? (manifest.previews as unknown[]) : []
  return listed.filter((path): path is string => typeof path === 'string' && files.has(path)).sort(byText)
}

function stemOf(path: string): string {
  return path.slice(PREVIEW_DIR.length, path.length - PREVIEW_SUFFIX.length)
}

function reasonOf(listed: number, other: number): string {
  if (listed === 0) return NO_PREVIEWS
  if (other > 0) return UNCLAIMED.replace('{count}', String(other))
  return `${listed} preview(s), each under the preset its name gives.`
}

/** The `previews` entry: listings.py `previews_by_preset` over the package's paths. */
export function previewsCheck(manifest: Manifest, files: Files): PreviewsEntry {
  const presets = presetList(files)
  const paths = previewPaths(manifest, files)
  const claimed = new Map(presets.map((id): [string, Array<{ screen: string | null; path: string }>] => [id, []]))
  const other: string[] = []
  paths.forEach((path) => {
    const owner = ownerPreset(stemOf(path), presets)
    if (owner === null) other.push(path)
    else claimed.get(owner.preset)?.push({ screen: owner.screen, path })
  })
  return {
    level: other.length > 0 ? LEVEL_WARNING : LEVEL_PASS,
    status: paths.length === 0 ? 'none' : 'checked',
    presets: presets.map((id) => ({ id, default: id === manifest.look, previews: claimed.get(id) ?? [] })),
    otherPreviews: other,
    reason: reasonOf(paths.length, other.length),
  }
}

/** The `previews` line: its reason, and each preview no preset claims. */
export function describePreviews(entry: PreviewsEntry): CheckText {
  return { text: entry.reason, items: entry.otherPreviews.map((path) => `belongs to no preset: ${path}`) }
}
