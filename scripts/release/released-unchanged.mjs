#!/usr/bin/env node
// released-unchanged: a released theme version never changes (PRD-261 C-06r, PB-4). Kit CI runs it on every
// pull request and every push to main, at the repository root:
//
//   node scripts/release/released-unchanged.mjs
//
// Every folder under themes/ is a theme, released by its tag, <slug>-v<version> (themes.mjs's TAG_PATTERN, the tag
// rule theme-release.yml and theme-publish.yml share). While a theme's theme.json names a released version,
// everything the kit's pack collects for it (themes.mjs packedPathsOf: theme.json, its top docs — README.md,
// CHANGELOG.md and every LICENSE spelling — dist/, boot/, looks/, assets/ and src/, and the src/ of each kit library
// its package.json names) must be as that tag has them: a change to any of it needs a new version (a new release,
// such as 1.1.1). An untagged version passes only when it is above every release tag of that theme, so with no
// release tag yet nothing of it is released and its check passes. Each theme is checked on its own tags alone, in
// folder order; the run fails when any theme fails.
//
// For each theme it lists origin's <slug>-v* tags with git ls-remote (kit CI's checkout fetches no tags),
// fetches the tag the version names (at depth 1 in a shallow checkout such as kit CI's) and lists the packed
// paths that differ between that tag and HEAD. A failure prints a ::error:: line, then each changed path.
// git failing to list, fetch or compare is a failure too, never a pass. Plain Node, no dependencies.
import {
  compareVersions, git, latestOf, listReleaseTags, manifestPathOf, messageOf, packedPathsOf, PACKAGE_JSON, readJson,
  REMOTE, SLUG_PATTERN, tagPrefixOf, themeDirOf, themeFolders, VERSION_PATTERN,
} from './themes.mjs'

const NAME = 'released-unchanged'
const USAGE = 'usage: node scripts/release/released-unchanged.mjs (no arguments; run it at the repository root)'
const ROOT = '.'

/**
 * The themes, in folder order: each folder under themes/ whose name the tag rule can name, with the name messages
 * give (its folder), its release tag's prefix (<slug>-v) and its packed paths. A folder the tag rule can't name has
 * no release tag, so nothing of it is released.
 */
function themes(root) {
  return themeFolders(root).filter((slug) => SLUG_PATTERN.test(slug)).map((slug) => ({
    slug, name: themeDirOf(slug), tag: tagPrefixOf(slug), packedPaths: packedPathsOf(root, slug),
  }))
}

// The decision: pure functions of the theme, its version and its release tags.

const packageJsonOf = (theme) => `${theme.name}/${PACKAGE_JSON}`
const tagRefPrefix = (theme) => `refs/tags/${theme.tag}`

/**
 * What the theme at `version` needs, given its release tags: { release } to compare HEAD with the tag that
 * names the version, or a verdict { ok, message }: no release yet, or a new version above every release,
 * passes; any other untagged version fails.
 */
function decide(theme, version, tags) {
  const release = tags.find((tag) => tag.version === version)
  if (release !== undefined) return { release }
  const latest = latestOf(tags)
  if (latest === undefined) {
    return { ok: true, message: `no ${theme.tag}<major>.<minor>.<patch> tag on ${REMOTE} yet, so no ${theme.name} version is released` }
  }
  const latestTag = `${theme.tag}${latest.version}`
  if (compareVersions(version, latest.version) > 0) {
    return { ok: true, message: `${theme.name} ${version} is not released yet and is above the latest release, ${latestTag}` }
  }
  return {
    ok: false,
    message: `${theme.name} ${version} (${manifestPathOf(theme.slug)}) is not released and is not above the latest release, ${latestTag}: a new version must be above every release`,
  }
}

/** The verdict on a released version, given the packed paths that differ from its tag. */
function releasedVerdict(theme, version, changed) {
  const released = `${theme.name} ${version} is released (${theme.tag}${version})`
  if (changed.length === 0) {
    return { ok: true, message: `${released} and its packed paths are as the tag has them` }
  }
  return {
    ok: false,
    message: `${released}, so ${theme.packedPaths.join(', ')} can't change under that version. Undo these changes, or give ${theme.name} a new version above every release in ${manifestPathOf(theme.slug)} and ${packageJsonOf(theme)}:`,
    paths: changed,
  }
}

// The thin git wrapper.

/** Fetches the tag's commit. A depth-1 fetch would make a full clone shallow, so only a shallow one gets it. */
function fetchTag(theme, version) {
  const what = `can't fetch ${theme.tag}${version} from ${REMOTE}`
  const shallow = git(what, ['rev-parse', '--is-shallow-repository'], ROOT).trim() === 'true'
  git(what, ['fetch', '--quiet', '--no-tags', ...(shallow ? ['--depth=1'] : []), REMOTE, `${tagRefPrefix(theme)}${version}`], ROOT)
}

/** The packed paths that differ between the tag and HEAD, one per line as git names them. */
function changedPaths(theme, version, objectId) {
  const what = `can't compare HEAD with ${theme.tag}${version}`
  const listing = git(what, ['diff', '--no-renames', '--name-only', objectId, 'HEAD', '--', ...theme.packedPaths], ROOT)
  return listing.split('\n').filter((line) => line !== '')
}

/** The theme's theme.json version, refused unless it is MAJOR.MINOR.PATCH, digits only. */
function readVersion(theme) {
  const version = readJson(ROOT, manifestPathOf(theme.slug))?.version
  if (typeof version === 'string' && VERSION_PATTERN.test(version)) return version
  throw new Error(`${manifestPathOf(theme.slug)}'s version must be MAJOR.MINOR.PATCH, digits only (such as 1.1.0), not ${JSON.stringify(version)}`)
}

function check(theme) {
  const version = readVersion(theme)
  const decision = decide(theme, version, listReleaseTags(theme.slug, ROOT))
  if (decision.release === undefined) return decision
  fetchTag(theme, version)
  return releasedVerdict(theme, version, changedPaths(theme, version, decision.release.objectId))
}

/**
 * The lines to print: the verdict (a ::error:: line on a failure), then each changed path, indented.
 * Every path starts with themes/<slug>/ or packages/ (git quotes an unusual name on one line), so none of
 * them can be read as a workflow command.
 */
function report(verdict) {
  const head = verdict.ok ? `${NAME}: ${verdict.message}` : `::error::${NAME}: ${verdict.message}`
  return [head, ...(verdict.paths ?? []).map((path) => `  ${path}`)]
}

function main(argv) {
  if (argv.length > 0) throw new Error(USAGE)
  const verdicts = themes(ROOT).map(check)
  process.stdout.write(`${verdicts.flatMap(report).join('\n')}\n`)
  if (verdicts.some((verdict) => !verdict.ok)) process.exitCode = 1
}

try {
  main(process.argv.slice(2))
} catch (error) {
  // The lines after the first (git's own message) carry the script's name first, so none of them can be
  // read as a workflow command.
  const [first, ...rest] = messageOf(error).split('\n')
  process.stdout.write(`::error::${NAME}: ${first}\n${rest.map((line) => `${NAME}: ${line}\n`).join('')}`)
  process.exitCode = 1
}
