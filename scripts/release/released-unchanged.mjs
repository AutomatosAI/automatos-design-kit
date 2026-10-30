#!/usr/bin/env node
// released-unchanged: a released theme version never changes (PRD-261 C-06r, PB-4). Kit CI runs it on every
// pull request and every push to main, at the repository root:
//
//   node scripts/release/released-unchanged.mjs
//
// Each theme the kit releases (THEMES below: Play, HUD and Arcade) is released by its tag, <theme>-v<version>
// (theme-release.yml: play-v<version>, hud-v<version>, arcade-v<version>). While a theme's theme.json names a
// released version, everything the kit's pack collects for it (its packed paths below: theme.json, its top
// docs — README.md, CHANGELOG.md and every LICENSE spelling — assets/, the committed boot/ and looks/, and
// src/, and the src/ of each kit package it bundles) must be as that tag has them: a change to any of it needs
// a new version (a new release, such as 1.1.1). An untagged version passes only when it is above every release
// tag of that theme, so with no release tag yet nothing of it is released and its check passes. Each theme is
// checked on its own tags alone, Play first; the run fails when any theme fails.
//
// For each theme it lists origin's <theme>-v* tags with git ls-remote (kit CI's checkout fetches no tags),
// fetches the tag the version names (at depth 1 in a shallow checkout such as kit CI's) and lists the packed
// paths that differ between that tag and HEAD. A failure prints a ::error:: line, then each changed path.
// git failing to list, fetch or compare is a failure too, never a pass. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const NAME = 'released-unchanged'
const USAGE = 'usage: node scripts/release/released-unchanged.mjs (no arguments; run it at the repository root)'
const REMOTE = 'origin'
/**
 * Each theme's packed paths: a released version's package is built from these. The top files and the
 * folders match packages/theme-cli/src/collect.ts's PACKED_TOP_FILES (theme.json, README.md, CHANGELOG.md
 * and every LICENSE spelling it names) and the PACKED_FOLDERS members the theme folder commits: Play commits
 * assets/ alone (its dist/, boot/ and looks/ are gitignored, themes/play/.gitignore, and built from src/ at
 * pack time), HUD and Arcade both commit assets/, boot/ and looks/ (their dist/ alone is built). A gitignored
 * folder needs no path of its own. src/ is source.ts's SOURCE_DIR, packed as source/. packages/look-kit/src
 * and packages/mascot/src are the src/ of the two kit workspace packages a theme can bundle (the @automatos/
 * packages a theme's package.json names under dependencies, PRD-261 B-01i): pack writes each one as
 * source/packages/<name>/src/, and the build bundles it into dist/. Play and HUD both bundle look-kit and
 * mascot; Arcade bundles mascot alone (its package.json names no look-kit dependency). This script is plain
 * Node with no TypeScript loader, so it cannot read those files' constants at run time; the paths below are
 * spelled out in full (no shared prefix constant, no template literal) so tests/play-package-ci.test.ts,
 * tests/hud-package-ci.test.ts and tests/arcade-package-ci.test.ts can read each list back as plain text and
 * assert it stays a superset of them, so the three can't silently drift apart.
 */
export const PLAY_PACKED_PATHS = [
  'themes/play/theme.json',
  'themes/play/README.md',
  'themes/play/CHANGELOG.md',
  'themes/play/LICENSE',
  'themes/play/LICENSE.md',
  'themes/play/LICENSE.txt',
  'themes/play/assets',
  'themes/play/src',
  'packages/look-kit/src',
  'packages/mascot/src',
]
export const HUD_PACKED_PATHS = [
  'themes/hud/theme.json',
  'themes/hud/README.md',
  'themes/hud/CHANGELOG.md',
  'themes/hud/LICENSE',
  'themes/hud/LICENSE.md',
  'themes/hud/LICENSE.txt',
  'themes/hud/assets',
  'themes/hud/boot',
  'themes/hud/looks',
  'themes/hud/src',
  'packages/look-kit/src',
  'packages/mascot/src',
]
export const ARCADE_PACKED_PATHS = [
  'themes/arcade/theme.json',
  'themes/arcade/README.md',
  'themes/arcade/CHANGELOG.md',
  'themes/arcade/LICENSE',
  'themes/arcade/LICENSE.md',
  'themes/arcade/LICENSE.txt',
  'themes/arcade/assets',
  'themes/arcade/boot',
  'themes/arcade/looks',
  'themes/arcade/src',
  'packages/mascot/src',
]
/**
 * The themes, in the order they are checked: the name messages give, the theme's folder, its release tag's
 * prefix (theme-release.yml's TAG_PATTERN: <theme>-v<major>.<minor>.<patch>) and its packed paths.
 */
