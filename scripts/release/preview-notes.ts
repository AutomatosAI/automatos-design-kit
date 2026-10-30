/**
 * The release notes' previews (theme-release.yml's "Publish the release", theme-publish.yml's "Write the release
 * notes"): each picture the theme's theme.json lists under `previews`, as a Markdown image of that file at the
 * release's tag, so the release page shows the theme; then each phone screenshot it lists under `phonePreviews`, as
 * an image at a phone's width, side by side. The images are the tagged commit's own files, which GitHub
 * serves from the repository at the tag, so the page shows the pictures released with the package. A theme that
 * lists none adds nothing.
 *
 *   node scripts/release/preview-notes.ts <theme folder> <tag> <owner/repo>
 *
 * Prints the Markdown, or nothing for a theme with no previews. Exit 0; 1 when theme.json can't be read, a preview
 * isn't a picture under assets/previews/ or a phone screenshot isn't a PNG or a JPEG under assets/previews/phone/ (the
 * release then fails rather than publish a broken page); 2 for a usage error. Standard library only.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PREVIEWS_HEADING = '### Previews'
export const PHONE_PREVIEWS_HEADING = '### Phone screenshots'
/** How wide the release page draws a phone screenshot, in pixels: a phone's size, beside one another. */
export const PHONE_IMAGE_WIDTH = 240
export const EXIT_OK = 0
export const EXIT_FAILED = 1
export const EXIT_USAGE = 2
const USAGE = 'Usage: node scripts/release/preview-notes.ts <theme folder> <tag> <owner/repo>'
const THEME_FILE = 'theme.json'
/** A preview as the contract allows it: a picture under assets/previews/, a plain file name. */
const PREVIEW_PATH = /^assets\/previews\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/
/** A phone screenshot as the contract allows it: a PNG or a JPEG under assets/previews/phone/, a plain file name. */
const PHONE_PREVIEW_PATH = /^assets\/previews\/phone\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpg)$/
const PREVIEWS_FIELD = 'previews'
const PHONE_PREVIEWS_FIELD = 'phonePreviews'
/** The theme folder as the workflow names it ($THEMES_DIR/<theme>): relative, plain names, no `..`. */
const THEME_DIR = /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/
/** The release tags: <slug>-v<major>.<minor>.<patch> (scripts/release/themes.mjs TAG_PATTERN). */
const TAG = /^[a-z0-9-]+-v\d+\.\d+\.\d+$/
const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/
const PICTURE_EXTENSION = /\.(?:png|jpe?g|webp)$/

export interface PreviewIo {
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

const PROCESS_IO: PreviewIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
}

export type PreviewPaths = { readonly ok: true; readonly paths: readonly string[] } | { readonly ok: false; readonly error: string }

/** theme.json's list `field` as paths, each one `pattern` takes, or why they can't be shown: left out is none. */
function listedPaths(value: unknown, field: string, pattern: RegExp, shape: string): PreviewPaths {
  if (value === undefined) return { ok: true, paths: [] }
  if (!Array.isArray(value)) return { ok: false, error: `theme.json ${field} is not a list.` }
  const bad = value.filter((path) => typeof path !== 'string' || !pattern.test(path))
  if (bad.length > 0) {
    const shown = bad.map((path) => JSON.stringify(path)).join(', ')
    return { ok: false, error: `theme.json ${field} holds ${shown}: each is ${shape}.` }
  }
  return { ok: true, paths: value as string[] }
}

/** theme.json's `previews` as paths, or why they can't be shown: left out is none. */
export function previewPaths(previews: unknown): PreviewPaths {
  return listedPaths(previews, PREVIEWS_FIELD, PREVIEW_PATH, 'a picture under assets/previews/')
}

