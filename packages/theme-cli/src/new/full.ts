/**
 * `new --template full` (PRD-261 B-03f, QB-39 = generated): Play de-branded, made from themes/play itself each time,
 * so the template never drifts from Play and never needs a copy of its own.
 *
 * In order, on Play's own files (template.json's `copy`, read from the kit, which this command never writes to):
 * 1. the template's `code`, in Play's own words;
 * 2. `--mascot none` (no-mascot.ts), when asked, over Play's files and that code, so the code's own imports of the
 *    mascot package point at the theme's copies too;
 * 3. the template's `patches`;
 * 4. the renames (rename.ts), over every path and every text, refused when two of Play's names or paths would merge;
 * 5. theme.json and package.json made the new theme's: its id, name, first version and class, no previews and no
 *    phone screenshots (they are Play's pictures, and `copy` takes none of assets/previews/), the template's pages and
 *    SDK areas added, a build with no look compiler (the look data is the theme's own from now on);
 * 6. Play's look data as Play's build writes it (look-data.ts), renamed;
 * 7. the template's `files` (the README, the CHANGELOG, the clips' NOTICE), their placeholders filled.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { byText } from '../collect.ts'
import { readFullTemplate, type FullTemplate, type Patch } from './full-spec.ts'
import { playLookFiles } from './look-data.ts'
import { manifestWithoutMascot, withoutMascot } from './no-mascot.ts'
import { filledFile, isTextFile, placeholderValues, readFolder, type FolderFile, type ThemeNames } from './placeholders.ts'
import { pathCollisions, renameCollisions, renamer, type Renamer } from './rename.ts'

export const FULL_TEMPLATE_DIR = 'templates/full'
const MANIFEST = 'theme.json'
const PACKAGE_JSON = 'package.json'
/** A new theme's first version. */
export const FIRST_VERSION = '0.1.0'
/** The build and pack of a theme whose look data is its own (skills/build-automatos-theme's theme folder). */
const SCRIPTS = Object.freeze({ build: 'vite build', pack: 'automatos-theme check design . && automatos-theme pack . --out out' })
const JSON_INDENT = 2

export interface FullOptions {
  readonly names: ThemeNames
  /** False for `--mascot none`. */
  readonly mascot: boolean
  readonly kitRoot: string
}

export type FullResult =
  | { readonly ok: true; readonly files: readonly FolderFile[] }
  | { readonly ok: false; readonly problems: readonly string[] }

type Json = Record<string, unknown>

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const textOf = (file: FolderFile): string => decoder.decode(file.data)
const withText = (file: FolderFile, text: string): FolderFile => ({ path: file.path, data: encoder.encode(text) })
const jsonFile = (path: string, value: unknown): FolderFile => ({ path, data: encoder.encode(`${JSON.stringify(value, null, JSON_INDENT)}\n`) })

