#!/usr/bin/env node
// proof-audit: what a proof run saw and reached for, read from its transcript (PRD-261 B-06a, proof/README.md).
//
//   node scripts/proof/audit.mjs <transcript.jsonl> <clone dir> [--deny <file>]
//
// Reads the run's stream-json transcript (claude -p --output-format stream-json --verbose; transcript.mjs) and flags:
//   leak-content  the authoritative check (leak-content.mjs): a tool result that showed the run a leak file's text,
//                 matched against the leak files' lines at the base, read from the clone's history; the report names
//                 the leak file and the turn, never the text. It is flagged too when the base can't be read
// and, as secondary signals, from every tool call in its assistant messages (a turn is one assistant message, counted
// from 1; a Bash command read as the shell reads it, shell.mjs):
//   outside  a path outside the clone: an absolute one, one under ~ or $HOME, or a relative one with .. that leaves
//            the clone's root, in a file tool's path, a Glob pattern, a Grep glob, or a Bash command's words (a word
//            from / counts when its first folder exists at /, so a route such as /chat is not a path; a word that
//            keeps a backslash inside quotes is passed on as written, a regular expression, not a path); Node's and
//            npm's own paths are allowed (TOOLCHAIN_PATHS, and the node binary's prefix)
//   leak     a path the clone's proof/leak-paths.txt lists, wherever it is named, backslashes taken out
//   git-ref  a git command naming a ref other than HEAD or the proof branch, naming every ref, reaching another
//            repository (fetch, pull, clone, ls-remote, remote, submodule, push), pointed at a folder outside the
//            clone (-C, --git-dir, --work-tree; the toolchain's folders too), or printing history's patches for a
//            path outside the proof's folders, or for none (git log -p shows the launcher's deletion, the removed
//            files' text)
//   web      a WebFetch or WebSearch call
//   deny     a line of the --deny file, found in a call (ignoring case); the file must be outside the clone and
//            outside this kit's checkout, and the report names its line number, never its text
// It prints the run's turns, cost and duration from the transcript's result line and what the content check holds,
// then one line per flag (the flag and the turn, and for a call's flag the call) and exits 1 on any flag.
//
// Exit codes: 0 clean; 1 flagged, or the transcript could not be read; 2 usage. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASE_FILE, isLeakPath, isMain, LEAK_LIST, parseLeakList, PROOF_ROOT, resolveProof, shown, THEMES_ROOT,
} from './guard.mjs'
import { baseFingerprints, findBase, findLeakContent } from './leak-content.mjs'
import { commandWords, gitInvocations, gitLocations } from './shell.mjs'
import { parseTranscript, runSummary, toolCalls } from './transcript.mjs'

const NAME = 'proof-audit'
const USAGE = 'usage: node scripts/proof/audit.mjs <transcript.jsonl> <clone dir> [--deny <file>]'
const EXIT_OK = 0
const EXIT_FLAGGED = 1
const EXIT_USAGE = 2
const KIT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
/** Paths outside the clone a run may name: npm's cache, the temporary folders and /dev/null. */
export const TOOLCHAIN_PATHS = Object.freeze(['~/.npm', '/tmp', '/private/tmp', '/dev/null'])
export const FLAGS = Object.freeze({
  leakContent: 'leak-content', outside: 'outside', leak: 'leak', gitRef: 'git-ref', web: 'web', deny: 'deny',
})
export const WEB_TOOLS = Object.freeze(['WebFetch', 'WebSearch'])
/** The input fields that hold a path (Read, Write, Edit, NotebookEdit, Glob, Grep), and Grep's file glob. */
const PATH_FIELDS = ['file_path', 'notebook_path', 'path']
const GLOB_FIELD = 'glob'
/** The tool whose `pattern` is a path glob; Grep's `pattern` is a regular expression over file text. */
const GLOB_TOOL = 'Glob'
const PATTERN_FIELD = 'pattern'
const NETWORK_COMMANDS = new Set(['fetch', 'pull', 'clone', 'ls-remote', 'remote', 'submodule', 'push'])
/** git commands whose words before `--` name revisions. */
const REF_COMMANDS = new Set([
  'log', 'diff', 'show', 'checkout', 'switch', 'merge', 'rebase', 'reset', 'branch', 'cat-file', 'rev-parse', 'rev-list',
  'ls-tree', 'archive', 'cherry-pick', 'restore', 'worktree', 'tag', 'grep', 'blame', 'format-patch', 'bundle',
  'shortlog', 'whatchanged', 'describe', 'reflog', 'stash', 'diff-tree', 'merge-base', 'read-tree', 'notes',
])
const EVERY_REF_OPTION = /^--(?:all|branches|tags|remotes|glob|reflog)(?:=|$)/
/** git commands that walk history, and the options that make them print each commit's patch. */
const HISTORY_COMMANDS = new Set(['log', 'whatchanged'])
const PATCH_OPTION = /^(?:-p|-u|-U\d*|--patch|--patch-with-stat|--patch-with-raw|--unified(?:=\d+)?)$/
/** The options that take the next word as their value (git log -n 5), for a command VALUE_OPTIONS does not name. */
const DEFAULT_VALUE_OPTIONS = new Set(['-n', '--max-count', '--skip', '--author', '--committer', '--grep', '--since', '--until',
  '--format', '--pretty', '-S', '-G', '-L', '-U', '-m', '-F', '-o', '--output'])
