/**
 * The `previews` check: each screenshot theme.json lists, by the preset its Marketplace listing shows it under.
 *
 * theme.json lists two kinds: `previews`, the web's (assets/previews/<NAME>.png), and `phonePreviews`, Automatos Go's
 * (assets/previews/phone/<NAME>.png or .jpg). Core's reader has already held every listed screenshot to its rules (a
 * PNG, or for the phone a PNG or a JPEG, of at most 512 KB in its folder, at most 24 in each list, each in the
 * package, none named twice). This is the listing's rule, core's orchestrator/services/themes/listings.py
 * `previews_by_preset`, `_claimed`, `_stem`, `_owner_preset` and `_preview_paths` at the commit report.ts's CORE_SHA
 * names, one rule for both kinds: a file stem (its name without the folder and the extension) `<preset>` or
 * `<preset>-<screen>` belongs to that preset, the longest preset id first. A screenshot no preset claims is listed
 * apart from every preset, which is a warning; a theme with no screenshots passes, and its listing shows none. Each
 * list keeps theme.json's order, never re-sorted by name: the theme picks it, and the listing card's cover (and its
 * phone cover) is the first one it lists.
 */
import { PHONE_PREVIEWS_FIELD, PREVIEWS_FIELD } from '../check-package.ts'
import { presetList, LEVEL_PASS, LEVEL_WARNING, type CheckEntry, type CheckText, type Files, type Manifest } from './report.ts'

export const PREVIEW_DIR = 'assets/previews/'
export const PREVIEW_SUFFIX = '.png'
/** Where a phone screenshot lives (package.py's phone-preview kinds; listings.py `PHONE_PREVIEWS`). */
export const PHONE_PREVIEW_DIR = 'assets/previews/phone/'
const SCREEN_SEPARATOR = '-'
const EXTENSION_SEPARATOR = '.'

export const NO_PREVIEWS = 'theme.json lists no previews, so the Marketplace listing shows none.'
export const UNCLAIMED = (
  '{count} preview(s) belong to no preset (a preview is named <preset>.png or <preset>-<screen>.png), '
  + 'so the listing shows them apart from every preset.'
)
export const NO_WEB_PREVIEWS = 'theme.json lists no web previews, so the listing card has no cover.'
export const PHONE_UNCLAIMED = (
  '{count} phone screenshot(s) belong to no preset (a phone screenshot is named <preset> or <preset>-<screen>, '
  + '.png or .jpg), so the listing shows them apart from every preset.'
)

export interface ClaimedPreview {
  readonly screen: string | null
  readonly path: string
}

export interface PresetPreviews {
  readonly id: string
  readonly default: boolean
  readonly previews: readonly ClaimedPreview[]
  /** Its phone screenshots, by the same rule; none for a theme that lists no `phonePreviews`. */
  readonly phonePreviews: readonly ClaimedPreview[]
}

export interface PreviewsEntry extends CheckEntry {
  readonly status: 'none' | 'checked'
  readonly presets: readonly PresetPreviews[]
  readonly otherPreviews: readonly string[]
  /** The phone screenshots no preset claims. */
  readonly otherPhonePreviews: readonly string[]
  /** The listing card's cover: the first preview theme.json lists (claimed or not), or null with none. */
  readonly cover: string | null
  /** The listing card's phone cover: the first phone screenshot theme.json lists, or null with none. */
  readonly phoneCover: string | null
  readonly reason: string
}

/** One theme.json list of screenshots: its field and its folder (listings.py `PreviewKind`). */
interface PreviewKind {
  readonly field: string
  readonly folder: string
}

const WEB: PreviewKind = { field: PREVIEWS_FIELD, folder: PREVIEW_DIR }
const PHONE: PreviewKind = { field: PHONE_PREVIEWS_FIELD, folder: PHONE_PREVIEW_DIR }

