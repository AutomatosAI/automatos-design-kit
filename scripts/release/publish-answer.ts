/**
 * The publish run's reading of the Marketplace's answer (theme-publish.yml, "Publish to the Marketplace"): what
 * core said to the POST of one package to `/api/marketplace/themes/publish`.
 *
 *   node scripts/release/publish-answer.ts <curl exit> <http status> <answer file> <id> <version> <digest>
 *
 * Published or unchanged is a 200 whose JSON is `{"status": "published" | "unchanged", id, version, digest}` for
 * this package's id, version and digest: it prints `status=<status>` on stdout (the step appends it to
 * $GITHUB_OUTPUT) and a plain line on stderr, exit 0. Anything else is one ::error:: line on stderr with the HTTP
 * status, what it means and core's error code(s), exit 1, and the run releases nothing. The answer never held the
 * key, and nothing from it is printed unless it is a code core's error shape gives or plain, echo-safe text.
 * Standard library only.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ACCEPTED = ['published', 'unchanged'] as const
export type Accepted = (typeof ACCEPTED)[number]
export const EXIT_ACCEPTED = 0
export const EXIT_REFUSED = 1
export const EXIT_USAGE = 2
const HTTP_OK = '200'
const USAGE = 'Usage: node scripts/release/publish-answer.ts <curl exit> <http status> <answer file> <id> <version> <digest>'
/**
 * The refusals the publish endpoint gives, and what each means for the run. Every one fails the run and releases
 * nothing; none is retried here (a 503 for busy reviews is a run to re-run later, and core answers the same bytes
 * `unchanged`, so a re-run releases what an earlier run published).
 */
export const MEANINGS: Readonly<Record<string, string>> = {
  400: "the request wasn't the multipart form the endpoint takes",
  401: 'the publish key is missing or wrong (THEME_PUBLISH_KEY, or the hashes the Marketplace holds)',
  403: "the theme's publisher isn't one the Marketplace publishes for or is someone else's, or the Marketplace is off",
  409: 'the version is not above the highest one the Marketplace holds, is closed, or is being published already',
  413: 'the request is over the size the Marketplace takes',
  422: 'the Marketplace refused the package, its signature or its review summary, or a part is missing',
  429: 'the publish quota for today is spent',
  503: "the Marketplace's publish endpoint is not configured, or is busy: re-run the failed job later",
}
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/
const UNSAFE = /[\x00-\x1f\x7f\x85\u2028\u2029]|::/g
const MESSAGE_MAX = 200

export type Answer = { readonly ok: true; readonly status: Accepted } | { readonly ok: false; readonly error: string }

export interface Expected {
  readonly id: string
  readonly version: string
  readonly digest: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsed(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

/** Text from the answer as one safe line: no line break, no `::`, at most MESSAGE_MAX characters. */
function plain(text: string): string {
  const flat = text.replace(UNSAFE, ' ').trim()
  return flat.length > MESSAGE_MAX ? `${flat.slice(0, MESSAGE_MAX - 1)}…` : flat
}

/** Core's error code(s) from its error shape: `detail.code`, each `detail.errors[].code`, or `detail` as text. */
export function errorCodes(body: string): string {
  const raw = parsed(body)
  const detail = isRecord(raw) ? raw.detail : undefined
  if (typeof detail === 'string') return plain(detail)
  if (!isRecord(detail)) return 'no error code in the answer'
  const listed = Array.isArray(detail.errors) ? detail.errors.map((item) => (isRecord(item) ? item.code : undefined)) : []
  const codes = [detail.code, ...listed].filter((code): code is string => typeof code === 'string' && CODE.test(code))
  if (codes.length > 0) return [...new Set(codes)].join(', ')
  return typeof detail.message === 'string' ? plain(detail.message) : 'no error code in the answer'
}

/** A 200's body: accepted when it names one of ACCEPTED for exactly this package. */
function acceptedAnswer(body: string, expected: Expected): Answer {
  const answer = parsed(body)
  if (!isRecord(answer) || !ACCEPTED.includes(answer.status as Accepted)) {
    return { ok: false, error: 'The Marketplace answered 200 without a published or unchanged status, so nothing is released.' }
  }
  const same = answer.id === expected.id && answer.version === expected.version && answer.digest === expected.digest
  if (!same) return { ok: false, error: "The Marketplace's answer names another id, version or digest than this package's, so nothing is released." }
  return { ok: true, status: answer.status as Accepted }
}

/** The run's reading of curl's exit code, the HTTP status and the body. */
export function readAnswer(curlExit: string, httpStatus: string, body: string, expected: Expected): Answer {
  if (curlExit !== '0') return { ok: false, error: `The Marketplace could not be reached (curl exit ${plain(curlExit)}), so nothing is released.` }
  if (httpStatus === HTTP_OK) return acceptedAnswer(body, expected)
  const status = plain(httpStatus)
  const meaning = MEANINGS[status] ?? 'an answer the publish contract does not give'
  return { ok: false, error: `The Marketplace answered ${status}: ${meaning} (${errorCodes(body)}). Nothing is released.` }
}

export interface AnswerIo {
  readonly read: (path: string) => string
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

const PROCESS_IO: AnswerIo = {
  read: (path) => readFileSync(path, 'utf8'),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
}

function readBody(io: AnswerIo, path: string): string {
  try {
    return io.read(path)
  } catch {
    return ''
  }
}

/** The command: prints `status=<status>` and answers 0, or prints one workflow error and answers 1. */
export function runPublishAnswer(args: readonly string[], io: AnswerIo = PROCESS_IO): number {
  if (args.length !== 6) {
    io.err(USAGE)
    return EXIT_USAGE
  }
  const [curlExit, httpStatus, answerPath, id, version, digest] = args
  const answer = readAnswer(curlExit, httpStatus, readBody(io, answerPath), { id, version, digest })
  if (!answer.ok) {
    io.err(`::error title=Not published::${answer.error.replace(/%/g, '%25')}`)
    return EXIT_REFUSED
  }
  io.err(`The Marketplace answered ${answer.status} for ${plain(id)} ${plain(version)} (digest ${plain(digest)}).`)
  io.out(`status=${answer.status}`)
  return EXIT_ACCEPTED
}

const invokedAs = process.argv[1] === undefined ? '' : resolve(process.argv[1])
if (invokedAs === fileURLToPath(import.meta.url)) process.exitCode = runPublishAnswer(process.argv.slice(2))
