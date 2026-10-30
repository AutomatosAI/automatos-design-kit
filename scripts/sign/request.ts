/**
 * The signing payload of a theme version, `{id, version, digest, files}`, as core builds it (core
 * orchestrator/services/themes/signing.py `signing_payload`, PRD-261 C-03a): the theme id, the version, the
 * package digest and each file's sha256. Only the payload is signed, as core's `SIGNED_FORM` and
 * `canonical_text` cover it.
 *
 * The signed text is the payload as JSON with sorted keys, no spaces and ASCII only, as core's
 * `canonical_text` writes it with Python's `json.dumps(payload, sort_keys=True,
 * separators=(",", ":"), ensure_ascii=True)`. `canonicalJson` reproduces that byte for byte.
 *
 * Standard library and this repo only: the publish run's signing step installs nothing, so no package
 * from npm runs next to the signing key. That is why the digest comes from theme-cli by relative path.
 */
import { packageDigest } from '../../packages/theme-cli/src/digest.ts'

/** What core's signing step names the signed form (signing.py `SIGNED_FORM`). */
export const SIGNED_FORM = 'automatos-theme-sign/v1: canonical JSON of {id, version, digest, files}, sorted keys, no spaces, ASCII'
export const PAYLOAD_KEYS: readonly string[] = ['digest', 'files', 'id', 'version']

export interface SignPayload {
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly files: Readonly<Record<string, string>>
}

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

const SHA256_HEX = /^[0-9a-f]{64}$/
const PACKAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/
/** Copied from core orchestrator/services/themes/manifest.py `ID_PATTERN` (used with fullmatch). */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,62}$/
/** Copied from core orchestrator/services/themes/manifest.py `VERSION_PATTERN` (used with fullmatch). */
export const VERSION_PATTERN = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/
/** What may not reach stdout: a line break or control character (a new line could carry a workflow command) or `::`. */
const ECHO_UNSAFE = /[\x00-\x1f\x7f\x85\u2028\u2029]|::/
const NOT_SHOWN = '(a value with a line break or a double colon, not shown)'
const NON_ASCII = /[\u007f-\uffff]/g

type Json = string | boolean | null | readonly Json[] | { readonly [key: string]: Json }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Python's ensure_ascii: every character from U+007F up as a lower-case \uXXXX escape. */
function asciiOnly(text: string): string {
  return text.replace(NON_ASCII, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function sortedCopy(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortedCopy)
  if (!isRecord(value)) return value
  const record = value as { readonly [key: string]: Json }
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortedCopy(record[key])]))
}

/** JSON with sorted keys, no spaces, ASCII only: core's `canonical_text` (numbers are not part of it). */
export function canonicalJson(value: Json): string {
  return asciiOnly(JSON.stringify(sortedCopy(value)))
}

/** The text that is signed, as ASCII bytes. */
export function canonicalBytes(payload: SignPayload): Buffer {
  return Buffer.from(canonicalJson(payload as unknown as Json), 'ascii')
}

/** True when `text` can be printed without starting a line of its own or a workflow command. */
export function isEchoSafe(text: string): boolean {
  return !ECHO_UNSAFE.test(text)
}

/** Text from the request as it may appear in a message: as is when safe, else a placeholder. */
function echoed(text: string): string {
  return isEchoSafe(text) ? text : NOT_SHOWN
}

function idProblem(value: unknown): string | null {
  if (typeof value === 'string' && ID_PATTERN.test(value)) return null
  return '"id" must be a theme id as core\'s manifest has it: "publisher/name", lower-case letters, digits and hyphens.'
}

function versionProblem(value: unknown): string | null {
  if (typeof value === 'string' && VERSION_PATTERN.test(value)) return null
  return '"version" must be a version as core\'s manifest has it: MAJOR.MINOR.PATCH, like 1.2.3.'
}

function filesProblem(files: unknown): string | null {
  if (!isRecord(files) || Object.keys(files).length === 0) return '"files" must map each package path to its sha256.'
  const bad = Object.entries(files).find(([path, sha]) => (
    !PACKAGE_PATH.test(path) || typeof sha !== 'string' || !SHA256_HEX.test(sha)
  ))
  return bad === undefined ? null : `"files" has an entry that isn't a package path and a sha256: ${echoed(JSON.stringify(bad[0]))}.`
}

/** The payload checked as core builds it: the four keys, and file hashes that add up to the digest. */
export function checkPayload(value: unknown): Parsed<SignPayload> {
  if (!isRecord(value)) return { ok: false, error: 'The payload must be a JSON object {id, version, digest, files}.' }
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== PAYLOAD_KEYS.join(',')) {
    return { ok: false, error: `The payload must have exactly the keys id, version, digest and files; it has ${keys.map(echoed).join(', ')}.` }
  }
  const problem = idProblem(value.id) ?? versionProblem(value.version) ?? filesProblem(value.files)
  if (problem !== null) return { ok: false, error: problem }
  if (typeof value.digest !== 'string' || !SHA256_HEX.test(value.digest)) {
    return { ok: false, error: '"digest" must be the package digest: 64 lower-case hex characters.' }
  }
  const files = value.files as Record<string, string>
  if (packageDigest(files) !== value.digest) {
    return { ok: false, error: "The file hashes don't add up to the digest, so this isn't a version core would sign." }
  }
  return { ok: true, value: { id: value.id as string, version: value.version as string, digest: value.digest, files } }
}
