#!/usr/bin/env node
// bumped: the themes a run of theme-publish.yml publishes (its pick job), and the theme a release tag names
// (theme-release.yml's and a backfill's check of the tag). Run at the repository root:
//
//   node scripts/release/bumped.mjs              every theme at HEAD whose version is above its newest release tag
//   node scripts/release/bumped.mjs --tag <tag>  the theme the tag names, at the tag, which must be on main
//
// A theme is the folder themes/<slug>: its theme.json id must be <publisher>/<slug> (core's id pattern) and its
// version core's MAJOR.MINOR.PATCH, or the run is refused. A theme whose publisher release/publishers.json doesn't
// list is left out. Its release tags are <slug>-v<version> (themes.mjs's TAG_PATTERN), listed on origin with git
// ls-remote. With --tag, the tag must exist here and be on refs/remotes/origin/main, and the theme.json the tagged
// commit holds must be a listed publisher's at the tag's version; anything else is refused.
//
// stdout: one line of JSON, the picked themes, each {slug, publisher, id, version, dir, tag, packageName, commit}
// ([] for none); commit is the one to build (HEAD, or the tag's). stderr: one line per theme saying what was
// decided, ::error:: for a refusal. Exit 0 picked (none included); 1 refused, nothing picked; 2 usage.
// Plain Node, no dependencies.
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  compareVersions, CORE_VERSION_PATTERN, git, ID_PATTERN, isRecord, latestOf, listReleaseTags, MAIN_REF,
  manifestPathOf, messageOf, packageNameOf, parseTag, PUBLISHERS_FILE, readJson, readPublishers, SLUG_PATTERN,
  tagOf, themeDirOf, themeFolders,
} from './themes.mjs'

const NAME = 'bumped'
const USAGE = 'usage: node scripts/release/bumped.mjs   or   node scripts/release/bumped.mjs --tag <slug>-v<major>.<minor>.<patch>'
const TAG_FLAG = '--tag'
const ROOT = '.'
export const EXIT_OK = 0
export const EXIT_REFUSED = 1
export const EXIT_USAGE = 2
/** A folder's name as a message may show it: as it is when the tag rule can name it, else a placeholder. */
const shownFolder = (folder) => (SLUG_PATTERN.test(folder) ? themeDirOf(folder) : `${themeDirOf('')}(a folder the tag rule can't name)`)

/**
 * The theme a folder's theme.json names, or why not: { theme: {slug, publisher, id, version} }, { skip } (a
 * publisher the list leaves out) or { error }. Nothing from the file is echoed unless it passed core's pattern.
 */
export function identify(folder, manifest, publishers) {
  const where = `${shownFolder(folder)}/theme.json`
  if (!isRecord(manifest)) return { error: `${where} isn't a JSON object` }
  const { id, version } = manifest
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return { error: `${where}'s id must be <publisher>/<slug>, as core's theme ids are` }
  const [publisher, slug] = id.split('/')
  if (slug !== folder) return { error: `${where}'s id is ${id}, so the theme must be in ${themeDirOf(slug)}: the folder is the id's slug` }
  if (!publishers.includes(publisher)) return { skip: `${id}: ${publisher} isn't in ${PUBLISHERS_FILE}, so it isn't published` }
  if (typeof version !== 'string' || !CORE_VERSION_PATTERN.test(version)) {
    return { error: `${where}'s version must be MAJOR.MINOR.PATCH as core's manifest has it (such as 1.2.0)` }
  }
  return { theme: { slug, publisher, id, version } }
}

/** The theme as the publish run takes it: its folder, its tag and its package's name, at `commit`. */
export function picked(theme, commit) {
  const { slug, publisher, id, version } = theme
  return { slug, publisher, id, version, dir: themeDirOf(slug), tag: tagOf(slug, version), packageName: packageNameOf(id), commit }
}

/**
 * The decision for an identified theme at HEAD, given its release tags: { pick } when its version is above every
 * tag (or it has none), else { skip }. Each comes with the line to log.
 */
export function decide(theme, tags) {
  const { slug, id, version } = theme
  const latest = latestOf(tags)
  if (latest === undefined) return { pick: theme, message: `${id} ${version} has no release tag yet: picked` }
  const newest = tagOf(slug, latest.version)
  if (compareVersions(version, latest.version) > 0) return { pick: theme, message: `${id} ${version} is above ${newest}: picked` }
  if (tags.some((tag) => tag.version === version)) return { skip: `${id} ${version} is released (${tagOf(slug, version)})` }
  return { skip: `${id} ${version} is not above the newest release, ${newest}` }
}

