// proof-audit's content check (PRD-261 B-06a, proof/README.md), the authoritative leak check. The command checks
// read what a call asked for, which a command can hide (an escape, an attached option, a script that runs git); this
// one reads what came back: every tool result in the transcript, against the leak files' text at the base.
//
// The base is the parent of the launcher's deletion commit, or the commit of the tag proof/<id>/BASE names (the two
// must agree when both are there); the clone's history holds it, one commit deep. From the base's tree, each leak file
// (proof/leak-paths.txt at the base) gives its fingerprints: each line, trimmed, of MIN_FINGERPRINT_LENGTH characters
// or more that no other text file of the base holds, whole or inside one of its lines (a line HUD shares with the
// Command reference is no fingerprint), cut to FINGERPRINT_MAX characters; and its whole text's sha256, when the
// file has a line no other file holds. A tool result holding a fingerprint, as written or as JSON escapes it, or
// whose whole text is a leak file's, is reported with the leak file's path and the turn, never the text.
// Plain Node, no dependencies.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isLeakPath, LEAK_LIST, parseLeakList, TAG_PATTERN } from './guard.mjs'
import { toolResults } from './transcript.mjs'

/** The shortest line that counts as a fingerprint: a shorter one ("## Looks", "}") is in too many other texts. */
export const MIN_FINGERPRINT_LENGTH = 32
/** A fingerprint is a line's first FINGERPRINT_MAX characters, so a tool that cuts a long line short still shows it. */
export const FINGERPRINT_MAX = 200
/** The subject of the launcher's deletion commit (scripts/proof/launch.sh, remove_leaks). */
export const REMOVAL_SUBJECT = /^proof\([a-z0-9-]+\): remove the leak paths before the run$/
const BASE_FILE = /^proof\/[^/]+\/BASE$/
const PROOF_ROOT = 'proof'
/** git reads a file as binary when its first 8000 bytes hold a NUL; so does the content check. */
const BINARY_PROBE_BYTES = 8000
const NUL = 0
const LINE_FEED = 0x0a
const GIT_MAX_BUFFER = 512 * 1024 * 1024
const LINE_BREAK = /\r?\n/
const NO_ENTRIES = Object.freeze([])

// The fingerprints: pure functions of the base's text.

const trimmedLines = (text) => text.split(LINE_BREAK).map((line) => line.trim())
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Entries ({ needle, file }) keyed by their needle's first MIN_FINGERPRINT_LENGTH characters. */
function needleIndex(entries) {
  const index = new Map()
  entries.forEach((entry) => {
    const key = entry.needle.slice(0, MIN_FINGERPRINT_LENGTH)
    index.set(key, [...(index.get(key) ?? NO_ENTRIES), entry])
  })
  return index
}

/** The index's entries whose needle `text` holds anywhere. */
function entriesIn(text, index) {
  const found = new Set()
  for (let at = 0; at + MIN_FINGERPRINT_LENGTH <= text.length; at += 1) {
    const entries = index.get(text.slice(at, at + MIN_FINGERPRINT_LENGTH))
    if (entries === undefined) continue
    entries.forEach((entry) => {
      if (text.startsWith(entry.needle, at)) found.add(entry)
    })
  }
  return [...found]
}

/** A file's candidate fingerprints: its trimmed lines long enough to count, each cut to FINGERPRINT_MAX, once each. */
function candidateLines({ path, text }) {
  const lines = trimmedLines(text).filter((line) => line.length >= MIN_FINGERPRINT_LENGTH).map((line) => line.slice(0, FINGERPRINT_MAX))
  return [...new Set(lines)].map((needle) => ({ needle, file: path }))
}

/** Whether a leak file's whole text is a fingerprint: long enough, and holding a line no other file holds. */
const ownsText = ({ text }, others) => text.trim().length >= MIN_FINGERPRINT_LENGTH
  && trimmedLines(text).some((line) => line !== '' && !others.has(line))

/**
 * The leak files' fingerprints. `leakFiles` are the leak files' texts at the base ({ path, text }); `otherLines` the
 * trimmed lines of every other text file of the base. Returns { lines: [{ file, line }], hashes: [{ file, sha256 }],
 * files }: the lines no other file holds, whole or inside a line; the whole texts' sha256; how many leak files.
 */
export function fingerprints({ leakFiles, otherLines }) {
  const others = new Set(otherLines)
  const candidates = leakFiles.flatMap(candidateLines)
  const index = needleIndex(candidates)
  const shared = new Set([...others].filter((line) => line.length >= MIN_FINGERPRINT_LENGTH)
    .flatMap((line) => entriesIn(line, index)).map((entry) => entry.needle))
  return {
    lines: candidates.filter(({ needle }) => !shared.has(needle)).map(({ needle, file }) => ({ file, line: needle })),
    hashes: leakFiles.filter((file) => ownsText(file, others)).map(({ path, text }) => ({ file: path, sha256: sha256(text.trim()) })),
    files: leakFiles.length,
  }
}

/** A line as written, and as JSON writes it inside a string (a script that prints JSON.stringify of a file). */
const variantsOf = (line) => [...new Set([line, JSON.stringify(line).slice(1, -1)])]

