/**
 * The previews of the review's "Previews and accessibility" section (PRD-261 B-02j, report.ts): report only, never a
 * check, so the review's outcome never counts them (review.ts).
 *
 * Each preset's previews as the Marketplace listing claims them, by theme-cli's check/previews.ts (the port of core's
 * listings.py `previews_by_preset`: a file stem `<preset>` or `<preset>-<screen>` belongs to that preset, the longest
 * preset id first), with each file's size in bytes; a preset with none says so. Then the previews theme.json lists that
 * no preset claims (the listing shows them apart from every preset), and the files in assets/previews/ theme.json
 * doesn't list (packed, never shown). The phone screenshots theme.json lists under `phonePreviews`
 * (assets/previews/phone/) are reported the same way after them, by the same rule, when the package holds any.
 * Core's reader has already held every listed screenshot to its rules (a PNG, or for the phone a PNG or a JPEG, of at
 * most 512 KB in its folder, at most 24 in each list, each in the package), so nothing here refuses one.
 */
import {
  PHONE_PREVIEW_DIR, PREVIEW_DIR, previewsCheck, type ClaimedPreview, type PresetPreviews, type PreviewsEntry,
} from '../../packages/theme-cli/src/check/previews.ts'
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
  /** In the list's folder, not listed in theme.json: packed, never shown. */
  readonly unlisted: readonly PreviewFile[]
}

/** One list's part of the check's entry: the web's or the phone's. */
interface ListPart {
  readonly folder: string
  readonly cover: string | null
  readonly perPreset: (preset: PresetPreviews) => readonly ClaimedPreview[]
  readonly other: readonly string[]
}

function previewFile(files: Files, path: string, screen: string | null): PreviewFile {
  return { path, bytes: files.get(path)?.length ?? 0, screen }
}

/** True for a file right in `folder`, not in a folder below it (the phone's screenshots are not web previews). */
function directlyIn(path: string, folder: string): boolean {
  return path.startsWith(folder) && !path.slice(folder.length).includes('/')
}

/** One list's previews per preset, the unclaimed and the unlisted, from the check's entry. */
function listReport(entry: PreviewsEntry, files: Files, part: ListPart): PreviewsReport {
  const listed = new Set([...entry.presets.flatMap((preset) => part.perPreset(preset).map((item) => item.path)), ...part.other])
  const unlisted = Array.from(files.keys()).filter((path) => directlyIn(path, part.folder) && !listed.has(path)).sort()
  return {
    cover: part.cover,
    presets: entry.presets.map((preset) => ({
      id: preset.id,
      default: preset.default,
      previews: part.perPreset(preset).map((item) => previewFile(files, item.path, item.screen)),
    })),
    unclaimed: part.other.map((path) => previewFile(files, path, null)),
    unlisted: unlisted.map((path) => previewFile(files, path, null)),
  }
}

/** The web previews per preset, the unclaimed and the unlisted, from the package's theme.json and files. */
export function previewsReport(manifest: Manifest, files: Files): PreviewsReport {
  const entry = previewsCheck(manifest, files)
  return listReport(entry, files, { folder: PREVIEW_DIR, cover: entry.cover, perPreset: (preset) => preset.previews, other: entry.otherPreviews })
}

/** The phone screenshots per preset, the unclaimed and the unlisted, the same way. */
export function phonePreviewsReport(manifest: Manifest, files: Files): PreviewsReport {
  const entry = previewsCheck(manifest, files)
  return listReport(entry, files, {
    folder: PHONE_PREVIEW_DIR, cover: entry.phoneCover, perPreset: (preset) => preset.phonePreviews, other: entry.otherPhonePreviews,
  })
}

function fileText(file: PreviewFile): string {
  return `${file.path}, ${file.bytes} bytes${file.screen === null ? '' : `, screen ${file.screen}`}`
}

/** The words one list's lines use: its name and noun, and what the listing calls its first. */
interface ListWords {
  readonly title: string
  readonly noun: string
  readonly cover: string
  readonly none: string
}

const WEB_WORDS: ListWords = {
  title: 'Previews', noun: 'preview', cover: "the listing's cover", none: 'theme.json lists none, so the Marketplace listing shows none.',
}
const PHONE_WORDS: ListWords = {
  title: 'Phone screenshots', noun: 'phone screenshot', cover: "the listing's phone cover",
  none: 'theme.json lists none, so the Marketplace listing shows no phone.',
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/** A preset's item and, under it, one line per screenshot it claims. */
function presetLines(preset: PresetPreviewFiles, words: ListWords): string[] {
  const name = preset.default ? `${preset.id} (default look)` : preset.id
  if (preset.previews.length === 0) return [`- ${name}: no ${words.noun}`]
  return [`- ${name}: ${plural(preset.previews.length, words.noun)}`, ...preset.previews.map((file) => `    ${fileText(file)}`)]
}

/** One list's lines: what the listing shows, then each preset with its files, each unclaimed and unlisted file. */
function listLines(report: PreviewsReport, words: ListWords): string[] {
  const listed = report.presets.reduce((sum, preset) => sum + preset.previews.length, 0) + report.unclaimed.length
  const head = report.cover === null
    ? `${words.title}: ${words.none}`
    : `${words.title}: ${plural(listed, words.noun)} listed; ${words.cover} is ${report.cover}, the first theme.json lists.`
  const items = [
    ...report.presets.flatMap((preset) => presetLines(preset, words)),
    ...report.unclaimed.map((file) => `- claimed by no preset (the listing shows it apart): ${fileText(file)}`),
    ...report.unlisted.map((file) => `- not listed in theme.json (packed, never shown): ${fileText(file)}`),
  ]
  return [head, ...items.map((item) => `  ${item}`)]
}

/** The previews' lines: what the listing shows, then each preset with its files, each unclaimed preview and unlisted file. */
export function previewsLines(report: PreviewsReport): string[] {
  return listLines(report, WEB_WORDS)
}

/** The phone screenshots' lines, the same way; none for a package that holds no phone screenshot. */
export function phonePreviewsLines(report: PreviewsReport): string[] {
  if (report.cover === null && report.unclaimed.length === 0 && report.unlisted.length === 0) return []
  return listLines(report, PHONE_WORDS)
}
