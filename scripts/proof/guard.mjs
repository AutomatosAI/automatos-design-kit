#!/usr/bin/env node
// proof-guard: a proof run changes only its theme folder and its proof folder (PRD-261 B-06a, proof/README.md).
//
//   node scripts/proof/guard.mjs <base-ref> <id> <slug>
//   node scripts/proof/guard.mjs --ci
//
// The first form lists the diff from <base-ref> to HEAD (git diff <base-ref>...HEAD, at the repository root) and
// fails, one sentence per path, on anything outside themes/<slug>/ and proof/<id>/, with two exceptions:
// package-lock.json, when the only entries that changed are the new workspace's own (themes/<slug> and its
// node_modules/<package name> link), and the launcher's deletion of the paths proof/leak-paths.txt lists at the base.
// It also fails when a leak path is still at HEAD, when themes/<slug>/ was at the base already, and when the diff
// adds nothing under it.
//
// --ci is kit.yml's proof job: it reads the one proof/<id>/BASE the branch holds (the base tag's name), takes the
// slug from the pull request's branch, proof/<id>-<slug> (the HEAD_REF environment variable), writes
// theme=themes/<slug> to $GITHUB_OUTPUT, fetches the tag from origin and runs the first form against it.
//
// Exit codes: 0 in scope; 1 out of scope, or git failed; 2 usage. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const NAME = 'proof-guard'
const USAGE = 'usage: node scripts/proof/guard.mjs <base-ref> <id> <slug>   or   node scripts/proof/guard.mjs --ci'
const CI_FLAG = '--ci'
const REMOTE = 'origin'
const EXIT_OK = 0
const EXIT_FAILED = 1
const EXIT_USAGE = 2
/** Room for git's output: a lockfile or a long diff listing runs to megabytes. */
const GIT_MAX_BUFFER = 256 * 1024 * 1024
export const LEAK_LIST = 'proof/leak-paths.txt'
export const LOCKFILE = 'package-lock.json'
export const PROOF_ROOT = 'proof'
export const THEMES_ROOT = 'themes'
export const BASE_FILE = 'BASE'
export const BRANCH_PREFIX = 'proof/'
/** A proof's id (b06, b07): lower-case words joined by single dashes, at most 32 characters. */
export const ID_PATTERN = /^(?=.{1,32}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** A theme's folder, as `automatos-theme new` names it: 3 to 32 characters, lower-case words joined by single dashes. */
export const SLUG_PATTERN = /^(?=.{3,32}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
/** A base tag's name: letters, digits, dots, dashes and underscores, at most 100, never `..`. */
export const TAG_PATTERN = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const DELETED = 'D'
const STATUS_WORDS = Object.freeze({ A: 'added', D: 'deleted', M: 'changed', T: 'changed in type' })
/** What each glob token becomes in a regular expression, as git's glob pathspecs read it. */
const GLOB_PARTS = Object.freeze({ '**/': '(?:.*/)?', '/**': '/.*', '**': '.*', '*': '[^/]*', '?': '[^/]' })
const GLOB_TOKEN = /\*\*\/|\/\*\*$|\*\*|\*|\?|[.+^${}()|[\]\\]/g
const UNSAFE_TEXT = /[\u0000-\u001f\u007f"\\]/

// Leak paths: the list, and whether a path is one.

/** The leak list's entries: one path or glob a line; blank lines and # comments are skipped. */
export function parseLeakList(text) {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'))
}

/** A git glob as a regular expression over a whole repo-relative path. */
export function globToRegExp(glob) {
  return new RegExp(`^${glob.replace(GLOB_TOKEN, (token) => GLOB_PARTS[token] ?? `\\${token}`)}$`)
}

/** Whether a repo-relative path is one the entries name, or lies under one. */
export function isLeakPath(path, entries) {
  return entries.some((entry) => {
    const glob = entry.replace(/\/+$/, '')
    return globToRegExp(glob).test(path) || globToRegExp(`${glob}/**`).test(path)
  })
}

// The decision: pure functions of what git said.

/** A path as a sentence shows it: plain, or JSON-quoted when it holds a control character, a quote or a backslash. */
export function shown(path) {
  return UNSAFE_TEXT.test(path) ? JSON.stringify(path) : path
}

/** `git diff --name-status -z --no-renames` output as { status, path } pairs. */
export function parseNameStatus(output) {
  const fields = output.split('\0')
  return fields.flatMap((field, index) => (index % 2 === 0 && field !== '' ? [{ status: field[0], path: fields[index + 1] ?? '' }] : []))
}

const themeDir = (slug) => `${THEMES_ROOT}/${slug}/`
const proofDir = (id) => `${PROOF_ROOT}/${id}/`

/** Whether a path lies in the proof's own folders. */
export function inScope(path, id, slug) {
  return path.startsWith(themeDir(slug)) || path.startsWith(proofDir(id))
}

/** The sentence for one change, or none when the proof may make it. */
function changeFindings({ status, path }, id, slug, leakEntries) {
  if (inScope(path, id, slug) || path === LOCKFILE) return []
  if (status === DELETED && isLeakPath(path, leakEntries)) return []
  const what = STATUS_WORDS[status] ?? 'changed'
  return [`${shown(path)} is ${what}, outside ${themeDir(slug)} and ${proofDir(id)}: a proof changes only its theme folder and its proof folder.`]
}

function themeFolderFindings(changes, slug, themeAtBase) {
  const added = changes.some(({ status, path }) => status !== DELETED && path.startsWith(themeDir(slug)))
  return [
    ...(themeAtBase ? [`${themeDir(slug)} is at the base already: a proof builds a new theme in a new folder.`] : []),
    ...(added ? [] : [`the diff adds nothing under ${themeDir(slug)}: the proof's theme is missing.`]),
  ]
}

function leftLeakFindings(headFiles, leakEntries) {
  return headFiles.filter((path) => isLeakPath(path, leakEntries))
    .map((path) => `${shown(path)} is a leak path (${LEAK_LIST}) and is still at HEAD: the launcher removes every leak path before the run.`)
}

/**
 * Every sentence the guard prints: { changes, id, slug, leakEntries, headFiles, themeAtBase, lock } are the changes
 * from the base to HEAD, the proof's names, the leak list at the base, HEAD's files, whether themes/<slug> is at the
 * base, and the lock's own sentences (lockFindings). Empty when the proof is in scope.
 */
export function guardFindings({ changes, id, slug, leakEntries, headFiles, themeAtBase, lock }) {
  return [
    ...themeFolderFindings(changes, slug, themeAtBase),
    ...changes.flatMap((change) => changeFindings(change, id, slug, leakEntries)),
    ...lock,
    ...leftLeakFindings(headFiles, leakEntries),
  ]
}

// The lockfile: only the new workspace's own entries may change.

/** A value as JSON with every object's keys sorted, so two equal values give the same text. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

const sameJson = (a, b) => canonical(a) === canonical(b)
const keysOf = (...objects) => [...new Set(objects.flatMap((object) => Object.keys(object ?? {})))].sort()

/** Whether a changed lock entry is one the new workspace adds: its folder, or its package's link to the folder. */
function isWorkspaceEntry(key, before, after, slug, packageName) {
  if (before !== undefined || after === null || typeof after !== 'object') return false
  if (key === `${THEMES_ROOT}/${slug}`) return true
  return typeof packageName === 'string' && key === `node_modules/${packageName}`
    && after.link === true && after.resolved === `${THEMES_ROOT}/${slug}`
}

/** The lock's sentences: a changed top-level field, or a changed entry that isn't the new workspace's own. */
export function lockFindings(baseLock, headLock, slug, packageName) {
  const rule = `only themes/${slug} and its node_modules link may change in ${LOCKFILE}.`
  const top = keysOf(baseLock, headLock).filter((key) => key !== 'packages' && !sameJson(baseLock?.[key], headLock?.[key]))
  const base = baseLock?.packages ?? {}
  const head = headLock?.packages ?? {}
  const entries = keysOf(base, head).filter((key) => !sameJson(base[key], head[key]))
    .filter((key) => !isWorkspaceEntry(key, base[key], head[key], slug, packageName))
  return [
    ...top.map((key) => `${LOCKFILE}'s ${shown(key)} changed: ${rule}`),
    ...entries.map((key) => `${LOCKFILE}'s entry ${shown(key)} changed: ${rule}`),
  ]
}

// The CI form: which proof the branch holds.

/**
 * The proof a pull request's branch holds, from its name and its proof/<id>/BASE files ({ path, text } each):
 * { id, slug, base }. Throws a sentence when there is not exactly one, or a name is not a proof's.
 */
export function resolveProof(headRef, baseFiles) {
  if (baseFiles.length !== 1) {
    const found = baseFiles.map(({ path }) => path).join(', ') || 'none'
    throw new Error(`a proof branch holds exactly one ${PROOF_ROOT}/<id>/${BASE_FILE}; this one holds ${baseFiles.length} (${found}).`)
  }
  const [{ path, text }] = baseFiles
  const id = path.split('/')[1] ?? ''
  const base = text.trim()
  if (!ID_PATTERN.test(id)) throw new Error(`${shown(path)}: ${shown(id)} is not a proof id (lower-case words joined by dashes).`)
  if (!TAG_PATTERN.test(base)) throw new Error(`${shown(path)} must hold one tag name on one line, not ${JSON.stringify(text)}.`)
  const prefix = `${BRANCH_PREFIX}${id}-`
  if (!headRef.startsWith(prefix)) throw new Error(`the branch ${shown(headRef)} is not ${prefix}<slug>, as ${shown(path)} makes it.`)
  const slug = headRef.slice(prefix.length)
  if (!SLUG_PATTERN.test(slug)) throw new Error(`${shown(slug)} (from the branch) is not a theme folder's name, as automatos-theme new takes one.`)
  return { id, slug, base }
}

// The thin git and file wrappers.

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** git's output. A failure throws, saying what could not be done and what git said. */
function git(what, args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: GIT_MAX_BUFFER, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  } catch (error) {
    const said = typeof error?.stderr === 'string' && error.stderr.trim() !== '' ? error.stderr.trim() : messageOf(error)
    throw new Error(`${what} (git ${args[0]}): ${said}`)
  }
}

/** A file at a ref, or null when the ref has no such file. */
function fileAt(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: GIT_MAX_BUFFER })
  } catch {
    return null
  }
}

