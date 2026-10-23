#!/usr/bin/env node
// released-unchanged: a released Play version never changes (PRD-261 C-06r, PB-4). Kit CI runs it on
// every pull request and every push to main, at the repository root:
//
//   node scripts/release/released-unchanged.mjs
//
// Play is released by its tag, play-v<version> (theme-release.yml). While themes/play/theme.json names a
// released version, everything the kit's pack collects for Play (PACKED_PATHS below: theme.json, its
// top docs — README.md, CHANGELOG.md and every LICENSE spelling — assets/ and src/, the source of the
// package's generated dist/, boot/ and looks/ too) must be as that tag has them: a change to any of it
// needs a new version (a new release, such as 1.1.1). An untagged version passes only when it is above
// every release tag, so with no release tag yet nothing is released and the check passes.
//
// It lists origin's play-v* tags with git ls-remote (kit CI's checkout fetches no tags), fetches the
// tag the version names (at depth 1 in a shallow checkout such as kit CI's) and lists the packed paths
// that differ between that tag and HEAD. A failure prints a ::error:: line, then each changed path.
// git failing to list, fetch or compare is a failure too, never a pass. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const NAME = 'released-unchanged'
const USAGE = 'usage: node scripts/release/released-unchanged.mjs (no arguments; run it at the repository root)'
const REMOTE = 'origin'
const MANIFEST = 'themes/play/theme.json'
const PLAY_PACKAGE_JSON = 'themes/play/package.json'
/**
 * Play's packed paths: a released version's package is built from these. The top files and the
 * folder match packages/theme-cli/src/collect.ts's PACKED_TOP_FILES (theme.json, README.md,
 * CHANGELOG.md and every LICENSE spelling it names) and its one PACKED_FOLDERS member the theme
 * folder commits, assets/ — collect.ts's other folders (dist, boot, looks) are gitignored
 * (themes/play/.gitignore) and built from src/ at pack time, never committed, so they need no path
 * of their own. src/ is source.ts's SOURCE_DIR, packed as source/. This script is plain Node with no
 * TypeScript loader, so it cannot read those two files' constants at run time; the paths below are
 * spelled out in full (no shared prefix constant, no template literal) so
 * tests/play-package-ci.test.ts can read this list back as plain text and assert it stays a superset
 * of them, so the two can't silently drift apart.
 */
export const PACKED_PATHS = [
  'themes/play/theme.json',
  'themes/play/README.md',
  'themes/play/CHANGELOG.md',
  'themes/play/LICENSE',
  'themes/play/LICENSE.md',
  'themes/play/LICENSE.txt',
  'themes/play/assets',
  'themes/play/src',
]
const TAG_REF_PREFIX = 'refs/tags/play-v'
/** A release tag, as theme-release.yml's TAG_PATTERN has it: play-v<major>.<minor>.<patch>. */
const RELEASE_REF = /^refs\/tags\/play-v(\d+\.\d+\.\d+)$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const GIT_OPTIONS = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  // Never wait for a password: the kit is public, so listing and fetching its tags needs none.
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}

// The decision: pure functions of the version and the release tags.

/** Below, at or above zero as MAJOR.MINOR.PATCH `a` is below, equal to or above `b`, compared by number. */
function compareVersions(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const at = left.findIndex((part, index) => part !== right[index])
  return at < 0 ? 0 : left[at] - right[at]
}

/** The release tags in git ls-remote's output ("<object id>\t<ref>" lines), as { version, objectId }. */
function releaseTags(listing) {
  return listing.split('\n').flatMap((line) => {
    const [objectId, ref = ''] = line.split('\t')
    const match = RELEASE_REF.exec(ref)
    return match === null ? [] : [{ version: match[1], objectId }]
  })
}

function latestOf(tags) {
  return tags.reduce(
    (latest, tag) => (latest === undefined || compareVersions(tag.version, latest.version) > 0 ? tag : latest),
    undefined,
  )
}

/**
 * What Play at `version` needs, given the release tags: { release } to compare HEAD with the tag that
 * names the version, or a verdict { ok, message }: no release yet, or a new version above every release,
 * passes; any other untagged version fails.
 */
