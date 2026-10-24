/**
 * A template's placeholders (PRD-261 B-01e, B-03f): the new theme's names, and a template folder copied with them
 * filled in.
 *
 * A template's text holds `{{name}}` where the new theme's own value goes: `{{id}}` (`acme/harbour`), `{{publisher}}`
 * (`acme`), `{{slug}}` (`harbour`), `{{name}}` (the display name, `Harbour`) and `{{htmlClass}}` (`harbour`, the slug).
 * `themeNames` gives them, with the forms the full template's renames use besides (`Harbour` as a type's prefix,
 * `HARBOUR` as a constant's, `harbour` as a function's). A placeholder the template names and the values don't
 * have stops the copy with a sentence: a template is filled whole or not at all.
 *
 * The files are read as they are on disk, a link refused (pack refuses links too); a text file is filled, any other
 * file copied byte for byte. Nothing here reads the network or runs anything.
 */
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { byText } from '../collect.ts'

/** `{{name}}`: two braces, a name of letters, two braces. */
export const PLACEHOLDER = /\{\{([A-Za-z]+)\}\}/g
/** A template folder's own description, never copied. */
export const TEMPLATE_FILE = 'template.json'
/** Files of a folder that are never copied: the template's description and a desktop's leftovers. */
const NEVER_COPIED: ReadonlySet<string> = new Set([TEMPLATE_FILE, '.DS_Store'])
/** The files whose text is filled in; anything else (fonts, clips, images) is copied as it is. */
const TEXT_SUFFIXES: readonly string[] = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.json', '.md', '.txt', '.gitignore']
/** Text files with no suffix, by their name. */
const TEXT_NAMES: ReadonlySet<string> = new Set(['NOTICE', 'LICENSE'])
const WORD_SEPARATOR = '-'

export type PlaceholderValues = Readonly<Record<string, string>>

/** A new theme's names, from its id `publisher/slug`. */
export interface ThemeNames {
  readonly id: string
  readonly publisher: string
  readonly slug: string
  /** The display name: the slug's words, each capitalised (`night-owl` is `Night Owl`). */
  readonly name: string
  /** The class on <html>: the slug. */
  readonly htmlClass: string
  /** `NightOwl`: the prefix of a component's or a type's name. */
  readonly pascal: string
  /** `NIGHT_OWL`: the prefix of a constant's name. */
  readonly constant: string
  /** `nightOwl`: the prefix of a function's or a variable's name. */
  readonly camel: string
}

/** One file of a folder: its path relative to the folder, `/`-separated, and its bytes. */
export interface FolderFile {
  readonly path: string
  readonly data: Uint8Array
}

const capitalised = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`

/** The names of the theme `id` (`publisher/slug`, checked already: see new/index.ts). */
export function themeNames(id: string): ThemeNames {
  const [publisher, slug] = id.split('/')
  const words = slug.split(WORD_SEPARATOR)
  const pascal = words.map(capitalised).join('')
  return {
    id,
    publisher,
    slug,
    name: words.map(capitalised).join(' '),
    htmlClass: slug,
    pascal,
    constant: words.map((word) => word.toUpperCase()).join('_'),
    camel: `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`,
  }
}

/** The placeholders a template fills from the theme's names. */
export function placeholderValues(names: ThemeNames, extra: PlaceholderValues = {}): PlaceholderValues {
  const { id, publisher, slug, name, htmlClass } = names
  return { id, publisher, slug, name, htmlClass, ...extra }
}

/** Every placeholder name in `text`, in order of first use. */
export function placeholdersIn(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(PLACEHOLDER), (match) => match[1])))
}

/** `text` with every `{{name}}` filled from `values`; a name `values` doesn't have throws, naming `where`. */
export function fillPlaceholders(text: string, values: PlaceholderValues, where: string): string {
  return text.replace(PLACEHOLDER, (_whole, name: string) => {
    if (!Object.hasOwn(values, name)) {
      throw new Error(`${where} names the placeholder {{${name}}}, which this template doesn't fill.`)
    }
    return values[name]
  })
}

/** True for a file whose text a template fills in. */
export function isTextFile(path: string): boolean {
  return TEXT_SUFFIXES.some((suffix) => path.endsWith(suffix)) || TEXT_NAMES.has(path.slice(path.lastIndexOf('/') + 1))
}

/** Every file under `root`, depth first in name order, but NEVER_COPIED; a link (to a file or a folder) throws. */
export function readFolder(root: string, under = ''): FolderFile[] {
  return readdirSync(join(root, under), { withFileTypes: true })
    .filter((dirent) => !NEVER_COPIED.has(dirent.name))
    .sort((a, b) => byText(a.name, b.name))
    .flatMap((dirent): FolderFile[] => {
      const path = under ? `${under}/${dirent.name}` : dirent.name
      if (lstatSync(join(root, path)).isSymbolicLink()) throw new Error(`${join(root, path)} is a symbolic link: a template holds files only.`)
      if (dirent.isDirectory()) return readFolder(root, path)
      return dirent.isFile() ? [{ path, data: new Uint8Array(readFileSync(join(root, path))) }] : []
    })
}

/** `file` with its text filled in when it is a text file. */
export function filledFile(file: FolderFile, values: PlaceholderValues): FolderFile {
  if (!isTextFile(file.path)) return file
  const text = fillPlaceholders(new TextDecoder().decode(file.data), values, file.path)
  return { path: file.path, data: new TextEncoder().encode(text) }
}

/** Writes `files` under `target`, making the folders they need. */
export function writeFolder(target: string, files: readonly FolderFile[]): void {
  files.forEach((file) => {
    mkdirSync(dirname(join(target, file.path)), { recursive: true })
    writeFileSync(join(target, file.path), file.data)
  })
}

/** The template folder `templateDir` copied to `target`, its placeholders filled from `values`; the paths written. */
export function copyTemplate(templateDir: string, target: string, values: PlaceholderValues): string[] {
  const files = readFolder(templateDir).map((file) => filledFile(file, values))
  writeFolder(target, files)
  return files.map((file) => file.path)
}
