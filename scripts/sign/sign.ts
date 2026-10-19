/**
 * Signs a theme version's signature request with the kit's Ed25519 key (PRD-261 C-03a, D3-c).
 *
 * The key is the kit repository's `THEME_SIGNING_KEY` secret (a PKCS#8 PEM), read by the sign
 * workflow's one step and nowhere else. The signature is over the canonical JSON of
 * `{id, version, digest, files}` (request.ts) and comes back as base64 (64 bytes), which the person
 * pastes into the admin queue (`POST /api/admin/themes/{id}/signature`). Node's own crypto only.
 *
 * Verifying signatures is PRD-261 C-05 (after WebSummit); nothing verifies them yet.
 */
import { createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto'
import { canonicalBytes, parseRequest, SIGNED_FORM, type Parsed, type SignPayload } from './request.ts'
import { sha256Hex } from '../../packages/theme-cli/src/digest.ts'

export const KEY_ENV = 'THEME_SIGNING_KEY'
export const SIGNATURE_ALGORITHM = 'ed25519'
const SIGNATURE_BYTES = 64

export interface Signed {
  /** The admin queue's request id, pasted back with the signature; it is not part of the signed text. */
  readonly requestId: string
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly payloadSha256: string
  readonly algorithm: typeof SIGNATURE_ALGORITHM
  readonly form: string
  /** Base64 of the 64-byte Ed25519 signature: what the admin queue takes. */
  readonly signature: string
  /** The matching public key, SPKI DER as base64, for the record (it is not secret). */
  readonly publicKey: string
}

const NO_KEY = (
  `The ${KEY_ENV} secret is not set for this repository, so nothing was signed. ` +
  'A maintainer adds it under Settings > Secrets and variables > Actions (an Ed25519 private key, PKCS#8 PEM).'
)
const BAD_KEY = `${KEY_ENV} is not a readable private key (PKCS#8 PEM expected), so nothing was signed.`
const NOT_ED25519 = `${KEY_ENV} is a {type} key; theme signatures are Ed25519, so nothing was signed.`

/** The private key from the secret's text, or why it can't be used. The key text is never echoed. */
export function signingKey(pem: string | undefined): Parsed<KeyObject> {
  if (pem === undefined || pem.trim() === '') return { ok: false, error: NO_KEY }
  let key: KeyObject
  try {
    key = createPrivateKey({ key: pem, format: 'pem' })
  } catch {
    return { ok: false, error: BAD_KEY }
  }
  if (key.asymmetricKeyType !== SIGNATURE_ALGORITHM) {
    return { ok: false, error: NOT_ED25519.replace('{type}', String(key.asymmetricKeyType)) }
  }
  return { ok: true, value: key }
}

function signPayload(payload: SignPayload, key: KeyObject): { signature: string; payloadSha256: string } {
  const bytes = canonicalBytes(payload)
  const signature = sign(null, bytes, key)
  if (signature.length !== SIGNATURE_BYTES) throw new Error(`an Ed25519 signature is ${SIGNATURE_BYTES} bytes, got ${signature.length}`)
  return { signature: signature.toString('base64'), payloadSha256: sha256Hex(bytes) }
}

/** Signs the request text with the key text; refuses (and signs nothing) when either is not right. */
export function signRequest(requestText: string, pem: string | undefined): Parsed<Signed> {
  const key = signingKey(pem)
  if (!key.ok) return key
  const request = parseRequest(requestText)
  if (!request.ok) return request
  const { payload, requestId } = request.value
  const { signature, payloadSha256 } = signPayload(payload, key.value)
  const publicKey = createPublicKey(key.value).export({ format: 'der', type: 'spki' }).toString('base64')
  return {
    ok: true,
    value: {
      requestId, id: payload.id, version: payload.version, digest: payload.digest, payloadSha256,
      algorithm: SIGNATURE_ALGORITHM, form: SIGNED_FORM, signature, publicKey,
    },
  }
}

/** What the workflow prints and writes to its job summary: plain lines, no secret. */
export function signedReport(signed: Signed): string[] {
  return [
    `Theme: ${signed.id} ${signed.version}`,
    `Digest: ${signed.digest}`,
    `Request id: ${signed.requestId}`,
    `Payload sha256: ${signed.payloadSha256}`,
    `Algorithm: ${signed.algorithm} (${signed.form})`,
    `Public key (SPKI, base64): ${signed.publicKey}`,
    '',
    'Signature (paste this into the admin queue with the request id above):',
    signed.signature,
  ]
}
