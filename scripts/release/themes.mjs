// themes: the kit's theme folders, their release tags and the tag rule, shared by released-unchanged.mjs (kit CI's
// guard that a released version never changes) and bumped.mjs (the publish run's pick of the themes to publish).
// Plain Node with no dependencies, and nothing runs on import, so a test can import it.
//
// The tag rule: a release tag is <slug>-v<major>.<minor>.<patch> (TAG_PATTERN). It names the folder themes/<slug>,
// whose theme.json id is <publisher>/<slug>, with the publisher one release/publishers.json lists.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const THEMES_DIR = 'themes'
export const PACKAGES_DIR = 'packages'
export const MANIFEST_FILE = 'theme.json'
export const PACKAGE_JSON = 'package.json'
export const PUBLISHERS_FILE = 'release/publishers.json'
export const REMOTE = 'origin'
export const MAIN_REF = 'refs/remotes/origin/main'
/** A release tag: the theme's slug, then -v and its version. The slug is the folder under themes/. */
export const TAG_PATTERN = /^([a-z0-9-]+)-v\d+\.\d+\.\d+$/
const TAG_SEPARATOR = '-v'
/** A tag's version and a theme.json version as the release guard reads them: MAJOR.MINOR.PATCH, digits only. */
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
/** Copied from core orchestrator/services/themes/manifest.py ID_PATTERN (used with fullmatch), as scripts/sign/request.ts has it. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,62}$/
/** Copied from core orchestrator/services/themes/manifest.py VERSION_PATTERN, as scripts/sign/request.ts has it. */
export const CORE_VERSION_PATTERN = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/
/** A publisher: the part of ID_PATTERN before the slash. */
export const PUBLISHER_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}$/
/** A folder name the tag rule can name. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/
/**
 * What a theme's pack collects from its folder: packages/theme-cli/src/collect.ts's PACKED_TOP_FILES and
 * PACKED_FOLDERS, and source.ts's SOURCE_DIR (packed as source/). This file is plain Node, so it can't import that
 * TypeScript; the root tests hold the three lists equal to theirs. A folder git ignores (Play's generated dist/,
 * boot/ and looks/) holds no tracked file, so guarding it costs nothing.
 */
export const PACKED_TOP_FILES = ['theme.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt']
export const PACKED_FOLDERS = ['dist', 'boot', 'looks', 'assets']
export const SOURCE_DIR = 'src'
/** The kit's scope, and the package.json field that makes a kit package a library a theme bundles (the vite-preset's). */
const KIT_SCOPE = '@automatos/'
const KIT_LIBRARY_FIELD = 'kitLibrary'
const GIT_OPTIONS = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  // Never wait for a password: the kit is public, so listing and fetching its tags needs none.
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}

export function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Below, at or above zero as MAJOR.MINOR.PATCH `a` is below, equal to or above `b`, compared by number. */
export function compareVersions(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const at = left.findIndex((part, index) => part !== right[index])
  return at < 0 ? 0 : left[at] - right[at]
}

export const tagPrefixOf = (slug) => `${slug}${TAG_SEPARATOR}`
export const tagOf = (slug, version) => `${tagPrefixOf(slug)}${version}`
export const themeDirOf = (slug) => `${THEMES_DIR}/${slug}`
export const manifestPathOf = (slug) => `${themeDirOf(slug)}/${MANIFEST_FILE}`
/** The package's name as pack writes it: the id with its slash as a dot (`automatos/play` is `automatos.play`). */
export const packageNameOf = (id) => id.replace('/', '.')

/** { slug, version } of a release tag, or null when the tag rule doesn't admit it. */
export function parseTag(tag) {
  const match = typeof tag === 'string' ? TAG_PATTERN.exec(tag) : null
  if (match === null) return null
  return { slug: match[1], version: tag.slice(match[1].length + TAG_SEPARATOR.length) }
}

/** A theme's release tags in git ls-remote's output ("<object id>\t<ref>" lines), as { version, objectId }. */
export function releaseTags(slug, listing) {
  const prefix = `refs/tags/${tagPrefixOf(slug)}`
  return listing.split('\n').flatMap((line) => {
    const [objectId, ref = ''] = line.split('\t')
    const version = ref.startsWith(prefix) ? ref.slice(prefix.length) : ''
    return VERSION_PATTERN.test(version) ? [{ version, objectId }] : []
  })
}

