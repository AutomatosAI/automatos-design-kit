/**
 * The signature request the admin queue hands a person (core orchestrator/services/themes/signing.py,
 * PRD-261 C-03a): `{id, version, digest, files}`, and the exact text that gets signed.
 *
 * The signed text is the payload as JSON with sorted keys, no spaces and ASCII only, as core's
 * `canonical_text` writes it with Python's `json.dumps(payload, sort_keys=True,
 * separators=(",", ":"), ensure_ascii=True)`. `canonicalJson` reproduces that byte for byte.
 *
 * Standard library and this repo only: the sign workflow installs nothing, so no package from npm
 * runs next to the signing key. That is why the digest comes from theme-cli by relative path.
 */
import { packageDigest, sha256Hex } from '../../packages/theme-cli/src/digest.ts'

/** What core's signing step names the signed form (signing.py `SIGNED_FORM`). */
export const SIGNED_FORM = 'automatos-theme-sign/v1: canonical JSON of {id, version, digest, files}, sorted keys, no spaces, ASCII'
export const PAYLOAD_KEYS: readonly string[] = ['digest', 'files', 'id', 'version']

export interface SignPayload {
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly files: Readonly<Record<string, string>>
}

/** A request read from the workflow input: the payload, and what the admin queue said about it. */
export interface SignRequest {
  readonly payload: SignPayload
  readonly requestId: string | null
  readonly payloadSha256: string | null
  readonly canonical: string | null
}

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

const SHA256_HEX = /^[0-9a-f]{64}$/
const PACKAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/
const TEXT_MAX = 200
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

function textProblem(value: unknown, field: string): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > TEXT_MAX) {
    return `"${field}" must be text of 1 to ${TEXT_MAX} characters.`
  }
  return null
}

function filesProblem(files: unknown): string | null {
  if (!isRecord(files) || Object.keys(files).length === 0) return '"files" must map each package path to its sha256.'
  const bad = Object.entries(files).find(([path, sha]) => (
    !PACKAGE_PATH.test(path) || typeof sha !== 'string' || !SHA256_HEX.test(sha)
  ))
  return bad === undefined ? null : `"files" has an entry that isn't a package path and a sha256: ${JSON.stringify(bad[0])}.`
}

/** The payload checked as core builds it: the four keys, and file hashes that add up to the digest. */
export function checkPayload(value: unknown): Parsed<SignPayload> {
  if (!isRecord(value)) return { ok: false, error: 'The payload must be a JSON object {id, version, digest, files}.' }
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== PAYLOAD_KEYS.join(',')) {
    return { ok: false, error: `The payload must have exactly the keys id, version, digest and files; it has ${keys.join(', ')}.` }
  }
  const problem = textProblem(value.id, 'id') ?? textProblem(value.version, 'version') ?? filesProblem(value.files)
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

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * The request from the workflow input. It takes the payload alone, or the whole request the admin
 * queue shows (`{requestId, payload, payloadSha256, canonical, ...}`); when the queue's
 * `payloadSha256` or `canonical` is given, it must match what is signed here.
 */
export function parseRequest(text: string): Parsed<SignRequest> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "The request isn't JSON. Paste the payload the admin queue showed for the approval." }
  }
  const whole = isRecord(raw) && 'payload' in raw
  const payload = checkPayload(whole ? (raw as Record<string, unknown>).payload : raw)
  if (!payload.ok) return payload
  const outer: Record<string, unknown> = whole ? (raw as Record<string, unknown>) : {}
  const request: SignRequest = {
    payload: payload.value,
    requestId: optionalText(outer.requestId),
    payloadSha256: optionalText(outer.payloadSha256),
    canonical: optionalText(outer.canonical),
  }
  return matchesQueue(request)
}

function matchesQueue(request: SignRequest): Parsed<SignRequest> {
  const bytes = canonicalBytes(request.payload)
  if (request.canonical !== null && request.canonical !== bytes.toString('ascii')) {
    return { ok: false, error: "The queue's canonical text differs from the one signed here; nothing was signed." }
  }
  if (request.payloadSha256 !== null && request.payloadSha256 !== sha256Hex(bytes)) {
    return { ok: false, error: "The queue's payloadSha256 differs from the sha256 of the text signed here; nothing was signed." }
  }
  return { ok: true, value: request }
}
