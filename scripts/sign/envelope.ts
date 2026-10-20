/**
 * The detached signature envelope that travels next to a signed `.autotheme` (PRD-261 C-05m, the
 * plan's signature contract): one small JSON file, `<version>.sig.json`,
 *
 *   {form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId, id, version, digest, signature}
 *
 * at most 4 KB. `signature` is the base64 Ed25519 signature (64 bytes) over the canonical text of
 * `{id, version, digest, files}` (request.ts), exactly what the sign workflow prints for the admin
 * queue. `keyId` names the key in `keys/theme-signing.json`: `ed25519:` plus the first 16 hex of
 * the sha256 of the key's SPKI DER. Core reads the same form (C-05a, C-05d).
 *
 * Standard library and this repo only, like the rest of scripts/sign/.
 */
import { sha256Hex } from '../../packages/theme-cli/src/digest.ts'
import { ID_PATTERN, VERSION_PATTERN, type Parsed } from './request.ts'

export const ENVELOPE_FORM = 'automatos-theme-signature/v1'
export const ENVELOPE_ALGORITHM = 'ed25519'
export const ENVELOPE_MAX_BYTES = 4 * 1024
export const KEY_ID_PREFIX = 'ed25519:'
const KEY_ID_HEX_CHARS = 16
export const KEY_ID_PATTERN = /^ed25519:[0-9a-f]{16}$/
export const SIGNATURE_BYTES = 64
/** The envelope's keys, sorted. */
export const ENVELOPE_KEYS: readonly string[] = ['algorithm', 'digest', 'form', 'id', 'keyId', 'signature', 'version']
const SHA256_HEX = /^[0-9a-f]{64}$/
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

export interface Envelope {
  readonly form: typeof ENVELOPE_FORM
  readonly algorithm: typeof ENVELOPE_ALGORITHM
  readonly keyId: string
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly signature: string
}

export type EnvelopeFields = Omit<Envelope, 'form' | 'algorithm'>

/** `ed25519:` plus the first 16 hex of sha256(SPKI DER): the name a key has in every keys file. */
export function keyIdOf(spkiDer: Uint8Array): string {
  return `${KEY_ID_PREFIX}${sha256Hex(spkiDer).slice(0, KEY_ID_HEX_CHARS)}`
}

/** The 64 signature bytes from standard base64, or null when the text is anything else. */
export function signatureBytes(text: string): Buffer | null {
  if (!BASE64.test(text)) return null
  const bytes = Buffer.from(text, 'base64')
  if (bytes.length !== SIGNATURE_BYTES || bytes.toString('base64') !== text) return null
  return bytes
}

export function makeEnvelope(fields: EnvelopeFields): Envelope {
  return {
    form: ENVELOPE_FORM, algorithm: ENVELOPE_ALGORITHM, keyId: fields.keyId,
    id: fields.id, version: fields.version, digest: fields.digest, signature: fields.signature,
  }
}

/** The envelope as one line of JSON in the contract's key order: the text of a `.sig.json` file. */
export function envelopeText(envelope: Envelope): string {
  return JSON.stringify(makeEnvelope(envelope))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function matches(pattern: RegExp): (value: unknown) => boolean {
  return (value) => typeof value === 'string' && pattern.test(value)
}

/** Each field's rule and the plain reason given when it fails. No value from the file is echoed. */
const FIELD_RULES: ReadonlyArray<readonly [keyof Envelope, (value: unknown) => boolean, string]> = [
  ['form', (value) => value === ENVELOPE_FORM, `"form" must be "${ENVELOPE_FORM}".`],
  ['algorithm', (value) => value === ENVELOPE_ALGORITHM, `"algorithm" must be "${ENVELOPE_ALGORITHM}".`],
  ['keyId', matches(KEY_ID_PATTERN), '"keyId" must be "ed25519:" and 16 lower-case hex characters.'],
  ['id', matches(ID_PATTERN), '"id" must be a theme id as core\'s manifest has it: "publisher/name".'],
  ['version', matches(VERSION_PATTERN), '"version" must be MAJOR.MINOR.PATCH, as core\'s manifest has it.'],
  ['digest', matches(SHA256_HEX), '"digest" must be the package digest: 64 lower-case hex characters.'],
  ['signature', (value) => typeof value === 'string' && signatureBytes(value) !== null,
    '"signature" must be the standard base64 of a 64-byte Ed25519 signature.'],
]

/** A `.sig.json` file's text, held to the contract; the reason is plain and echoes nothing from it. */
export function parseEnvelope(text: string): Parsed<Envelope> {
  if (Buffer.byteLength(text, 'utf8') > ENVELOPE_MAX_BYTES) {
    return { ok: false, error: `The signature envelope is larger than ${ENVELOPE_MAX_BYTES} bytes.` }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "The signature envelope isn't JSON." }
  }
  if (!isRecord(raw)) return { ok: false, error: 'The signature envelope must be a JSON object.' }
  if (Object.keys(raw).sort().join(',') !== ENVELOPE_KEYS.join(',')) {
    return { ok: false, error: 'The signature envelope must have exactly the keys form, algorithm, keyId, id, version, digest and signature.' }
  }
  const failed = FIELD_RULES.find(([key, holds]) => !holds(raw[key]))
  if (failed !== undefined) return { ok: false, error: `The signature envelope is not valid: ${failed[2]}` }
  return { ok: true, value: makeEnvelope(raw as unknown as EnvelopeFields) }
}