export const THEMES = [
  { name: 'Play', dir: 'themes/play', tag: 'play-v', packedPaths: PLAY_PACKED_PATHS },
  { name: 'HUD', dir: 'themes/hud', tag: 'hud-v', packedPaths: HUD_PACKED_PATHS },
  { name: 'Arcade', dir: 'themes/arcade', tag: 'arcade-v', packedPaths: ARCADE_PACKED_PATHS },
]
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const GIT_OPTIONS = {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  // Never wait for a password: the kit is public, so listing and fetching its tags needs none.
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}

// The decision: pure functions of the theme, its version and its release tags.

const manifestOf = (theme) => `${theme.dir}/theme.json`
const packageJsonOf = (theme) => `${theme.dir}/package.json`
const tagRefPrefix = (theme) => `refs/tags/${theme.tag}`

/** Below, at or above zero as MAJOR.MINOR.PATCH `a` is below, equal to or above `b`, compared by number. */
function compareVersions(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const at = left.findIndex((part, index) => part !== right[index])
  return at < 0 ? 0 : left[at] - right[at]
}

/** The theme's release tags in git ls-remote's output ("<object id>\t<ref>" lines), as { version, objectId }. */
function releaseTags(theme, listing) {
  const prefix = tagRefPrefix(theme)
  return listing.split('\n').flatMap((line) => {
    const [objectId, ref = ''] = line.split('\t')
    const version = ref.startsWith(prefix) ? ref.slice(prefix.length) : ''
    return VERSION_PATTERN.test(version) ? [{ version, objectId }] : []
  })
}

function latestOf(tags) {
  return tags.reduce(
    (latest, tag) => (latest === undefined || compareVersions(tag.version, latest.version) > 0 ? tag : latest),
    undefined,
  )
}

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
    message: `${theme.name} ${version} (${manifestOf(theme)}) is not released and is not above the latest release, ${latestTag}: a new version must be above every release`,
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
    message: `${released}, so ${theme.packedPaths.join(', ')} can't change under that version. Undo these changes, or give ${theme.name} a new version above every release in ${manifestOf(theme)} and ${packageJsonOf(theme)}:`,
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

function listReleaseTags(theme) {
  const what = `can't list the ${theme.tag}* tags on ${REMOTE}`
  return releaseTags(theme, git(what, ['ls-remote', '--tags', '--refs', REMOTE, `${tagRefPrefix(theme)}*`]))
}

/** Fetches the tag's commit. A depth-1 fetch would make a full clone shallow, so only a shallow one gets it. */
function fetchTag(theme, version) {
  const what = `can't fetch ${theme.tag}${version} from ${REMOTE}`
  const shallow = git(what, ['rev-parse', '--is-shallow-repository']).trim() === 'true'
  git(what, ['fetch', '--quiet', '--no-tags', ...(shallow ? ['--depth=1'] : []), REMOTE, `${tagRefPrefix(theme)}${version}`])
}

/** The packed paths that differ between the tag and HEAD, one per line as git names them. */
function changedPaths(theme, version, objectId) {
  const what = `can't compare HEAD with ${theme.tag}${version}`
  const listing = git(what, ['diff', '--no-renames', '--name-only', objectId, 'HEAD', '--', ...theme.packedPaths])
  return listing.split('\n').filter((line) => line !== '')
}

function readManifest(theme) {
  try {
    return JSON.parse(readFileSync(manifestOf(theme), 'utf8'))
  } catch (error) {
    throw new Error(`can't read ${manifestOf(theme)} (run this at the repository root): ${messageOf(error)}`)
  }
}

/** The theme's theme.json version, refused unless it is MAJOR.MINOR.PATCH, digits only. */
function readVersion(theme) {
  const version = readManifest(theme)?.version
  if (typeof version === 'string' && VERSION_PATTERN.test(version)) return version
  throw new Error(`${manifestOf(theme)}'s version must be MAJOR.MINOR.PATCH, digits only (such as 1.1.0), not ${JSON.stringify(version)}`)
}

function check(theme) {
  const version = readVersion(theme)
  const decision = decide(theme, version, listReleaseTags(theme))
  if (decision.release === undefined) return decision
  fetchTag(theme, version)
  return releasedVerdict(theme, version, changedPaths(theme, version, decision.release.objectId))
}

/**
 * The lines to print: the verdict (a ::error:: line on a failure), then each changed path, indented.
 * Every path starts with themes/<theme>/ or packages/ (git quotes an unusual name on one line), so none of
 * them can be read as a workflow command.
 */
function report(verdict) {
  const head = verdict.ok ? `${NAME}: ${verdict.message}` : `::error::${NAME}: ${verdict.message}`
  return [head, ...(verdict.paths ?? []).map((path) => `  ${path}`)]
}

function main(argv) {
  if (argv.length > 0) throw new Error(USAGE)
  const verdicts = THEMES.map(check)
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
