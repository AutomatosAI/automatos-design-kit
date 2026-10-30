/**
 * The release notes' previews (theme-release.yml's "Publish the release", theme-publish.yml's "Write the release
 * notes"): each picture the theme's theme.json lists under `previews`, as a Markdown image of that file at the
 * release's tag, so the release page shows the theme. The images are the tagged commit's own files, which GitHub
 * serves from the repository at the tag, so the page shows the pictures released with the package. A theme that
 * lists none adds nothing.
 *
 *   node scripts/release/preview-notes.ts <theme folder> <tag> <owner/repo>
 *
 * Prints the Markdown, or nothing for a theme with no previews. Exit 0; 1 when theme.json can't be read or a preview
 * isn't a picture under assets/previews/ (the release then fails rather than publish a broken page); 2 for a usage
 * error. Standard library only.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PREVIEWS_HEADING = '### Previews'
export const EXIT_OK = 0
export const EXIT_FAILED = 1
export const EXIT_USAGE = 2
const USAGE = 'Usage: node scripts/release/preview-notes.ts <theme folder> <tag> <owner/repo>'
const THEME_FILE = 'theme.json'
/** A preview as the contract allows it: a picture under assets/previews/, a plain file name. */
const PREVIEW_PATH = /^assets\/previews\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/
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

/** theme.json's `previews` as paths, or why they can't be shown: left out is none. */
export function previewPaths(previews: unknown): PreviewPaths {
  if (previews === undefined) return { ok: true, paths: [] }
  if (!Array.isArray(previews)) return { ok: false, error: 'theme.json previews is not a list.' }
  const bad = previews.filter((path) => typeof path !== 'string' || !PREVIEW_PATH.test(path))
  if (bad.length > 0) {
    const shown = bad.map((path) => JSON.stringify(path)).join(', ')
    return { ok: false, error: `theme.json previews holds ${shown}: each is a picture under assets/previews/.` }
  }
  return { ok: true, paths: previews as string[] }
}

export interface NotesInput {
  readonly themeDir: string
  readonly paths: readonly string[]
  readonly tag: string
  readonly repo: string
}

/** The Markdown for the release notes: a heading and one image per preview, in theme.json's order; '' for none. */
export function previewNotes({ themeDir, paths, tag, repo }: NotesInput): string {
  if (paths.length === 0) return ''
  const base = `https://github.com/${repo}/raw/${tag}/${themeDir}`
  const images = paths.map((path) => `![${altOf(path)}](${base}/${path})`)
  return [PREVIEWS_HEADING, '', ...images].join('\n')
}

/** A preview's alt text: its file name without the extension. */
function altOf(path: string): string {
  return (path.split('/').at(-1) ?? path).replace(PICTURE_EXTENSION, '')
}

type Read = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }

/** theme.json's `previews` field, read from the theme folder. */
function readPreviews(themeDir: string, cwd: string): Read {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(cwd, themeDir, THEME_FILE), 'utf8'))
    const isObject = typeof manifest === 'object' && manifest !== null && !Array.isArray(manifest)
    return { ok: true, value: isObject ? (manifest as Record<string, unknown>).previews : undefined }
  } catch (error) {
    return { ok: false, error: `${themeDir}/${THEME_FILE} can't be read: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** The command: reads the theme's theme.json from `cwd`, prints the notes' previews, answers the exit code. */
export function runPreviewNotes(args: readonly string[], io: PreviewIo = PROCESS_IO, cwd: string = process.cwd()): number {
  const [themeDir, tag, repo] = args
  if (args.length !== 3 || !THEME_DIR.test(themeDir) || !TAG.test(tag) || !REPO.test(repo)) {
    io.err(USAGE)
    return EXIT_USAGE
  }
  const read = readPreviews(themeDir, cwd)
  const paths = read.ok ? previewPaths(read.value) : read
  if (!paths.ok) {
    io.err(paths.error)
    return EXIT_FAILED
  }
  const notes = previewNotes({ themeDir, paths: paths.paths, tag, repo })
  if (notes !== '') io.out(notes)
  return EXIT_OK
}

const invokedAs = process.argv[1] === undefined ? '' : resolve(process.argv[1])
if (invokedAs === fileURLToPath(import.meta.url)) process.exitCode = runPreviewNotes(process.argv.slice(2))