/** theme.json's `phonePreviews` as paths, or why they can't be shown: left out is none. */
export function phonePreviewPaths(phonePreviews: unknown): PreviewPaths {
  return listedPaths(phonePreviews, PHONE_PREVIEWS_FIELD, PHONE_PREVIEW_PATH, 'a PNG or a JPEG under assets/previews/phone/')
}

export interface NotesInput {
  readonly themeDir: string
  readonly paths: readonly string[]
  /** The phone screenshots, after the web previews; none when left out. */
  readonly phonePaths?: readonly string[]
  readonly tag: string
  readonly repo: string
}

/**
 * The Markdown for the release notes, '' for no pictures: a heading and one image per preview, in theme.json's order;
 * then a heading and the phone screenshots on one line, each an image a phone's width, in theme.json's order. A file
 * name is letters, digits, ".", "_" and "-" (the path rules above), so it goes into the HTML as it is.
 */
export function previewNotes({ themeDir, paths, phonePaths = [], tag, repo }: NotesInput): string {
  const base = `https://github.com/${repo}/raw/${tag}/${themeDir}`
  const web = paths.length === 0 ? [] : [PREVIEWS_HEADING, '', ...paths.map((path) => `![${altOf(path)}](${base}/${path})`)]
  const phoneImages = phonePaths.map((path) => `<img src="${base}/${path}" alt="${altOf(path)}" width="${PHONE_IMAGE_WIDTH}">`)
  const phone = phonePaths.length === 0 ? [] : [PHONE_PREVIEWS_HEADING, '', phoneImages.join(' ')]
  return [...web, ...(web.length > 0 && phone.length > 0 ? [''] : []), ...phone].join('\n')
}

/** A preview's alt text: its file name without the extension. */
function altOf(path: string): string {
  return (path.split('/').at(-1) ?? path).replace(PICTURE_EXTENSION, '')
}

type Lists = { readonly previews: unknown; readonly phonePreviews: unknown }
type Read = { readonly ok: true; readonly value: Lists } | { readonly ok: false; readonly error: string }

/** theme.json's `previews` and `phonePreviews` fields, read from the theme folder. */
function readPreviews(themeDir: string, cwd: string): Read {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(cwd, themeDir, THEME_FILE), 'utf8'))
    const isObject = typeof manifest === 'object' && manifest !== null && !Array.isArray(manifest)
    const fields = isObject ? (manifest as Record<string, unknown>) : {}
    return { ok: true, value: { previews: fields[PREVIEWS_FIELD], phonePreviews: fields[PHONE_PREVIEWS_FIELD] } }
  } catch (error) {
    return { ok: false, error: `${themeDir}/${THEME_FILE} can't be read: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function failedWith(io: PreviewIo, error: string): number {
  io.err(error)
  return EXIT_FAILED
}

/** The command: reads the theme's theme.json from `cwd`, prints the notes' previews, answers the exit code. */
export function runPreviewNotes(args: readonly string[], io: PreviewIo = PROCESS_IO, cwd: string = process.cwd()): number {
  const [themeDir, tag, repo] = args
  if (args.length !== 3 || !THEME_DIR.test(themeDir) || !TAG.test(tag) || !REPO.test(repo)) {
    io.err(USAGE)
    return EXIT_USAGE
  }
  const read = readPreviews(themeDir, cwd)
  const paths = read.ok ? previewPaths(read.value.previews) : read
  const phonePaths = read.ok ? phonePreviewPaths(read.value.phonePreviews) : read
  if (!paths.ok) return failedWith(io, paths.error)
  if (!phonePaths.ok) return failedWith(io, phonePaths.error)
  const notes = previewNotes({ themeDir, paths: paths.paths, phonePaths: phonePaths.paths, tag, repo })
  if (notes !== '') io.out(notes)
  return EXIT_OK
}

const invokedAs = process.argv[1] === undefined ? '' : resolve(process.argv[1])
if (invokedAs === fileURLToPath(import.meta.url)) process.exitCode = runPreviewNotes(process.argv.slice(2))
