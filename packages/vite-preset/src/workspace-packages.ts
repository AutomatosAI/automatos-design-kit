/**
 * The kit's workspace packages a theme bundles (PRD-261 B-01i): the `@automatos/<name>` packages its package.json
 * names under `dependencies` that are the kit's own. The kit lays a theme out as themes/<theme>/ and its packages as
 * packages/<name>/, so such a package is the folder two levels up, at packages/<name>/, whose package.json has that
 * name and the version the theme names (or `*`). Nothing in node_modules is read for it: npm's workspace link there
 * is for tsc and vitest, not for the build.
 *
 * The build reads a bundled package's src/ as it reads the theme's own (source-tree.ts) and resolves the package's
 * name there itself: `@automatos/<name>` is src/index and `@automatos/<name>/<module>` is src/<module>, each the
 * first of MODULE_EXTENSIONS that is a file, as the package's exports map says for tsc and vitest. The Marketplace
 * review rebuilds a package's source/packages/<name>/src/ in the same layout (scripts/review/rebuild.ts) without the
 * package's package.json, so a bundled package may not set `sideEffects`: the two builds would differ.
 */
import { readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { QUERY_OR_HASH, realOr, SOURCE_DIR, type BundledPackage } from './source-tree.ts'

/** The scope of the kit's own packages. */
export const KIT_SCOPE = '@automatos/'
/** Where the kit keeps its packages, from a theme folder: themes/<theme>/ to packages/. */
export const KIT_PACKAGES_DIR = join('..', '..', 'packages')
/** A bundled module's extensions, in the order they are tried (the theme CLI's entry candidates' order). */
export const MODULE_EXTENSIONS: readonly string[] = Object.freeze(['.ts', '.tsx', '.js', '.jsx'])

const INDEX_MODULE = 'index'
const MANIFEST_FILE = 'package.json'
const ANY_VERSION = '*'
const NODE_MODULES = 'node_modules'
/** A package folder's name, as npm allows it: lower case, digits, dot, dash and underscore. */
const FOLDER_NAME = /^[a-z0-9][a-z0-9._-]*$/
/** A module under a package's src/: plain names joined by `/`, none of them `.`, `..` or a dotfile. */
const MODULE_PATH = /^[A-Za-z0-9_][\w.-]*(?:\/[A-Za-z0-9_][\w.-]*)*$/

type Json = Readonly<Record<string, unknown>>

/** Where a bundled package's module is, or why `specifier` names none. */
export type PackageModule = { readonly file: string } | { readonly problem: string }

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The package.json in `dir`, or null when there is none; one that is not a JSON object throws. */
function readManifest(dir: string): Json | null {
  const file = join(dir, MANIFEST_FILE)
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`automatosTheme(): ${file} is not JSON (${String(error)}).`)
  }
  if (!isRecord(parsed)) throw new Error(`automatosTheme(): ${file} is not a JSON object.`)
  return parsed
}

/** The folder a kit package's name gives under packages/ (`@automatos/look-kit` → `look-kit`), or null for any other name. */
export function kitPackageFolder(name: string): string | null {
  if (!name.startsWith(KIT_SCOPE)) return null
  const folder = name.slice(KIT_SCOPE.length)
  return FOLDER_NAME.test(folder) ? folder : null
}

/** The kit package `name` at `version`, from packages/ two folders up from `root`; null when the kit has none of that name. */
function kitPackage(root: string, name: string, version: unknown): BundledPackage | null {
  const folder = kitPackageFolder(name)
  if (folder === null) return null
  const dir = realOr(resolve(root, KIT_PACKAGES_DIR, folder))
  if (dir.split(sep).includes(NODE_MODULES)) return null
  const manifest = readManifest(dir)
  if (manifest === null || manifest.name !== name) return null
  if (version !== ANY_VERSION && manifest.version !== version) {
    throw new Error(
      `automatosTheme(): the theme depends on ${name} ${String(version)}, but ${dir} is ${name} ${String(manifest.version)}: `
      + "name the kit package's own version.",
    )
  }
  if (Object.prototype.hasOwnProperty.call(manifest, 'sideEffects')) {
    throw new Error(
      `automatosTheme(): ${name} sets "sideEffects" in ${join(dir, MANIFEST_FILE)}. The review rebuilds a bundled package `
      + 'from its src/ alone, without its package.json, so the field would build other bytes: remove it.',
    )
  }
  return { name, dir }
}

/** The kit's workspace packages the theme at `root` bundles: the kit packages its package.json `dependencies` name. */
export function bundledPackages(root: string): BundledPackage[] {
  const dependencies = readManifest(root)?.dependencies
  if (!isRecord(dependencies)) return []
  return Object.entries(dependencies).flatMap(([name, version]) => kitPackage(root, name, version) ?? [])
}

/** True for a plain file; false for anything else, a path that runs through a file included. */
function isFile(path: string): boolean {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() === true
  } catch {
    return false
  }
}

/** The file `specifier` names in one of `packages`, why it names none, or null when it is none of theirs. */
export function packageModule(specifier: string, packages: readonly BundledPackage[]): PackageModule | null {
  const bare = specifier.replace(QUERY_OR_HASH, '')
  const owner = packages.find((item) => bare === item.name || bare.startsWith(`${item.name}/`))
  if (owner === undefined) return null
  const modulePath = bare === owner.name ? INDEX_MODULE : bare.slice(owner.name.length + 1)
  if (!MODULE_PATH.test(modulePath)) {
    return { problem: `"${specifier}" names no module of ${owner.name}: name one of its ${SOURCE_DIR}/ modules, without its extension.` }
  }
  const base = join(owner.dir, SOURCE_DIR, ...modulePath.split('/'))
  const file = MODULE_EXTENSIONS.map((extension) => `${base}${extension}`).find(isFile)
  if (file === undefined) {
    const tried = MODULE_EXTENSIONS.map((extension) => `${modulePath}${extension}`).join(', ')
    return { problem: `"${specifier}" names no module of ${owner.name}: its ${SOURCE_DIR}/ has none of ${tried}.` }
  }
  return { file: `${file}${specifier.slice(bare.length)}` }
}