/** The folder's theme.json, or undefined when it can't be read (JSON.parse never answers undefined). */
function readManifest(folder) {
  try {
    return readJson(ROOT, manifestPathOf(folder))
  } catch {
    return undefined
  }
}

/** One folder's decision: its theme.json read and identified, then its tags listed only when it is a listed theme. */
function decideFolder(folder, publishers) {
  const manifest = readManifest(folder)
  if (manifest === undefined) return { error: `can't read ${shownFolder(folder)}/theme.json` }
  const named = identify(folder, manifest, publishers)
  return named.theme === undefined ? named : decide(named.theme, listReleaseTags(folder, ROOT))
}

const logLine = (decision) => (decision.error === undefined ? `${NAME}: ${decision.message ?? decision.skip}` : `::error::${NAME}: ${decision.error}`)

/** Every theme at HEAD whose version is above its newest tag, or null (each reason logged) when the run is refused. */
function pickBumped(log) {
  const publishers = readPublishers(ROOT)
  const commit = git("can't read HEAD", ['rev-parse', 'HEAD'], ROOT).trim()
  const decisions = themeFolders(ROOT).map((folder) => decideFolder(folder, publishers))
  decisions.forEach((decision) => log(logLine(decision)))
  if (decisions.some((decision) => decision.error !== undefined)) return null
  return decisions.flatMap((decision) => (decision.pick === undefined ? [] : [picked(decision.pick, commit)]))
}

/** The tag's commit, refused unless the tag exists here and is on main. */
function taggedCommit(tag) {
  const commit = git(`there is no tag ${tag} here`, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], ROOT).trim()
  git(`can't find ${MAIN_REF}: check out with all history`, ['rev-parse', '--verify', '--quiet', MAIN_REF], ROOT)
  try {
    git('', ['merge-base', '--is-ancestor', commit, MAIN_REF], ROOT)
  } catch {
    throw new Error(`${tag} is not on main (${MAIN_REF}): a theme is released from main only`)
  }
  return commit
}

/** The theme the tag names, at the tagged commit, or the reason the run is refused. */
function pickTag(tag, log) {
  const parsed = parseTag(tag)
  if (parsed === null) throw new Error(`a release tag is <slug>-v<major>.<minor>.<patch>, lower-case letters, digits and hyphens before -v`)
  const commit = taggedCommit(tag)
  const text = git(`${tag} has no ${manifestPathOf(parsed.slug)}`, ['show', `${commit}:${manifestPathOf(parsed.slug)}`], ROOT)
  let manifest
  try {
    manifest = JSON.parse(text)
  } catch {
    throw new Error(`${manifestPathOf(parsed.slug)} at ${tag} isn't JSON`)
  }
  const named = identify(parsed.slug, manifest, readPublishers(ROOT))
  if (named.theme === undefined) throw new Error(`${tag} can't be released: ${named.error ?? named.skip}`)
  if (named.theme.version !== parsed.version) {
    throw new Error(`${tag} does not name the version in ${manifestPathOf(parsed.slug)} at the tag (${named.theme.version})`)
  }
  log(`${NAME}: ${named.theme.id} ${named.theme.version} at ${tag}, on main: picked`)
  return [picked(named.theme, commit)]
}

/** The command: prints the picked themes as JSON, answers the exit code. */
export function main(argv, io = { out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text) }) {
  const log = (line) => io.err(`${line}\n`)
  const byTag = argv.length === 2 && argv[0] === TAG_FLAG
  if (argv.length !== 0 && !byTag) {
    log(USAGE)
    return EXIT_USAGE
  }
  try {
    const themes = byTag ? pickTag(argv[1], log) : pickBumped(log)
    if (themes === null) return EXIT_REFUSED
    io.out(`${JSON.stringify(themes)}\n`)
    return EXIT_OK
  } catch (error) {
    log(`::error::${NAME}: ${messageOf(error).split('\n').join(' ')}`)
    return EXIT_REFUSED
  }
}

/** Whether the module at `moduleUrl` is the script Node was started with. */
export function isMain(moduleUrl) {
  const script = process.argv[1]
  if (typeof script !== 'string') return false
  try {
    return pathToFileURL(realpathSync(script)).href === moduleUrl
  } catch {
    return false
  }
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2))
