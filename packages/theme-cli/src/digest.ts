/**
 * The hashes that name a theme package and each of its files (core orchestrator/services/themes/digest.py).
 *
 * Each file: the sha256 of its bytes in lower-case hex. The package: the sha256 of its sorted
 * `path\0sha256\n` lines, so the digest depends on the files alone, never on the zip's order,
 * timestamps or compression. Core serves an installed theme's files under this digest.
 */
import { createHash } from 'node:crypto'
import type { CheckedFile } from './members.ts'

export interface FileRow {
  readonly type: string
  readonly size: number
  readonly sha256: string
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** `{path: {type, size, sha256}}` in path order, as the server stores it. */
export function fileManifest(files: ReadonlyMap<string, CheckedFile>): Record<string, FileRow> {
  const paths = Array.from(files.keys()).sort()
  return Object.fromEntries(paths.map((path): [string, FileRow] => {
    const file = files.get(path) as CheckedFile
    return [path, { type: file.contentType, size: file.data.length, sha256: sha256Hex(file.data) }]
  }))
}

/** The package digest from `{path: sha256 hex}`: sha256 of the sorted `path\0sha\n` lines. */
export function packageDigest(fileHashes: Readonly<Record<string, string>>): string {
  const lines = Object.keys(fileHashes).sort().map((path) => `${path}\0${fileHashes[path]}\n`)
  return sha256Hex(lines.join(''))
}

/** The package digest of a file manifest. */
export function digestOfManifest(rows: Readonly<Record<string, FileRow>>): string {
  return packageDigest(Object.fromEntries(Object.entries(rows).map(([path, row]) => [path, row.sha256])))
}