function decide(version, tags) {
  const release = tags.find((tag) => tag.version === version)
  if (release !== undefined) return { release }
  const latest = latestOf(tags)
  if (latest === undefined) {
    return { ok: true, message: `no play-v<major>.<minor>.<patch> tag on ${REMOTE} yet, so no Play version is released` }
  }
  if (compareVersions(version, latest.version) > 0) {
    return { ok: true, message: `Play ${version} is not released yet and is above the latest release, play-v${latest.version}` }
  }
  return {
    ok: false,
    message: `Play ${version} (${MANIFEST}) is not released and is not above the latest release, play-v${latest.version}: a new version must be above every release`,
  }
}

/** The verdict on a released version, given the packed paths that differ from its tag. */
function releasedVerdict(version, changed) {
  if (changed.length === 0) {
    return { ok: true, message: `Play ${version} is released (play-v${version}) and its packed paths are as the tag has them` }
  }
  return {
    ok: false,
    message: `Play ${version} is released (play-v${version}), so ${PACKED_PATHS.join(', ')} can't change under that version. Undo these changes, or give Play a new version above every release in ${MANIFEST} and ${PLAY_PACKAGE_JSON}:`,
    paths: changed,
  }
}

// The thin git wrapper.

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** git's output. A failure throws, saying what could not be done and what git said. */
function git(what, args) {
  try {
    return execFileSync('git', args, GIT_OPTIONS)
  } catch (error) {
    const said = typeof error?.stderr === 'string' && error.stderr.trim() !== '' ? error.stderr.trim() : messageOf(error)
    throw new Error(`${what} (git ${args[0]}):\n${said}`)
  }
}

function listReleaseTags() {
  const what = `can't list the play-v* tags on ${REMOTE}`
  return releaseTags(git(what, ['ls-remote', '--tags', '--refs', REMOTE, `${TAG_REF_PREFIX}*`]))
}

/** Fetches the tag's commit. A depth-1 fetch would make a full clone shallow, so only a shallow one gets it. */
function fetchTag(version) {
  const what = `can't fetch play-v${version} from ${REMOTE}`
  const shallow = git(what, ['rev-parse', '--is-shallow-repository']).trim() === 'true'
  git(what, ['fetch', '--quiet', '--no-tags', ...(shallow ? ['--depth=1'] : []), REMOTE, `${TAG_REF_PREFIX}${version}`])
}

/** The packed paths that differ between the tag and HEAD, one per line as git names them. */
function changedPaths(version, objectId) {
  const what = `can't compare HEAD with play-v${version}`
  const listing = git(what, ['diff', '--no-renames', '--name-only', objectId, 'HEAD', '--', ...PACKED_PATHS])
  return listing.split('\n').filter((line) => line !== '')
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch (error) {
    throw new Error(`can't read ${MANIFEST} (run this at the repository root): ${messageOf(error)}`)
  }
}

/** themes/play/theme.json's version, refused unless it is MAJOR.MINOR.PATCH, digits only. */
function readVersion() {
  const version = readManifest()?.version
  if (typeof version === 'string' && VERSION_PATTERN.test(version)) return version
  throw new Error(`${MANIFEST}'s version must be MAJOR.MINOR.PATCH, digits only (such as 1.1.0), not ${JSON.stringify(version)}`)
}

function check() {
  const version = readVersion()
  const decision = decide(version, listReleaseTags())
  if (decision.release === undefined) return decision
  fetchTag(version)
  return releasedVerdict(version, changedPaths(version, decision.release.objectId))
}

/**
 * The lines to print: the verdict (a ::error:: line on a failure), then each changed path, indented.
 * Every path starts with themes/play/ (git quotes an unusual name on one line), so none of them can be
 * read as a workflow command.
 */
function report(verdict) {
  const head = verdict.ok ? `${NAME}: ${verdict.message}` : `::error::${NAME}: ${verdict.message}`
  return [head, ...(verdict.paths ?? []).map((path) => `  ${path}`)]
}

function main(argv) {
  if (argv.length > 0) throw new Error(USAGE)
  const verdict = check()
  process.stdout.write(`${report(verdict).join('\n')}\n`)
  if (!verdict.ok) process.exitCode = 1
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
