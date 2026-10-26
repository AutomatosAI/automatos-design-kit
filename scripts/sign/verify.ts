/**
 * Verifies a theme's signature envelope (`.sig.json`, envelope.ts) against its `.autotheme` and
 * the kit's published keys, `keys/theme-signing.json` (PRD-261 C-05m). Core runs the same check
 * on its own copy of the keys (C-05a), so an author, the release job and core agree.
 *
 *   node scripts/sign/verify.ts <package.autotheme> <envelope.sig.json> [<keys.json>]
 *
 * The keys file is `{"schema":1,"keys":[{keyId, spki, status, added}]}`: `spki` the public key's
 * SPKI DER in base64, `keyId` derived from it (envelope.ts `keyIdOf`), `status` one of active,
 * retired, revoked, `added` a YYYY-MM-DD date. It holds Automatos's theme-signing key,
 * ed25519:e138b6d0fa7aaaf3 (active, added 2026-10-26): the public half of the key Theme sign
 * signs with. Only an envelope that key signed verifies.
 *
 * The signed payload is rebuilt from the package itself: `id` and `version` from its theme.json,
 * each member's sha256 and the package digest (digest.ts), so an envelope verifies only for the
 * bytes that were signed. States as core has them: `verified` (an active key verifies), `invalid`
 * (anything else, with the reason), `unsigned` (no envelope). Exit 0 when verified, 1 when not
 * (one plain line on stderr), 2 for a usage error. Standard library and this repo only.
 */
import { createPublicKey, verify, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageDigest, sha256Hex } from '../../packages/theme-cli/src/digest.ts'
import { readZip } from '../../packages/theme-cli/src/zip.ts'
import { keyIdOf, parseEnvelope, signatureBytes, type Envelope } from './envelope.ts'
import { canonicalBytes, isEchoSafe, type Parsed, type SignPayload } from './request.ts'

export const KEYS_SCHEMA = 1
export const KEY_STATUSES: readonly string[] = ['active', 'retired', 'revoked']
export const DEFAULT_KEYS_PATH = fileURLToPath(new URL('../../keys/theme-signing.json', import.meta.url))
const KEY_FIELDS: readonly string[] = ['added', 'keyId', 'spki', 'status']
const ADDED_DATE = /^\d{4}-\d{2}-\d{2}$/
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const MANIFEST_PATH = 'theme.json'
const NOT_SHOWN = '(not shown)'
export const EXIT_VERIFIED = 0
export const EXIT_NOT_VERIFIED = 1
export const EXIT_USAGE = 2
const USAGE = 'Usage: node scripts/sign/verify.ts <package.autotheme> <envelope.sig.json> [<keys.json>]'

export interface SigningKey {
  readonly keyId: string
  readonly status: string
  readonly publicKey: KeyObject
}

export type Verdict =
  | { readonly state: 'verified'; readonly keyId: string }
  | { readonly state: 'invalid'; readonly reason: string }
  | { readonly state: 'unsigned' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function echoed(text: string): string {
  return isEchoSafe(text) ? text : NOT_SHOWN
}

/** One entry of the keys file, or the plain reason it can't be used (`where` names it by position). */
function readKey(raw: unknown, where: string): Parsed<SigningKey> {
  if (!isRecord(raw) || Object.keys(raw).sort().join(',') !== KEY_FIELDS.join(',')) {
    return { ok: false, error: `${where} must have exactly keyId, spki, status and added.` }
  }
  const { keyId, spki, status, added } = raw
  if (typeof status !== 'string' || !KEY_STATUSES.includes(status)) return { ok: false, error: `${where} has a status other than active, retired or revoked.` }
  if (typeof added !== 'string' || !ADDED_DATE.test(added)) return { ok: false, error: `${where} needs "added" as a YYYY-MM-DD date.` }
  if (typeof spki !== 'string' || !BASE64.test(spki)) return { ok: false, error: `${where} has an spki that isn't base64.` }
  const der = Buffer.from(spki, 'base64')
  let publicKey: KeyObject
  try {
    publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
  } catch {
    return { ok: false, error: `${where} has an spki that isn't a public key (SPKI DER, base64).` }
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') return { ok: false, error: `${where} isn't an Ed25519 key.` }
  if (typeof keyId !== 'string' || keyId !== keyIdOf(der)) return { ok: false, error: `${where} has a keyId that doesn't match its spki.` }
  return { ok: true, value: { keyId, status, publicKey } }
}

/** The keys file's text: schema 1, every key well formed, no keyId twice. */
export function parseKeys(text: string): Parsed<readonly SigningKey[]> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "The keys file isn't JSON." }
  }
  if (!isRecord(raw) || raw.schema !== KEYS_SCHEMA || !Array.isArray(raw.keys)) {
    return { ok: false, error: `The keys file must be {"schema":${KEYS_SCHEMA},"keys":[...]}.` }
  }
  const keys: SigningKey[] = []
  for (const [index, entry] of raw.keys.entries()) {
    const key = readKey(entry, `Key ${index + 1} in the keys file`)
    if (!key.ok) return key
    if (keys.some((held) => held.keyId === key.value.keyId)) return { ok: false, error: `The keys file names ${key.value.keyId} twice.` }
    keys.push(key.value)
  }
  return { ok: true, value: keys }
}

/** The theme.json's id and version, as core takes them for the signed payload. */
function manifestNames(files: ReadonlyMap<string, Uint8Array>): Parsed<{ id: string; version: string }> {
  const manifest = files.get(MANIFEST_PATH)
  if (manifest === undefined) return { ok: false, error: `The package has no ${MANIFEST_PATH}.` }
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(manifest).toString('utf8'))
  } catch {
    return { ok: false, error: `The package's ${MANIFEST_PATH} isn't JSON.` }
  }
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.version !== 'string') {
    return { ok: false, error: `The package's ${MANIFEST_PATH} has no id and version.` }
  }
  return { ok: true, value: { id: raw.id, version: raw.version } }
}