/** One list claimed: each preset's screenshots, and the ones no preset claims, in theme.json's order. */
interface Claimed {
  readonly paths: readonly string[]
  readonly byPreset: ReadonlyMap<string, readonly ClaimedPreview[]>
  readonly other: readonly string[]
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

/** listings.py `_stem`: a screenshot's file name without its folder and extension. */
export function previewStem(path: string, folder: string): string {
  const name = path.slice(folder.length)
  const dot = name.lastIndexOf(EXTENSION_SEPARATOR)
  return dot < 0 ? name : name.slice(0, dot)
}

/** listings.py `_preview_paths`: the screenshots theme.json lists under `field` that are in the package, in its order. */
function previewPaths(manifest: Manifest, files: Files, field: string): string[] {
  const listed = Array.isArray(manifest[field]) ? (manifest[field] as unknown[]) : []
  return listed.filter((path): path is string => typeof path === 'string' && files.has(path))
}

/** listings.py `_claimed`: one list's screenshots under the presets their stems give, and the rest. */
function claimedOf(manifest: Manifest, files: Files, presets: readonly string[], kind: PreviewKind): Claimed {
  const paths = previewPaths(manifest, files, kind.field)
  const owned = paths.map((path) => ({ path, owner: ownerPreset(previewStem(path, kind.folder), presets) }))
  const byPreset = new Map(presets.map((id): [string, ClaimedPreview[]] => [
    id, owned.flatMap(({ path, owner }) => (owner !== null && owner.preset === id ? [{ screen: owner.screen, path }] : [])),
  ]))
  return { paths, byPreset, other: owned.filter(({ owner }) => owner === null).map(({ path }) => path) }
}

function webReason(web: Claimed): string {
  if (web.paths.length === 0) return NO_WEB_PREVIEWS
  if (web.other.length > 0) return UNCLAIMED.replace('{count}', String(web.other.length))
  return `${web.paths.length} preview(s), each under the preset its name gives; the cover is ${web.paths[0]}, the first theme.json lists.`
}

function phoneReason(phone: Claimed): string | null {
  if (phone.paths.length === 0) return null
  if (phone.other.length > 0) return PHONE_UNCLAIMED.replace('{count}', String(phone.other.length))
  return `${phone.paths.length} phone screenshot(s), each under the preset its name gives; the phone cover is `
    + `${phone.paths[0]}, the first theme.json lists.`
}

function reasonOf(web: Claimed, phone: Claimed): string {
  if (web.paths.length === 0 && phone.paths.length === 0) return NO_PREVIEWS
  return [webReason(web), phoneReason(phone)].filter((part): part is string => part !== null).join(' ')
}

/** The `previews` entry: listings.py `previews_by_preset` over the package's paths, web and phone. */
export function previewsCheck(manifest: Manifest, files: Files): PreviewsEntry {
  const presets = presetList(files)
  const web = claimedOf(manifest, files, presets, WEB)
  const phone = claimedOf(manifest, files, presets, PHONE)
  const unclaimed = web.other.length + phone.other.length
  return {
    level: unclaimed > 0 ? LEVEL_WARNING : LEVEL_PASS,
    status: web.paths.length + phone.paths.length === 0 ? 'none' : 'checked',
    presets: presets.map((id) => ({
      id, default: id === manifest.look, previews: web.byPreset.get(id) ?? [], phonePreviews: phone.byPreset.get(id) ?? [],
    })),
    otherPreviews: web.other,
    otherPhonePreviews: phone.other,
    cover: web.paths[0] ?? null,
    phoneCover: phone.paths[0] ?? null,
    reason: reasonOf(web, phone),
  }
}

/** The `previews` line: its reason, and each screenshot no preset claims. */
export function describePreviews(entry: PreviewsEntry): CheckText {
  const unclaimed = [...entry.otherPreviews, ...entry.otherPhonePreviews]
  return { text: entry.reason, items: unclaimed.map((path) => `belongs to no preset: ${path}`) }
}