/** Play's files the template takes: each `copy` path, a folder whole. */
function playFiles(playDir: string, copy: readonly string[]): Map<string, FolderFile> {
  const files = copy.flatMap((path): FolderFile[] => {
    try {
      return readFolder(join(playDir, path)).map((file) => ({ path: `${path}/${file.path}`, data: file.data }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOTDIR') throw error
      return [{ path, data: new Uint8Array(readFileSync(join(playDir, path))) }]
    }
  })
  return new Map(files.map((file): [string, FolderFile] => [file.path, file]))
}

/** `files` with `patch` applied: its text inserted after the one place its `after` text stands. */
function patched(files: Map<string, FolderFile>, patch: Patch): Map<string, FolderFile> {
  const file = files.get(patch.path)
  const text = file === undefined ? '' : textOf(file)
  const at = text.indexOf(patch.after)
  if (file === undefined || at < 0 || text.indexOf(patch.after, at + 1) >= 0) {
    throw new Error(`templates/full's patch of ${patch.path} needs its text there exactly once: Play has changed, so change the patch.`)
  }
  const end = at + patch.after.length
  const entry: [string, FolderFile] = [patch.path, withText(file, `${text.slice(0, end)}${patch.insert}${text.slice(end)}`)]
  return new Map([...files, entry])
}

/** Play's files with the template's code, the mascot left out when asked, and the template's patches. */
function sourceFiles(template: FullTemplate, options: FullOptions, templateDir: string): Map<string, FolderFile> {
  const play = playFiles(join(options.kitRoot, template.from), template.copy)
  const code = readFolder(join(templateDir, template.code))
  const added = new Map([...play, ...code.map((file): [string, FolderFile] => [file.path, file])])
  const base = options.mascot ? added : withoutMascot(added, template.noMascot, options.kitRoot, templateDir)
  return template.patches.reduce(patched, base)
}

function renamed(file: FolderFile, rename: Renamer): FolderFile {
  const path = rename.text(file.path)
  return isTextFile(file.path) ? { path, data: encoder.encode(rename.text(textOf(file))) } : { path, data: file.data }
}

/** theme.json's lists of Play's own pictures: its web previews and its phone screenshots. */
export const PLAY_PICTURE_FIELDS: readonly string[] = Object.freeze(['previews', 'phonePreviews'])

/** Play's theme.json without the lists of its own pictures, which the new theme doesn't hold. */
export function withoutPictures(manifest: Readonly<Json>): Json {
  return Object.fromEntries(Object.entries(manifest).filter(([field]) => !PLAY_PICTURE_FIELDS.includes(field)))
}

/** theme.json made the new theme's. */
function themeManifest(file: FolderFile, template: FullTemplate, options: FullOptions): FolderFile {
  const play = withoutPictures(JSON.parse(textOf(file)) as Json)
  const base = options.mascot ? play : manifestWithoutMascot(play)
  const uses = Array.isArray(base.uses) ? (base.uses as string[]) : []
  return jsonFile(MANIFEST, {
    ...base,
    id: options.names.id,
    name: options.names.name,
    version: FIRST_VERSION,
    ...(options.mascot ? {} : { description: DESCRIPTION_LEFT_OUT }),
    htmlClass: options.names.htmlClass,
    pages: { ...(base.pages as Json | undefined), ...template.pages },
    uses: Array.from(new Set([...uses, ...template.uses])).sort(byText),
  })
}

/** package.json made the new theme's workspace: its name, first version, scripts and the packages it bundles. */
function packageManifest(file: FolderFile, template: FullTemplate, options: FullOptions): FolderFile {
  const play = JSON.parse(textOf(file)) as Json
  const dependencies = Object.entries((play.dependencies ?? {}) as Json)
    .filter(([name]) => options.mascot || name !== template.noMascot.package)
  return jsonFile(PACKAGE_JSON, {
    ...play,
    name: `@${options.names.publisher}/theme-${options.names.slug}`,
    version: FIRST_VERSION,
    description: `${options.names.name}, an installable Automatos theme (${options.names.id}), made from the kit's Play.`,
    scripts: { ...(play.scripts as Json), ...SCRIPTS },
    dependencies: Object.fromEntries(dependencies),
  })
}

/** The template's own files, filled in; the clips' notice only when the theme keeps the clips. */
function ownFiles(template: FullTemplate, options: FullOptions, templateDir: string, playVersion: string): FolderFile[] {
  const mascot = options.mascot ? MASCOT_KEPT : MASCOT_LEFT_OUT
  const values = placeholderValues(options.names, { playVersion, mascot })
  const files = readFolder(join(templateDir, template.files)).map((file) => filledFile(file, values))
  return options.mascot ? files : files.filter((file) => !template.noMascot.drop.includes(file.path))
}

/** theme.json's description with no mascot: Play's names him. */
export const DESCRIPTION_LEFT_OUT = 'A chat with Auto, a shelf of Deliverables, and looks you make your own.'
export const MASCOT_KEPT = (
  "Auto, the mascot, is drawn from the clips and stills in `assets/mascot/`: they are (c) Automatos AI, not covered by "
  + 'the code licence (NOTICE).'
)
export const MASCOT_LEFT_OUT = (
  'It has no mascot (`--mascot none`): no clips, no `mascot` block, no `@automatos/mascot`. The chat still says what '
  + 'Auto is doing, from the modules in `src/lib/auto/`.'
)

function versionOf(playDir: string): string {
  return String((JSON.parse(readFileSync(join(playDir, MANIFEST), 'utf8')) as Json).version)
}

/** The full theme's files for `options`, in path order, or every reason it can't be made. */
export function fullTheme(options: FullOptions): FullResult {
  const templateDir = join(options.kitRoot, FULL_TEMPLATE_DIR)
  const template = readFullTemplate(templateDir)
  const source = sourceFiles(template, options, templateDir)
  const rename = renamer(template, options.names)
  const texts = Array.from(source.values()).filter((file) => isTextFile(file.path)).map(textOf)
  const problems = [...renameCollisions(texts, rename), ...pathCollisions(source.keys(), rename)]
  if (problems.length > 0) return { ok: false, problems }
  const files = new Map(Array.from(source.values(), (file): [string, FolderFile] => {
    const made = renamed(file, rename)
    if (made.path === MANIFEST) return [made.path, themeManifest(made, template, options)]
    return [made.path, made.path === PACKAGE_JSON ? packageManifest(made, template, options) : made]
  }))
  const looks = playLookFiles(options.kitRoot).map((file) => renamed(file, rename))
  const own = ownFiles(template, options, templateDir, versionOf(join(options.kitRoot, template.from)))
  const all = new Map([...files, ...[...looks, ...own].map((file): [string, FolderFile] => [file.path, file])])
  return { ok: true, files: Array.from(all.values()).sort((a, b) => byText(a.path, b.path)) }
}