/** The commands whose value-taking options differ: git grep's (its -o is --only-matching and takes none). */
const VALUE_OPTIONS = new Map([
  ['grep', new Set(['-e', '-f', '--regexp', '-m', '--max-count', '-A', '-B', '-C', '--context', '--after-context',
    '--before-context', '--max-depth', '--threads'])],
])
/**
 * git grep's pattern is its first word unless an option gives it: -e, -ePATTERN, -f, -fFILE, --regexp,
 * --regexp=PATTERN, or a bundle of short options holding -e or -f (-ie); then every word may be a revision.
 */
const GREP_PATTERN_OPTION = /^(?:-[A-Za-z]*[ef]|--regexp(?:=|$))/
const HEAD_NAMES = new Set(['HEAD', '@'])
const BACKSLASHES = /\\/g
const PATH_LIKE = /^(?:\/[A-Za-z0-9._~@+-]|~(?:\/|$)|\$HOME\b|\$\{HOME\})|(?:^|\/)\.\.(?:\/|$)/
const HOME_PREFIX = /^(?:~|\$HOME\b|\$\{HOME\})/
const SUMMARY_MAX = 240

// Paths.

const within = (path, root) => path === root || path.startsWith(`${root.replace(/\/+$/, '')}/`)

/** A path as an absolute one: ~ and $HOME from `home`, a relative one from the clone's root. */
export function absolutePath(path, clone, home) {
  const expanded = path.replace(HOME_PREFIX, home)
  return posix.isAbsolute(expanded) ? posix.normalize(expanded) : posix.resolve(clone, expanded)
}

/**
 * Where a path lies: 'clone', 'toolchain' or 'outside'. `place` holds roots (the clone's paths, as given and real),
 * home, toolchain (paths a run may name outside the clone) and rootEntries (the names at /).
 */
export function placeOf(path, place) {
  const full = absolutePath(path, place.roots[0], place.home)
  if (place.roots.some((root) => within(full, root))) return 'clone'
  const toolchain = place.toolchain.map((prefix) => absolutePath(prefix, place.roots[0], place.home))
  return toolchain.some((prefix) => within(full, prefix)) ? 'toolchain' : 'outside'
}

