/**
 * Signs a theme version's payload with the kit's Ed25519 key (PRD-261 C-03a, D3-c), for the publish run
 * (theme-publish.yml's "Sign" step, through from-pack.ts).
 *
 * The key is the `THEME_SIGNING_KEY` secret of the `theme-publish` environment (a PKCS#8 PEM), read by that one
 * step and nowhere else. The signature is over the canonical JSON of `{id, version, digest, files}`
 * (request.ts), core's `canonical_text(signing_payload(package))`, and comes back as base64 (64 bytes) inside the
 * signature envelope, the `.sig.json` that travels with the package (C-05m). Node's own crypto only.
 *
 * `verify.ts` checks an envelope against the package and `keys/theme-signing.json`; core verifies it against its
 * own copy of the same keys when the publish run sends it (C-05a, C-05b).
 */
import { createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto'
import { keyIdOf, makeEnvelope, type Envelope } from './envelope.ts'
import { canonicalBytes, checkPayload, SIGNED_FORM, type Parsed, type SignPayload } from './request.ts'
import { sha256Hex } from '../../packages/theme-cli/src/digest.ts'

export const KEY_ENV = 'THEME_SIGNING_KEY'
export const SIGNATURE_ALGORITHM = 'ed25519'
const SIGNATURE_BYTES = 64

export interface Signed {
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly payloadSha256: string
  readonly algorithm: typeof SIGNATURE_ALGORITHM
  readonly form: string
  /** Base64 of the 64-byte Ed25519 signature: what core stores for the version. */
  readonly signature: string
  /** The matching public key, SPKI DER as base64, for the record (it is not secret). */
  readonly publicKey: string
  /** The key's id in keys/theme-signing.json: `ed25519:` + the first 16 hex of sha256(SPKI DER). */
  readonly keyId: string
  /** The `.sig.json` that goes next to the package. */
  readonly envelope: Envelope
}

const NO_KEY = (
  `The ${KEY_ENV} secret is not set for this run, so nothing was signed. ` +
  'A maintainer adds it to the theme-publish environment under Settings > Environments (an Ed25519 private key, PKCS#8 PEM).'
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

function signWith(payload: SignPayload, key: KeyObject): { signature: string; payloadSha256: string } {
  const bytes = canonicalBytes(payload)
  const signature = sign(null, bytes, key)
  if (signature.length !== SIGNATURE_BYTES) throw new Error(`an Ed25519 signature is ${SIGNATURE_BYTES} bytes, got ${signature.length}`)
  return { signature: signature.toString('base64'), payloadSha256: sha256Hex(bytes) }
}

/**
 * Signs the payload with the key text; refuses (and signs nothing) when the key is not right or the payload is not
 * one core would sign (core's id and version patterns, file hashes that add up to its digest).
 */
export function signPayload(payload: SignPayload, pem: string | undefined): Parsed<Signed> {
  const key = signingKey(pem)
  if (!key.ok) return key
  const checked = checkPayload(payload)
  if (!checked.ok) return checked
  const { signature, payloadSha256 } = signWith(checked.value, key.value)
  const spki = createPublicKey(key.value).export({ format: 'der', type: 'spki' })
  const keyId = keyIdOf(spki)
  const { id, version, digest } = checked.value
  return {
    ok: true,
    value: {
      id, version, digest, payloadSha256, algorithm: SIGNATURE_ALGORITHM, form: SIGNED_FORM,
      signature, publicKey: spki.toString('base64'), keyId,
      envelope: makeEnvelope({ keyId, id, version, digest, signature }),
    },
  }
}

/** What the sign step prints: plain lines, no secret and no signature (the envelope file holds it). */
export function signedReport(signed: Signed): string[] {
  return [
    `Signed: ${signed.id} ${signed.version}`,
    `Digest: ${signed.digest}`,
    `Payload sha256: ${signed.payloadSha256}`,
    `Algorithm: ${signed.algorithm} (${signed.form})`,
    `Key id: ${signed.keyId}`,
  ]
}
