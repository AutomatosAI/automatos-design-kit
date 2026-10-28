// proof-audit's reading of a Bash call (PRD-261 B-06a, proof/README.md): its command line as the shell splits it, into
// commands and their words (quotes taken off, escapes applied, a backslash and a line break joined), the words that
// may be paths, and each git invocation's own options and arguments. Plain Node, no dependencies.
import { posix } from 'node:path'

/** git's own options that take the next word (git -C <dir> log). */
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'])
/** git's own options that say where the repository is. */
const LOCATION_OPTIONS = new Set(['-C', '--git-dir', '--work-tree'])
const ATTACHED_LOCATION = /^--(?:git-dir|work-tree)=(.+)$/
/** A backslash before a line break: the shell joins the two lines. */
const LINE_CONTINUATION = /\\\r?\n/g
/**
 * The shell's tokens, in order, covering every character: a single-quoted string (literal), a double-quoted one, an
 * escaped character, what ends a command (&&, ||, ;, | or a line break), blanks, and anything else (& alone included).
 * A quote left open runs to the end of the line.
 */
const SHELL_TOKEN = /'([^']*)'?|"((?:[^"\\]|\\[\s\S])*)"?|\\([\s\S]?)|(&&|\|\||[;|\n])|([^\S\n]+)|([^\s'"\\;|&]+|&)/g
/** Inside double quotes a backslash escapes only $ ` " and \; before any other character it stays. */
const DOUBLE_QUOTE_ESCAPE = /\\([$`"\\])/g
/** A redirection (> out, 2>&1, &>/dev/null, <in): its target is the rest of the word, or the next word. */
const REDIRECTION = /^(?:\d*|&)(?:>>?|<)&?(.*)$/
/** Where a word splits further, as it may hold a path inside code (node -e "require('/etc/hosts')"). */
const WORD_SEPARATOR = /[\s'"`;|&<>()=,:]+/
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const GIT = 'git'

/** The text a token adds to the word being read: a quoted string's inside, an escaped character, or itself. */
function tokenText(single, double, escaped, plain) {
  if (single !== undefined) return single
  if (double !== undefined) return double.replace(DOUBLE_QUOTE_ESCAPE, '$1')
  return escaped ?? plain
}

/**
 * A command line as the shell reads it: its commands, each as its words, quotes taken off and escapes applied. A word
 * that still holds a backslash had it inside quotes, where the shell passes it on as written.
 */
export function shellCommands(command) {
  const commands = [[]]
  let word = null
  for (const [, single, double, escaped, end, blank, plain] of command.replace(LINE_CONTINUATION, '').matchAll(SHELL_TOKEN)) {
    if (end === undefined && blank === undefined) {
      word = (word ?? '') + tokenText(single, double, escaped, plain)
      continue
    }
    if (word !== null) commands.at(-1).push(word)
    word = null
    if (end !== undefined) commands.push([])
  }
  if (word !== null) commands.at(-1).push(word)
  return commands.filter((words) => words.length > 0)
}

/** The words of a command line that may be paths: the shell's words, each split further at quotes, brackets and the like. */
export function commandWords(command) {
  return shellCommands(command).flat().flatMap((word) => word.split(WORD_SEPARATOR)).filter((word) => word !== '')
}

/** A command's words without its redirections (> out, 2>&1): neither they nor their targets are the command's. */
function withoutRedirections(words) {
  const bare = (word) => word !== undefined && REDIRECTION.exec(word)?.[1] === ''
  return words.filter((word, index) => !REDIRECTION.test(word) && !bare(words[index - 1]))
}

/** Each git invocation in a command line, as { globals, args }: git's own options, then the command and its words. */
function gitParts(command) {
  return shellCommands(command).flatMap((words) => {
    const start = words.findIndex((word) => !ENV_ASSIGNMENT.test(word))
    if (start < 0 || posix.basename(words[start]) !== GIT) return []
    const rest = withoutRedirections(words.slice(start + 1))
    const at = rest.findIndex((word, index) => !word.startsWith('-') && !GIT_VALUE_OPTIONS.has(rest[index - 1]))
    return at < 0 ? [{ globals: rest, args: [] }] : [{ globals: rest.slice(0, at), args: rest.slice(at) }]
  })
}

/** The git invocations in a command line, each as its words after `git` and git's own options. */
export function gitInvocations(command) {
  return gitParts(command).map(({ args }) => args).filter((args) => args.length > 0)
}

/** The folders a command line's git invocations name as the repository (-C, --git-dir, --work-tree), as written. */
export function gitLocations(command) {
  return gitParts(command).flatMap(({ globals }) => globals.flatMap((word, index) => {
    if (LOCATION_OPTIONS.has(word)) return globals[index + 1] === undefined ? [] : [globals[index + 1]]
    const attached = ATTACHED_LOCATION.exec(word)
    return attached === null ? [] : [attached[1]]
  }))
}
