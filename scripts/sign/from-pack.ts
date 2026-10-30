/**
 * The publish run's signer (theme-publish.yml's "Check the package against its summary" and "Sign" steps): the
 * signature of a package the run built from main, made from the package's own bytes and `pack`'s summary of them.
 * Node runs this TypeScript directly (type stripping, Node 22.18 or later); nothing is installed first.
 *
 *   node scripts/sign/from-pack.ts check <package.autotheme> <package.sha256.json>
 *   node scripts/sign/from-pack.ts sign <package.autotheme> <package.sha256.json> <out.sig.json>
 *
 * The summary is pack's `<publisher>.<slug>-<version>.sha256.json`, `{schema, id, version, digest, zipSha256,
 * files: {path: {type, size, sha256}}}`. Its `{id, version, digest, files: {path: sha256}}` is core's
 * `signing_payload` of the same package (core orchestrator/services/themes/signing.py), so the text signed here is
 * core's `canonical_text(signing_payload(package))` byte for byte (request.ts `canonicalBytes`; the shared vector,
 * tests/fixtures/signing-vector.json, proves it). Before anything is signed the package's bytes must be what the
 * summary says: their sha256 is its `zipSha256`, and the payload rebuilt from the package's own members
 * (verify.ts `packagePayload`) is the summary's, file for file, with hashes that add up to its digest.
 *
 * `check` stops there. `sign` then reads THEME_SIGNING_KEY (Ed25519, PKCS#8 PEM; sign.ts), signs, writes the
 * one-line signature envelope (envelope.ts) to <out.sig.json> and prints the key id, never the key. Exit 0 done;
 * 1 refused (one plain workflow error, nothing written); 2 usage. Standard library and this repo only.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256Hex } from '../../packages/theme-cli/src/digest.ts'
import { envelopeText } from './envelope.ts'
import { canonicalBytes, checkPayload, isEchoSafe, type Parsed, type SignPayload } from './request.ts'
import { KEY_ENV, signedReport, signPayload, type Signed } from './sign.ts'
import { packagePayload } from './verify.ts'

/** pack's summary schema (packages/theme-cli/src/pack.ts `PACK_MANIFEST_SCHEMA`; the root tests hold the two equal). */
export const PACK_SUMMARY_SCHEMA = 'automatos-theme-pack/v1'
export const EXIT_DONE = 0
export const EXIT_REFUSED = 1
export const EXIT_USAGE = 2
const USAGE = 'Usage: node scripts/sign/from-pack.ts check <package.autotheme> <package.sha256.json>'
  + ' | sign <package.autotheme> <package.sha256.json> <out.sig.json>'
const SHA256_HEX = /^[0-9a-f]{64}$/
const UNSAFE_OUTPUT = 'The output would have held a line break or a double colon, so nothing was printed.'

export interface PackSummary {
  readonly payload: SignPayload
  readonly zipSha256: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `{path: sha256}` from the summary's `{path: {type, size, sha256}}` rows, or null when a row has no sha256. */
function fileHashes(files: unknown): Record<string, string> | null {
  if (!isRecord(files)) return null
  const rows = Object.entries(files)
  if (!rows.every(([, row]) => isRecord(row) && typeof row.sha256 === 'string')) return null
  return Object.fromEntries(rows.map(([path, row]) => [path, (row as { sha256: string }).sha256]))
}

/** pack's summary as the signing payload and the zip's sha256; refused unless core would sign that payload. */
export function readSummary(text: string): Parsed<PackSummary> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "The pack summary (.sha256.json) isn't JSON." }
  }
  if (!isRecord(raw) || raw.schema !== PACK_SUMMARY_SCHEMA) {
    return { ok: false, error: `The pack summary must be pack's ${PACK_SUMMARY_SCHEMA} .sha256.json.` }
  }
  if (typeof raw.zipSha256 !== 'string' || !SHA256_HEX.test(raw.zipSha256)) {
    return { ok: false, error: 'The pack summary has no zipSha256 (64 lower-case hex characters).' }
  }
  const files = fileHashes(raw.files)
  if (files === null) return { ok: false, error: 'The pack summary\'s "files" must give each path its sha256.' }
  const payload = checkPayload({ id: raw.id, version: raw.version, digest: raw.digest, files })
  return payload.ok ? { ok: true, value: { payload: payload.value, zipSha256: raw.zipSha256 } } : payload
}