/** Every { file, turn } where a tool result held a leak file's fingerprint, once each, in order. Never the text. */
export function findLeakContent(events, prints) {
  const index = needleIndex(prints.lines.flatMap(({ file, line }) => variantsOf(line).map((needle) => ({ needle, file }))))
  const byHash = new Map(prints.hashes.map(({ file, sha256: hash }) => [hash, file]))
  const seen = toolResults(events).flatMap(({ turn, text }) => {
    const whole = byHash.get(sha256(text.trim()))
    const files = [...entriesIn(text, index).map((entry) => entry.file), ...(whole === undefined ? [] : [whole])]
    return files.map((file) => ({ file, turn }))
  })
  return [...new Map(seen.map((hit) => [`${hit.turn}\t${hit.file}`, hit])).values()]
}

// The base, read from the clone's history.

/** git's output in the clone, as bytes. A failure throws, saying what git said. */
function git(clone, args, input) {
  try {
    return execFileSync('git', ['-C', clone, ...args], { input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: GIT_MAX_BUFFER })
  } catch (error) {
    const said = error?.stderr?.toString().trim() || (error instanceof Error ? error.message : String(error))
    throw new Error(`git ${args[0]} failed in the clone: ${said.split('\n')[0]}`)
  }
}

const gitText = (clone, args) => git(clone, args).toString('utf8')

/** The parent of the launcher's deletion commit (the oldest commit with its subject), or null. */
function removalParent(clone) {
  const removals = gitText(clone, ['log', '--format=%P%x09%s', 'HEAD']).split('\n')
    .map((line) => line.split('\t')).filter(([, subject]) => REMOVAL_SUBJECT.test(subject ?? ''))
  const oldest = removals.at(-1)
  return oldest === undefined ? null : (oldest[0].split(' ')[0] || null)
}

/** The commit of the tag the clone's one proof/<id>/BASE names, or null. */
function taggedBase(clone) {
  const files = gitText(clone, ['ls-tree', '-r', '--name-only', 'HEAD', '--', PROOF_ROOT]).split('\n').filter((path) => BASE_FILE.test(path))
  if (files.length !== 1) return null
  const tag = gitText(clone, ['show', `HEAD:${files[0]}`]).trim()
  if (!TAG_PATTERN.test(tag)) return null
  try {
    return gitText(clone, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]).trim() || null
  } catch {
    return null
  }
}

/** The base commit of the proof in `clone`. Throws when the clone has none, or two that disagree. */
export function findBase(clone) {
  const parent = removalParent(clone)
  const tagged = taggedBase(clone)
  if (parent !== null && tagged !== null && parent !== tagged) {
    throw new Error(`the launcher's deletion commit follows ${parent}, but the base tag is at ${tagged}`)
  }
  const base = parent ?? tagged
  if (base === null) throw new Error("the clone has neither the launcher's deletion commit nor a proof/<id>/BASE tag")
  return base
}

/** `git cat-file --batch` output as each object's bytes, in order; a missing object is empty. */
export function parseBatch(output) {
  const objects = []
  let at = 0
  while (at < output.length) {
    const end = output.indexOf(LINE_FEED, at)
    if (end < 0) break
    const size = Number(output.toString('utf8', at, end).split(' ')[2])
    const known = Number.isInteger(size)
    objects.push(known ? output.subarray(end + 1, end + 1 + size) : Buffer.alloc(0))
    at = known ? end + 2 + size : end + 1
  }
  return objects
}

/** The base's text files, as { path, text }: every file of its tree whose first bytes hold no NUL. */
export function baseTexts(clone, base) {
  const files = gitText(clone, ['ls-tree', '-r', '-z', base]).split('\0').filter(Boolean).flatMap((entry) => {
    const tab = entry.indexOf('\t')
    const [, type, object] = entry.slice(0, tab).split(' ')
    return type === 'blob' ? [{ path: entry.slice(tab + 1), object }] : []
  })
  if (files.length === 0) return []
  const blobs = parseBatch(git(clone, ['cat-file', '--batch'], `${files.map(({ object }) => object).join('\n')}\n`))
  return files.map((file, index) => ({ path: file.path, data: blobs[index] ?? Buffer.alloc(0) }))
    .filter(({ data }) => !data.subarray(0, BINARY_PROBE_BYTES).includes(NUL))
    .map(({ path, data }) => ({ path, text: data.toString('utf8') }))
}

/** The leak files' fingerprints at `base`: the files its leak list names, against every other text file of its tree. */
export function baseFingerprints(clone, base) {
  const texts = baseTexts(clone, base)
  const list = texts.find(({ path }) => path === LEAK_LIST)
  if (list === undefined) throw new Error(`the base ${base} has no ${LEAK_LIST}`)
  const entries = parseLeakList(list.text)
  const leakFiles = texts.filter(({ path }) => isLeakPath(path, entries))
  const otherLines = texts.filter(({ path }) => !isLeakPath(path, entries)).flatMap(({ text }) => trimmedLines(text))
  return fingerprints({ leakFiles, otherLines })
}