/** Whether a path names a leak path: inside the clone from its root, or anywhere by any tail of it. */
export function namesLeak(path, place, leakEntries) {
  const full = absolutePath(path.replace(/^\.\//, ''), place.roots[0], place.home)
  const root = place.roots.find((candidate) => within(full, candidate))
  const relative = root === undefined ? full.replace(/^\/+/, '') : posix.relative(root, full)
  const parts = relative.split('/')
  return parts.some((_, index) => isLeakPath(parts.slice(index).join('/'), leakEntries))
}

const isPathLike = (word) => PATH_LIKE.test(word)

/** Whether a command's path-like word is a path: one from / only when its first folder is one `rootEntries` holds. */
export function isCommandPath(word, rootEntries) {
  if (!isPathLike(word)) return false
  if (!word.startsWith('/')) return true
  return rootEntries.includes(word.split('/')[1] ?? '')
}

/** A glob's fixed head: its words up to the first wildcard. */
const globHead = (glob) => glob.split(/[*?[{]/)[0]

// git.

/** The revisions a word names: both ends of a range, the revision of rev:path. */
function revisionsOf(word) {
  const revision = word.includes(':') && !word.startsWith(':') ? word.slice(0, word.indexOf(':')) : word
  return revision.split(/\.\.\.?/).map((side) => side || 'HEAD')
}

/** A git command's words before `--` that are neither options nor an option's value. */
function operands(command, rest) {
  const end = rest.indexOf('--')
  const options = VALUE_OPTIONS.get(command) ?? DEFAULT_VALUE_OPTIONS
  return (end < 0 ? rest : rest.slice(0, end)).filter((word, index, all) => !word.startsWith('-') && !options.has(all[index - 1]))
}

/** Whether a pathspec lies inside one of `folders` (themes/<slug>, proof/<id>), from the clone's root. */
function insideFolders(spec, folders) {
  const path = posix.normalize(spec)
  return folders.some((folder) => path === folder || path.startsWith(`${folder}/`))
}

/**
 * Why a history walk may print the launcher's deletion, or null: it prints patches (git log -p) with no pathspec, or
 * with one outside the proof's own folders, where a leak path may be.
 */
function patchProblem(command, rest, paths, proofFolders) {
  if (!HISTORY_COMMANDS.has(command) || !rest.some((word) => PATCH_OPTION.test(word))) return null
  const end = rest.indexOf('--')
  const pathspecs = [...paths, ...(end < 0 ? [] : rest.slice(end + 1))]
  if (pathspecs.length === 0) return `git ${command} prints every commit's patch, the launcher's deletion included`
  const outside = pathspecs.find((spec) => !insideFolders(spec, proofFolders))
  const folders = proofFolders.map((folder) => `${folder}/`).join(' and ') || "the proof's folders"
  return outside === undefined ? null : `git ${command} prints history's patches for ${outside}, outside ${folders}`
}

/**
 * Why a git invocation reaches beyond the proof branch, or null: another repository, every ref, a revision other than
 * HEAD or `branch`, or history's patches beyond `proofFolders`. `isPath(word)` says a word is a file in the clone (git
 * log <file>), not a revision.
 */
export function gitRefProblem(args, branch, isPath, proofFolders = []) {
  const [command, ...rest] = args
  if (NETWORK_COMMANDS.has(command)) return `git ${command} reaches another repository`
  if (rest.some((word) => EVERY_REF_OPTION.test(word))) return `git ${command} names every ref`
  if (!REF_COMMANDS.has(command)) return null
  const before = operands(command, rest)
  const words = command === 'grep' && !rest.some((word) => GREP_PATTERN_OPTION.test(word)) ? before.slice(1) : before
  const allowed = (revision) => HEAD_NAMES.has(revision) || revision === branch
  const other = words.find((word) => !isPath(word) && !revisionsOf(word).every(allowed))
  if (other !== undefined) return `git ${command} names ${other}, not HEAD or ${branch || 'the proof branch'}`
  return patchProblem(command, rest, words.filter(isPath), proofFolders)
}

// The flags.

function pathFlags(paths, place, leakEntries) {
  return paths.flatMap((path) => [
    ...(placeOf(path, place) === 'outside' ? [`${FLAGS.outside}: ${path}`] : []),
    ...(namesLeak(path, place, leakEntries) ? [`${FLAGS.leak}: ${path}`] : []),
  ])
}

/** A call's path globs: a Glob's pattern and a Grep's file glob. */
function globsOf(call) {
  const pattern = call.tool === GLOB_TOOL ? [call.input[PATTERN_FIELD]] : []
  return [...pattern, call.input[GLOB_FIELD]].filter((value) => typeof value === 'string')
}

/**
 * The paths a call names: its path fields, its globs' fixed heads, and a Bash command's path words. A word that keeps
 * a backslash after the shell has read it had it inside quotes, so the program gets it as written: a regular
 * expression (/\.ts$/), not a path.
 */
function namedPaths(call, rootEntries) {
  const fields = PATH_FIELDS.map((field) => call.input[field]).filter((value) => typeof value === 'string' && value !== '')
  const globs = globsOf(call).map(globHead).filter((head) => isPathLike(head))
  const command = call.input.command
  const words = typeof command === 'string'
    ? commandWords(command).filter((word) => !word.includes('\\') && isCommandPath(word, rootEntries))
    : []
  return [...fields, ...globs, ...words]
}

/**
 * Every word of a call that might name a leak path, path-like or not, and its globs and search pattern, each with its
 * backslashes taken out: a program may read an escape the shell left (a JavaScript string's \m is m).
 */
function leakCandidates(call) {
  const words = typeof call.input.command === 'string' ? commandWords(call.input.command) : []
  const pattern = call.input[PATTERN_FIELD]
  return [...words, ...globsOf(call), ...(typeof pattern === 'string' ? [pattern] : [])].map((word) => word.replace(BACKSLASHES, ''))
}

/** A Bash command's git flags: git pointed outside the clone, and each invocation's ref problem. */
function gitFlags(command, { place, branch, isPath, proofFolders }) {
  const elsewhere = gitLocations(command).filter((folder) => placeOf(folder, place) !== 'clone')
    .map((folder) => `git works in ${folder}, outside the clone`)
  const problems = gitInvocations(command).map((args) => gitRefProblem(args, branch, isPath, proofFolders))
    .filter((problem) => problem !== null)
  return [...elsewhere, ...problems].map((problem) => `${FLAGS.gitRef}: ${problem}`)
}

/**
 * One call's flags, each as "<flag>: <why>". `context` holds place, leakEntries, branch, proofFolders, isPath and
 * deny.
 */
export function callFlags(call, context) {
  const { place, leakEntries, deny } = context
  const outsideAndLeaks = pathFlags(namedPaths(call, place.rootEntries), place, leakEntries)
  const leakWords = leakCandidates(call).filter((word) => namesLeak(word, place, leakEntries))
    .map((word) => `${FLAGS.leak}: ${word}`)
  const git = gitFlags(typeof call.input.command === 'string' ? call.input.command : '', context)
  const web = WEB_TOOLS.includes(call.tool) ? [`${FLAGS.web}: ${call.tool}`] : []
  const haystack = JSON.stringify(call.input).toLowerCase()
  const denied = deny.flatMap(({ line, pattern }) => (haystack.includes(pattern) ? [`${FLAGS.deny}: line ${line} of the deny file`] : []))
  return [...new Set([...outsideAndLeaks, ...leakWords, ...git, ...web, ...denied])]
}

/** The deny file's patterns: one a line, lower-cased, with their line numbers; blank lines and # comments skipped. */
export function parseDenyList(text) {
  return text.split('\n').map((raw, index) => ({ line: index + 1, pattern: raw.trim().toLowerCase() }))
    .filter(({ pattern }) => pattern !== '' && !pattern.startsWith('#'))
}

/** A call on one line, cut to SUMMARY_MAX characters. */
export function summary(call) {
  const text = JSON.stringify(call.input)
  return `${call.tool} ${text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX)}…` : text}`
}

/**
 * The content check's flags: each leak file a tool result showed, with the turn, never the text; or why the check
 * could not run. None when the context holds neither (a test of the command checks alone).
 */
function contentFlags(events, { fingerprints, contentError }) {
  if (contentError !== undefined) return [`${FLAGS.leakContent}: ${contentError}`]
  if (fingerprints === undefined) return []
  return findLeakContent(events, fingerprints)
    .map(({ file, turn }) => `${FLAGS.leakContent}: ${shown(file)} seen in turn ${turn ?? 'unknown'}`)
}

/** What the content check holds, as a report line; none without fingerprints. */
function contentHead({ fingerprints }) {
  if (fingerprints === undefined) return []
  const { lines, hashes, files } = fingerprints
  return [`${NAME}: the content check holds ${lines.length} lines and ${hashes.length} whole texts of ${files} leak files.`]
}

/** The audit's report lines and whether anything was flagged. */
export function audit(events, context) {
  const calls = toolCalls(events)
  const flagged = [
    ...contentFlags(events, context),
    ...calls.flatMap((call) => callFlags(call, context).map((flag) => `${flag}\tturn ${call.turn}\t${summary(call)}`)),
  ]
  const numbers = runSummary(events)
  const known = (value) => value ?? 'unknown'
  const head = numbers === null
    ? `${NAME}: ${calls.length} tool calls; the transcript has no result line (the run did not finish).`
    : `${NAME}: ${calls.length} tool calls; turns ${known(numbers.turns)}, cost ${known(numbers.costUsd)} USD, duration ${known(numbers.durationMs)} ms.`
  const verdict = flagged.length === 0 ? `${NAME}: clean.` : `${NAME}: ${flagged.length} flagged.`
  return { lines: [head, ...contentHead(context), ...flagged, verdict], flagged: flagged.length > 0 }
}

// The command line.

function realOrSelf(path) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function branchOf(clone) {
  try {
    return execFileSync('git', ['-C', clone, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/** The audit's inputs from the command line, or a usage sentence. */
export function parseArgs(argv) {
  const [transcript, clone, flag, denyFile, ...extra] = argv
  if (transcript === undefined || clone === undefined || extra.length > 0) return { error: USAGE }
  if (flag !== undefined && (flag !== '--deny' || denyFile === undefined)) return { error: USAGE }
  return { transcript, clone, denyFile }
}

/** The proof's own folders in the clone (themes/<slug>, proof/<id>), from its branch and its one proof/<id>/BASE. */
function proofFoldersOf(clone, branch) {
  const proofs = posix.join(clone, PROOF_ROOT)
  const baseFiles = existsSync(proofs)
    ? readdirSync(proofs, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      .map((entry) => `${PROOF_ROOT}/${entry.name}/${BASE_FILE}`).filter((path) => existsSync(posix.join(clone, path)))
      .map((path) => ({ path, text: readFileSync(posix.join(clone, path), 'utf8') }))
    : []
  try {
    const { id, slug } = resolveProof(branch, baseFiles)
    return [`${THEMES_ROOT}/${slug}`, `${PROOF_ROOT}/${id}`]
  } catch {
    return []
  }
}

/** The content check's fingerprints from the clone's history, or why they could not be read. */
function contentOf(clone) {
  try {
    return { fingerprints: baseFingerprints(clone, findBase(clone)) }
  } catch (error) {
    return { contentError: `the content check could not run: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function contextFor(clone, denyFile) {
  const roots = [...new Set([posix.resolve(clone), realOrSelf(posix.resolve(clone))])]
  const nodePrefix = posix.dirname(posix.dirname(process.execPath))
  const place = { roots, home: homedir(), toolchain: [...TOOLCHAIN_PATHS, nodePrefix], rootEntries: readdirSync('/') }
  const leakFile = posix.join(roots[0], LEAK_LIST)
  const leakEntries = existsSync(leakFile) ? parseLeakList(readFileSync(leakFile, 'utf8')) : []
  const deny = denyFile === undefined ? [] : parseDenyList(readFileSync(denyFile, 'utf8'))
  const isPath = (word) => existsSync(posix.resolve(roots[0], word))
  const branch = branchOf(roots[0])
  return { place, leakEntries, branch, proofFolders: proofFoldersOf(roots[0], branch), isPath, deny, ...contentOf(roots[0]) }
}

/** Why a file the audit reads must not be where it is, or null: inside one of `roots`, which `where` names. */
function misplaced(label, file, roots, where) {
  const full = realOrSelf(posix.resolve(file))
  const inside = roots.find((root) => within(full, root.replace(/\/+$/, '')))
  return inside === undefined ? null : `${label} ${file} is inside ${inside}: keep it outside ${where}.`
}

/** The exit code for the arguments; prints the report or the usage. */
export function main(argv) {
  const args = parseArgs(argv)
  if (args.error !== undefined) {
    process.stderr.write(`${args.error}\n`)
    return EXIT_USAGE
  }
  const roots = [posix.resolve(args.clone), realOrSelf(posix.resolve(args.clone))]
  const problem = [misplaced('the transcript', args.transcript, roots, 'the clone'),
    args.denyFile === undefined ? null : misplaced('the deny file', args.denyFile, [...roots, realOrSelf(KIT_ROOT)], "the clone and this kit's checkout")]
    .find((text) => text !== null)
  if (problem !== undefined) {
    process.stderr.write(`${NAME}: ${problem}\n`)
    return EXIT_USAGE
  }
  const report = audit(parseTranscript(readFileSync(args.transcript, 'utf8')), contextFor(args.clone, args.denyFile))
  process.stdout.write(`${report.lines.join('\n')}\n`)
  return report.flagged ? EXIT_FLAGGED : EXIT_OK
}

if (isMain(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    process.stdout.write(`${NAME}: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = EXIT_FLAGGED
  }
}
