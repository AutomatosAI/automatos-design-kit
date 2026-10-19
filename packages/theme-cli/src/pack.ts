/**
 * `automatos-theme pack`: a built theme folder into `<publisher>.<slug>-<version>.autotheme`.
 *
 * The folder's package files (collect.ts) are checked as core's reader checks them
 * (check-package.ts); anything core would refuse stops the pack with every reason and writes
 * nothing. Otherwise pack writes the zip and, next to it, `<same name>.sha256.json`: the file
 * manifest `{path: {type, size, sha256}}`, the package digest core names the package by, and the
 * sha256 of the zip itself. The zip is read back and its digest compared before pack reports success.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkPackage } from './check-package.ts'
import { collectThemeFiles } from './collect.ts'
import { themeError, type ThemeError } from './core/css-value.ts'
import { digestOfManifest, fileManifest, packageDigest, sha256Hex, type FileRow } from './digest.ts'
import { CAPS, MB } from './files.ts'
import { readZip, writeZip } from './zip.ts'

export const PACKAGE_EXTENSION = '.autotheme'
export const MANIFEST_SUFFIX = '.sha256.json'
export const PACK_MANIFEST_SCHEMA = 'automatos-theme-pack/v1'

export interface PackManifest {
  readonly schema: typeof PACK_MANIFEST_SCHEMA
  readonly id: string
  readonly version: string
  readonly digest: string
  readonly zipSha256: string
  readonly files: Readonly<Record<string, FileRow>>
}

export type PackResult =
  | { readonly ok: true; readonly file: string; readonly manifestFile: string; readonly bytes: number; readonly manifest: PackManifest }
  | { readonly ok: false; readonly errors: readonly ThemeError[] }

/** `<publisher>.<slug>-<version>`: the id's slash becomes a dot (a checked id has exactly one). */
export function packageBaseName(id: string, version: string): string {
  return `${id.replace('/', '.')}-${version}`
}

/** The digest of the files inside `zip`, as the server will compute it on upload. */
function digestOfZip(zip: Buffer): string {
  return packageDigest(Object.fromEntries(readZip(zip).map((entry) => [entry.path, sha256Hex(entry.data)])))
}

/** Checks the theme folder and, when core would accept it, writes its package to `outDir`. */
export function packTheme(themeDir: string, outDir: string): PackResult {
  const checked = checkPackage(collectThemeFiles(themeDir))
  if (checked.manifest === null) return { ok: false, errors: checked.errors }
  const zip = writeZip(Array.from(checked.files, ([path, file]) => ({ path, data: file.data })))
  if (zip.length > CAPS.package) {
    const message = `A theme package must be ${CAPS.package / MB} MB or smaller; this one is ${zip.length} bytes.`
    return { ok: false, errors: [themeError('PACKAGE_TOO_LARGE', '', message)] }
  }
  const files = fileManifest(checked.files)
  const digest = digestOfManifest(files)
  if (digestOfZip(zip) !== digest) throw new Error('the written zip does not hold the checked files (digest mismatch)')
  const id = String(checked.manifest.id)
  const version = String(checked.manifest.version)
  const manifest: PackManifest = { schema: PACK_MANIFEST_SCHEMA, id, version, digest, zipSha256: sha256Hex(zip), files }
  const base = join(outDir, packageBaseName(id, version))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(`${base}${PACKAGE_EXTENSION}`, zip)
  writeFileSync(`${base}${MANIFEST_SUFFIX}`, `${JSON.stringify(manifest, null, 2)}\n`)
  return { ok: true, file: `${base}${PACKAGE_EXTENSION}`, manifestFile: `${base}${MANIFEST_SUFFIX}`, bytes: zip.length, manifest }
}