/** The newest of the tags by version, or undefined for none. */
export function latestOf(tags) {
  return tags.reduce(
    (latest, tag) => (latest === undefined || compareVersions(tag.version, latest.version) > 0 ? tag : latest),
    undefined,
  )
}

/** release/publishers.json's text: `{"publishers": [...]}`, each a publisher once. Throws with the reason. */
export function parsePublishers(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`${PUBLISHERS_FILE} isn't JSON`)
  }
  const list = isRecord(raw) ? raw.publishers : undefined
  if (!Array.isArray(list) || !list.every((name) => typeof name === 'string' && PUBLISHER_PATTERN.test(name))) {
    throw new Error(`${PUBLISHERS_FILE} must be {"publishers": [...]}, each a publisher as core's theme ids have it`)
  }
  if (new Set(list).size !== list.length) throw new Error(`${PUBLISHERS_FILE} names a publisher twice`)
  return list
}

/** Reads a JSON file under `root`; a failure throws, naming the file. */
export function readJson(root, rel) {
  try {
    return JSON.parse(readFileSync(join(root, rel), 'utf8'))
  } catch (error) {
    throw new Error(`can't read ${rel} (run this at the repository root): ${messageOf(error)}`)
  }
}

export function readPublishers(root) {
  try {
    return parsePublishers(readFileSync(join(root, PUBLISHERS_FILE), 'utf8'))
  } catch (error) {
    throw new Error(`can't read the publishers: ${messageOf(error)}`)
  }
}

/** Every folder under themes/, by name, sorted: each is a theme. Hidden folders are none. */
export function themeFolders(root) {
  const entries = readdirSync(join(root, THEMES_DIR), { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
}

/** The src/ of each kit library the theme's package.json names under dependencies, as pack writes them into source/. */
export function bundledSources(root, slug) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(root, themeDirOf(slug), PACKAGE_JSON), 'utf8'))
  } catch {
    return []
  }
  const dependencies = isRecord(manifest) && isRecord(manifest.dependencies) ? Object.keys(manifest.dependencies) : []
  return dependencies.flatMap((name) => {
    const folder = name.startsWith(KIT_SCOPE) ? name.slice(KIT_SCOPE.length) : ''
    if (!SLUG_PATTERN.test(folder)) return []
    let library
    try {
      library = JSON.parse(readFileSync(join(root, PACKAGES_DIR, folder, PACKAGE_JSON), 'utf8'))
    } catch {
      return []
    }
    const bundled = isRecord(library) && library.name === name && library[KIT_LIBRARY_FIELD] === true
    return bundled ? [`${PACKAGES_DIR}/${folder}/${SOURCE_DIR}`] : []
  })
}

/** Everything the theme's package is built from: its packed top files and folders, its src/ and its bundled libraries' src/. */
export function packedPathsOf(root, slug) {
  const dir = themeDirOf(slug)
  const own = [...PACKED_TOP_FILES, ...PACKED_FOLDERS, SOURCE_DIR].map((name) => `${dir}/${name}`)
  return [...own, ...bundledSources(root, slug)]
}

/** git's output, run in `cwd`. A failure throws, saying what could not be done and what git said. */
export function git(what, args, cwd) {
  try {
    return execFileSync('git', args, { ...GIT_OPTIONS, cwd })
  } catch (error) {
    const said = typeof error?.stderr === 'string' && error.stderr.trim() !== '' ? error.stderr.trim() : messageOf(error)
    throw new Error(`${what} (git ${args[0]}):\n${said}`)
  }
}

/** The theme's release tags on origin, listed with git ls-remote (a CI checkout may hold no tags). */
export function listReleaseTags(slug, cwd) {
  const what = `can't list the ${tagPrefixOf(slug)}* tags on ${REMOTE}`
  return releaseTags(slug, git(what, ['ls-remote', '--tags', '--refs', REMOTE, `refs/tags/${tagPrefixOf(slug)}*`], cwd))
}