/** The payload to sign, refused unless the package's bytes are the ones the summary describes. */
export function checkPack(packageBytes: Buffer, summaryText: string): Parsed<SignPayload> {
  const summary = readSummary(summaryText)
  if (!summary.ok) return summary
  if (sha256Hex(packageBytes) !== summary.value.zipSha256) {
    return { ok: false, error: "The package's sha256 differs from the pack summary's zipSha256: these aren't the bytes pack wrote." }
  }
  const own = packagePayload(packageBytes)
  if (!own.ok) return own
  if (!canonicalBytes(own.value).equals(canonicalBytes(summary.value.payload))) {
    return { ok: false, error: "The package's own id, version or files differ from its pack summary, so it isn't signed." }
  }
  return { ok: true, value: summary.value.payload }
}

/** The signature of a checked package; nothing is signed unless the check passes. */
export function signPack(packageBytes: Buffer, summaryText: string, pem: string | undefined): Parsed<Signed> {
  const checked = checkPack(packageBytes, summaryText)
  return checked.ok ? signPayload(checked.value, pem) : checked
}

export interface FromPackIo {
  readonly read: (path: string) => Buffer
  readonly write: (path: string, text: string) => void
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

const PROCESS_IO: FromPackIo = {
  read: (path) => readFileSync(path),
  write: (path, text) => writeFileSync(path, text),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
}

function refuse(io: FromPackIo, reason: string): number {
  const shown = isEchoSafe(reason) ? reason : UNSAFE_OUTPUT
  // A workflow command's message decodes %XX escapes: write % as %25 so the reason reads as given.
  io.err(`::error title=Not signed::${shown.replace(/%/g, '%25')}`)
  return EXIT_REFUSED
}

function readBoth(io: FromPackIo, packagePath: string, summaryPath: string): Parsed<{ bytes: Buffer; summary: string }> {
  try {
    return { ok: true, value: { bytes: io.read(packagePath), summary: io.read(summaryPath).toString('utf8') } }
  } catch {
    return { ok: false, error: "Can't read the package or its pack summary." }
  }
}

function printed(io: FromPackIo, lines: readonly string[]): number {
  if (!lines.every(isEchoSafe)) return refuse(io, UNSAFE_OUTPUT)
  lines.forEach((line) => io.out(line))
  return EXIT_DONE
}

/** The command: `check` or `sign`, as the header says. The key is read from `env` and removed from it at once. */
export function runFromPack(args: readonly string[], env: NodeJS.ProcessEnv = process.env, io: FromPackIo = PROCESS_IO): number {
  const [command, packagePath, summaryPath, outPath] = args
  const usable = (command === 'check' && args.length === 3) || (command === 'sign' && args.length === 4)
  if (!usable) {
    io.err(USAGE)
    return EXIT_USAGE
  }
  const pem = env[KEY_ENV]
  delete env[KEY_ENV]
  const files = readBoth(io, packagePath, summaryPath)
  if (!files.ok) return refuse(io, files.error)
  if (command === 'check') {
    const checked = checkPack(files.value.bytes, files.value.summary)
    if (!checked.ok) return refuse(io, checked.error)
    return printed(io, [`Checked: ${checked.value.id} ${checked.value.version}, digest ${checked.value.digest}, ${Object.keys(checked.value.files).length} files`])
  }
  const signed = signPack(files.value.bytes, files.value.summary, pem)
  if (!signed.ok) return refuse(io, signed.error)
  const lines = signedReport(signed.value)
  if (!lines.every(isEchoSafe)) return refuse(io, UNSAFE_OUTPUT)
  try {
    io.write(outPath, `${envelopeText(signed.value.envelope)}\n`)
  } catch {
    return refuse(io, "Can't write the signature envelope.")
  }
  return printed(io, lines)
}

const invokedAs = process.argv[1] === undefined ? '' : resolve(process.argv[1])
if (invokedAs === fileURLToPath(import.meta.url)) process.exitCode = runFromPack(process.argv.slice(2))
