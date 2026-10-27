#!/usr/bin/env node
// proof-audit: what a proof run reached for, read from its transcript (PRD-261 B-06a, proof/README.md).
//
//   node scripts/proof/audit.mjs <transcript.jsonl> <clone dir> [--deny <file>]
//
// Reads the run's stream-json transcript (claude -p --output-format stream-json --verbose), takes every tool call
// from its assistant messages (a turn is one assistant message, counted from 1), and flags:
//   outside  a path outside the clone: an absolute one, one under ~ or $HOME, or a relative one with .. that leaves
//            the clone's root, in a file tool's path, a Glob pattern, a Grep glob, or a Bash command's words (a word
//            from / counts when its first folder exists at /, so a route such as /chat is not a path); Node's and
//            npm's own paths are allowed (TOOLCHAIN_PATHS, and the node binary's prefix)
//   leak     a path the clone's proof/leak-paths.txt lists, wherever it is named
//   git-ref  a git command naming a ref other than HEAD or the proof branch, naming every ref, reaching another
//            repository (fetch, pull, clone, ls-remote, remote, submodule, push), or printing history's patches with
//            no path to limit them (git log -p shows the launcher's deletion, the removed files' text)
//   web      a WebFetch or WebSearch call
//   deny     a line of the --deny file, found in a call (ignoring case); the file must be outside the clone and
//            outside this kit's checkout, and the report names its line number, never its text
// It prints the run's turns, cost and duration from the transcript's result line, then one line per flag (the flag,
// the turn, the call) and exits 1 on any flag.
//
// Exit codes: 0 clean; 1 flagged, or the transcript could not be read; 2 usage. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isLeakPath, isMain, LEAK_LIST, parseLeakList } from './guard.mjs'

const NAME = 'proof-audit'
const USAGE = 'usage: node scripts/proof/audit.mjs <transcript.jsonl> <clone dir> [--deny <file>]'
const EXIT_OK = 0
const EXIT_FLAGGED = 1
const EXIT_USAGE = 2
const KIT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
/** Paths outside the clone a run may name: npm's cache, the temporary folders and /dev/null. */
export const TOOLCHAIN_PATHS = Object.freeze(['~/.npm', '/tmp', '/private/tmp', '/dev/null'])
export const FLAGS = Object.freeze({ outside: 'outside', leak: 'leak', gitRef: 'git-ref', web: 'web', deny: 'deny' })
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
/** git's own options that take the next word (git -C <dir> log), and a command's that do (git log -n 5). */
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'])
const VALUE_OPTIONS = new Set(['-n', '--max-count', '--skip', '--author', '--committer', '--grep', '--since', '--until',
  '--format', '--pretty', '-S', '-G', '-L', '-U', '-m', '-F', '-o', '--output'])