function jsonAt(ref, path) {
  const text = fileAt(ref, path)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function lockFromGit(baseRef, slug) {
  const baseLock = jsonAt(baseRef, LOCKFILE)
  const headLock = jsonAt('HEAD', LOCKFILE)
  if (baseLock === null || headLock === null) return [`${LOCKFILE} is not JSON at ${baseLock === null ? baseRef : 'HEAD'}.`]
  return lockFindings(baseLock, headLock, slug, jsonAt('HEAD', `${THEMES_ROOT}/${slug}/package.json`)?.name)
}

/** The guard's sentences for the repository in the working folder. */
export function runGuard(baseRef, id, slug) {
  const changes = parseNameStatus(git(`can't diff ${baseRef} with HEAD`, ['diff', '--name-status', '--no-renames', '-z', `${baseRef}...HEAD`]))
  const headFiles = git("can't list HEAD's files", ['ls-tree', '-r', '-z', '--name-only', 'HEAD']).split('\0').filter(Boolean)
  const themeAtBase = git(`can't list ${baseRef}'s themes`, ['ls-tree', '--name-only', baseRef, `${THEMES_ROOT}/${slug}`]).trim() !== ''
  const lock = changes.some(({ path }) => path === LOCKFILE) ? lockFromGit(baseRef, slug) : []
  const leakEntries = parseLeakList(fileAt(baseRef, LEAK_LIST) ?? '')
  return guardFindings({ changes, id, slug, leakEntries, headFiles, themeAtBase, lock })
}

/** Every proof/<id>/BASE in the working folder, as { path, text }. */
function proofBaseFiles() {
  if (!existsSync(PROOF_ROOT)) return []
  return readdirSync(PROOF_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => `${PROOF_ROOT}/${entry.name}/${BASE_FILE}`).filter((path) => existsSync(path)).sort()
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
}

// The command line.

function report(findings, scope) {
  if (findings.length === 0) return [`${NAME}: every change from ${scope} is in scope.`]
  return findings.map((finding) => `::error::${NAME}: ${finding}`)
}

function guardCommand(baseRef, id, slug) {
  const findings = runGuard(baseRef, id, slug)
  process.stdout.write(`${report(findings, `${baseRef} to HEAD for proof ${id} (themes/${slug})`).join('\n')}\n`)
  return findings.length === 0 ? EXIT_OK : EXIT_FAILED
}

function ciCommand() {
  const { id, slug, base } = resolveProof(process.env.HEAD_REF ?? '', proofBaseFiles())
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `theme=${THEMES_ROOT}/${slug}\n`)
  git(`can't fetch the tag ${base} from ${REMOTE}`, ['fetch', '--quiet', '--no-tags', REMOTE, `+refs/tags/${base}:refs/tags/${base}`])
  return guardCommand(`refs/tags/${base}`, id, slug)
}

/** The exit code for the arguments; prints the report or the usage. */
export function main(argv) {
  if (argv.length === 1 && argv[0] === CI_FLAG) return ciCommand()
  const [baseRef, id, slug] = argv
  if (argv.length !== 3 || !ID_PATTERN.test(id) || !SLUG_PATTERN.test(slug) || baseRef.startsWith('-')) {
    process.stderr.write(`${USAGE}\n`)
    return EXIT_USAGE
  }
  return guardCommand(baseRef, id, slug)
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

if (isMain(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    process.stdout.write(`::error::${NAME}: ${messageOf(error).split('\n').join(' ')}\n`)
    process.exitCode = EXIT_FAILED
  }
}
