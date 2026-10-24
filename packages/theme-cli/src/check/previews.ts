/**
 * The `previews` check: each preview theme.json lists, by the preset its Marketplace listing shows it under.
 *
 * Core's reader has already held every listed preview to its rules (a PNG of at most 512 KB in
 * assets/previews/, at most 16, each in the package, none named twice). This is the listing's rule, core's
 * orchestrator/services/themes/listings.py `previews_by_preset`, `_owner_preset` and `_preview_paths` at the
 * commit report.ts's CORE_SHA names: a file stem `<preset>` or `<preset>-<screen>` belongs to that preset,
 * the longest preset id first. A preview no preset claims is listed apart from every preset, which
 * is a warning; a theme with no previews passes, and its listing shows none. The previews keep
 * theme.json's order, never re-sorted by name: the theme picks it, and the listing card's cover is the
 * first one it lists.
 */
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
  /** The listing card's cover: the first preview theme.json lists (claimed or not), or null with none. */
  readonly cover: string | null
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

/** listings.py `_preview_paths`: the previews theme.json lists that are in the package, in theme.json's order. */
function previewPaths(manifest: Manifest, files: Files): string[] {
  const listed = Array.isArray(manifest.previews) ? (manifest.previews as unknown[]) : []
  return listed.filter((path): path is string => typeof path === 'string' && files.has(path))
}

function stemOf(path: string): string {
  return path.slice(PREVIEW_DIR.length, path.length - PREVIEW_SUFFIX.length)
}

function reasonOf(paths: readonly string[], other: number): string {
  if (paths.length === 0) return NO_PREVIEWS
  if (other > 0) return UNCLAIMED.replace('{count}', String(other))
  return `${paths.length} preview(s), each under the preset its name gives; the cover is ${paths[0]}, the first theme.json lists.`
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
    cover: paths[0] ?? null,
    reason: reasonOf(paths, other.length),
  }
}

/** The `previews` line: its reason, and each preview no preset claims. */
export function describePreviews(entry: PreviewsEntry): CheckText {
  return { text: entry.reason, items: entry.otherPreviews.map((path) => `belongs to no preset: ${path}`) }
}