const HEAD_NAMES = new Set(['HEAD', '@'])
const COMMAND_SEPARATOR = /&&|\|\||[;|\n]/
const SHELL_WORD = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
const WORD_SEPARATOR = /[\s'"`;|&<>()=,:]+/
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const PATH_LIKE = /^(?:\/[A-Za-z0-9._~@+-]|~(?:\/|$)|\$HOME\b|\$\{HOME\})|(?:^|\/)\.\.(?:\/|$)/
const HOME_PREFIX = /^(?:~|\$HOME\b|\$\{HOME\})/
const SUMMARY_MAX = 240

// The transcript.

/** The transcript's events, one JSON object a line. Throws on a line that is not JSON. */
export function parseTranscript(text) {
  return text.split('\n').flatMap((line, index) => {
    if (line.trim() === '') return []
    try {
      return [JSON.parse(line)]
    } catch {
      throw new Error(`line ${index + 1} of the transcript is not JSON.`)
    }
  })
}

/** Every tool call in the events, in order, as { turn, tool, input }: a turn is one assistant message (its id). */
export function toolCalls(events) {
  const assistant = events.filter((event) => event?.type === 'assistant')
  const ids = assistant.map((event, index) => event.message?.id ?? `#${index}`)
  let turn = 0
  const turns = ids.map((id, index) => (turn += index > 0 && ids[index - 1] === id ? 0 : 1))
  return assistant.flatMap((event, index) => (Array.isArray(event.message?.content) ? event.message.content : [])
    .filter((block) => block?.type === 'tool_use')
    .map((block) => ({ turn: turns[index], tool: String(block.name), input: block.input ?? {} })))
}

/** The run's numbers from its result line, or null when the transcript has none (the run did not finish). */
export function runSummary(events) {
  const result = [...events].reverse().find((event) => event?.type === 'result')
  if (result === undefined) return null
  return { turns: result.num_turns ?? null, costUsd: result.total_cost_usd ?? null, durationMs: result.duration_ms ?? null }
}

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

/** The words of a shell command that may be paths. */
export function commandWords(command) {
  return command.split(WORD_SEPARATOR).filter((word) => word !== '' && !word.includes('\\'))
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

/** The words of one shell command, quotes taken off. */
function shellWords(segment) {
  return Array.from(segment.matchAll(SHELL_WORD), (match) => match[1] ?? match[2] ?? match[3])
}

/** The git invocations in a command line, each as its words after `git` and git's own options. */
export function gitInvocations(command) {
  return command.split(COMMAND_SEPARATOR).map(shellWords).flatMap((words) => {
    const start = words.findIndex((word) => !ENV_ASSIGNMENT.test(word))
    if (start < 0 || posix.basename(words[start]) !== 'git') return []
    const rest = words.slice(start + 1)
    const at = rest.findIndex((word, index) => !word.startsWith('-') && !GIT_VALUE_OPTIONS.has(rest[index - 1]))
    return at < 0 ? [] : [rest.slice(at)]
  })
}

/** The revisions a word names: both ends of a range, the revision of rev:path. */
function revisionsOf(word) {
  const revision = word.includes(':') && !word.startsWith(':') ? word.slice(0, word.indexOf(':')) : word
  return revision.split(/\.\.\.?/).map((side) => side || 'HEAD')
}

/**
 * Why a git invocation reaches beyond the proof branch, or null: another repository, every ref, or a revision other
 * than HEAD or `branch`. `isPath(word)` says a word is a file in the clone (git log <file>), not a revision.
 */
export function gitRefProblem(args, branch, isPath) {
  const [command, ...rest] = args
  if (NETWORK_COMMANDS.has(command)) return `git ${command} reaches another repository`
  if (rest.some((word) => EVERY_REF_OPTION.test(word))) return `git ${command} names every ref`
  if (!REF_COMMANDS.has(command)) return null
  const end = rest.indexOf('--')
  const words = (end < 0 ? rest : rest.slice(0, end)).filter((word, index, all) => !word.startsWith('-') && !VALUE_OPTIONS.has(all[index - 1]))
  const allowed = (revision) => HEAD_NAMES.has(revision) || revision === branch
  const other = words.find((word) => !isPath(word) && !revisionsOf(word).every(allowed))
  if (other !== undefined) return `git ${command} names ${other}, not HEAD or ${branch || 'the proof branch'}`
  const limited = end >= 0 || words.some(isPath)
  const patches = HISTORY_COMMANDS.has(command) && rest.some((word) => PATCH_OPTION.test(word))
  return patches && !limited ? `git ${command} prints every commit's patch, the launcher's deletion included` : null
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

/** The paths a call names: its path fields, its globs' fixed heads, and a Bash command's path words. */
function namedPaths(call, rootEntries) {
  const fields = PATH_FIELDS.map((field) => call.input[field]).filter((value) => typeof value === 'string' && value !== '')
  const globs = globsOf(call).map(globHead).filter((head) => isPathLike(head))
  const command = call.input.command
  const words = typeof command === 'string' ? commandWords(command).filter((word) => isCommandPath(word, rootEntries)) : []
  return [...fields, ...globs, ...words]
}

/** Every word of a call that might name a leak path, path-like or not, and its globs and search pattern. */
function leakCandidates(call) {
  const words = typeof call.input.command === 'string' ? commandWords(call.input.command) : []
  const pattern = call.input[PATTERN_FIELD]
  return [...words, ...globsOf(call), ...(typeof pattern === 'string' ? [pattern] : [])]
}

/** One call's flags, each as "<flag>: <why>". `context` holds place, leakEntries, branch, isPath and deny. */
export function callFlags(call, context) {
  const { place, leakEntries, branch, isPath, deny } = context
  const outsideAndLeaks = pathFlags(namedPaths(call, place.rootEntries), place, leakEntries)
  const leakWords = leakCandidates(call).filter((word) => namesLeak(word, place, leakEntries))
    .map((word) => `${FLAGS.leak}: ${word}`)
  const git = typeof call.input.command === 'string'
    ? gitInvocations(call.input.command).map((args) => gitRefProblem(args, branch, isPath)).filter((problem) => problem !== null)
      .map((problem) => `${FLAGS.gitRef}: ${problem}`)
    : []
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

/** The audit's report lines and whether anything was flagged. */
export function audit(events, context) {
  const calls = toolCalls(events)
  const flagged = calls.flatMap((call) => callFlags(call, context).map((flag) => `${flag}\tturn ${call.turn}\t${summary(call)}`))
  const numbers = runSummary(events)
  const known = (value) => value ?? 'unknown'
  const head = numbers === null
    ? `${NAME}: ${calls.length} tool calls; the transcript has no result line (the run did not finish).`
    : `${NAME}: ${calls.length} tool calls; turns ${known(numbers.turns)}, cost ${known(numbers.costUsd)} USD, duration ${known(numbers.durationMs)} ms.`
  const verdict = flagged.length === 0 ? `${NAME}: clean.` : `${NAME}: ${flagged.length} flagged.`
  return { lines: [head, ...flagged, verdict], flagged: flagged.length > 0 }
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

function contextFor(clone, denyFile) {
  const roots = [...new Set([posix.resolve(clone), realOrSelf(posix.resolve(clone))])]
  const nodePrefix = posix.dirname(posix.dirname(process.execPath))
  const place = { roots, home: homedir(), toolchain: [...TOOLCHAIN_PATHS, nodePrefix], rootEntries: readdirSync('/') }
  const leakFile = posix.join(roots[0], LEAK_LIST)
  const leakEntries = existsSync(leakFile) ? parseLeakList(readFileSync(leakFile, 'utf8')) : []
  const deny = denyFile === undefined ? [] : parseDenyList(readFileSync(denyFile, 'utf8'))
  const isPath = (word) => existsSync(posix.resolve(roots[0], word))
  return { place, leakEntries, branch: branchOf(roots[0]), isPath, deny }
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