/** `{id, version, digest, files}` from a package's own bytes: what its signature must cover. */
export function packagePayload(packageBytes: Buffer): Parsed<SignPayload> {
  let entries: ReturnType<typeof readZip>
  try {
    entries = readZip(packageBytes)
  } catch {
    return { ok: false, error: "The package isn't a zip this kit can read." }
  }
  const files = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (files.has(entry.path)) return { ok: false, error: `The package holds ${echoed(entry.path)} twice.` }
    files.set(entry.path, entry.data)
  }
  const names = manifestNames(files)
  if (!names.ok) return names
  const hashes = Object.fromEntries(Array.from(files, ([path, data]): [string, string] => [path, sha256Hex(data)]))
  return { ok: true, value: { ...names.value, digest: packageDigest(hashes), files: hashes } }
}

/** Why the envelope doesn't name this package, or null when id, version and digest all match. */
function payloadMismatch(payload: SignPayload, envelope: Envelope): string | null {
  if (payload.id !== envelope.id || payload.version !== envelope.version) {
    return `The envelope is for ${envelope.id} ${envelope.version}, but the package is ${echoed(payload.id)} ${echoed(payload.version)}.`
  }
  if (payload.digest !== envelope.digest) {
    return `The package's digest ${payload.digest} differs from the envelope's ${envelope.digest}: these aren't the bytes that were signed.`
  }
  return null
}

/** Why the envelope's key can't vouch for it, or the key. */
function keyFor(envelope: Envelope, keys: readonly SigningKey[]): Parsed<SigningKey> {
  const key = keys.find((held) => held.keyId === envelope.keyId)
  if (key === undefined) return { ok: false, error: `The envelope's key ${envelope.keyId} isn't in the keys file, so nothing vouches for it.` }
  if (key.status === 'revoked') return { ok: false, error: `The envelope's key ${envelope.keyId} is revoked; nothing it signed is trusted.` }
  if (key.status !== 'active') return { ok: false, error: `The envelope's key ${envelope.keyId} is ${key.status}; it no longer verifies a signature.` }
  return { ok: true, value: key }
}

/** The verdict for a payload and its envelope (null: unsigned) under the given keys. */
export function verifyEnvelope(payload: SignPayload, envelope: Envelope | null, keys: readonly SigningKey[]): Verdict {
  if (envelope === null) return { state: 'unsigned' }
  const mismatch = payloadMismatch(payload, envelope)
  if (mismatch !== null) return { state: 'invalid', reason: mismatch }
  const key = keyFor(envelope, keys)
  if (!key.ok) return { state: 'invalid', reason: key.error }
  const signature = signatureBytes(envelope.signature)
  if (signature === null || !verify(null, canonicalBytes(payload), key.value.publicKey, signature)) {
    return { state: 'invalid', reason: `The signature doesn't verify with ${envelope.keyId}: the package or the envelope changed after signing.` }
  }
  return { state: 'verified', keyId: envelope.keyId }
}

export interface VerifyInput {
  readonly packageBytes: Buffer
  readonly envelopeText: string
  readonly keysText: string
}

/** The whole check from the three files' contents. */
export function verifyPackage(input: VerifyInput): Verdict {
  const keys = parseKeys(input.keysText)
  if (!keys.ok) return { state: 'invalid', reason: keys.error }
  const envelope = parseEnvelope(input.envelopeText)
  if (!envelope.ok) return { state: 'invalid', reason: envelope.error }
  const payload = packagePayload(input.packageBytes)
  if (!payload.ok) return { state: 'invalid', reason: payload.error }
  return verifyEnvelope(payload.value, envelope.value, keys.value)
}

export interface VerifyIo {
  readonly read: (path: string) => Buffer
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

const PROCESS_IO: VerifyIo = {
  read: (path) => readFileSync(path),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
}

function readAll(paths: readonly string[], io: VerifyIo): Parsed<Buffer[]> {
  const contents: Buffer[] = []
  for (const path of paths) {
    try {
      contents.push(io.read(path))
    } catch {
      return { ok: false, error: `Can't read ${echoed(path)}.` }
    }
  }
  return { ok: true, value: contents }
}

/** The command: reads the files, prints one line, answers the exit code. */
export function runVerify(args: readonly string[], io: VerifyIo = PROCESS_IO): number {
  if (args.length < 2 || args.length > 3) {
    io.err(USAGE)
    return EXIT_USAGE
  }
  const files = readAll([args[0], args[1], args[2] ?? DEFAULT_KEYS_PATH], io)
  if (!files.ok) {
    io.err(`Not verified: ${files.error}`)
    return EXIT_NOT_VERIFIED
  }
  const [packageBytes, envelope, keys] = files.value
  const verdict = verifyPackage({ packageBytes, envelopeText: envelope.toString('utf8'), keysText: keys.toString('utf8') })
  if (verdict.state !== 'verified') {
    io.err(`Not verified: ${verdict.state === 'invalid' ? verdict.reason : 'there is no signature envelope.'}`)
    return EXIT_NOT_VERIFIED
  }
  io.out(`Verified: signed by ${verdict.keyId}.`)
  return EXIT_VERIFIED
}

const invokedAs = process.argv[1] === undefined ? '' : resolve(process.argv[1])
if (invokedAs === fileURLToPath(import.meta.url)) process.exitCode = runVerify(process.argv.slice(2))
