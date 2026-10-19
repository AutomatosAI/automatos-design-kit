/**
 * The reader's first two passes over a package's files: their paths, then their bytes.
 *
 * A port of `_member_error`, `_checked_members` and `_read_files` in core's
 * orchestrator/services/themes/package.py. The server stops after a pass that refused anything,
 * so a refusal here is reported alone, with that pass's codes only, as the server would.
 */
import { echo, themeError, type ThemeError } from './core/css-value.ts'
import { fileKind, KB, MAX_MEMBERS, UNCOMPRESSED_MAX_BYTES, type FileKind } from './files.ts'

/** One package file as a theme folder or a zip gives it. */
export interface PackageEntry {
  readonly path: string
  readonly data: Uint8Array
  /** True for a symbolic link (the server refuses links). */
  readonly link?: boolean
}

/** A file whose path and bytes passed: its bytes and the content type it is served as. */
export interface CheckedFile {
  readonly data: Uint8Array
  readonly contentType: string
}

const DRIVE_PREFIX = /^[A-Za-z]:/
const CONTROL_CHAR = /[\x00-\x1f\x7f]/

function isUnsafe(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || DRIVE_PREFIX.test(path)) return true
  return path.split('/').includes('..') || CONTROL_CHAR.test(path)
}

function memberError(entry: PackageEntry, seen: ReadonlySet<string>): ThemeError | null {
  const { path } = entry
  const shown = echo(path)
  if (entry.link === true) return themeError('SYMLINK', path, `${shown} is a link: a theme package can't hold links.`)
  if (isUnsafe(path)) return themeError('UNSAFE_PATH', path, `${shown} is not a plain relative path inside the package.`)
  if (seen.has(path.toLowerCase())) {
    return themeError('DUPLICATE_FILE', path, (
      `${shown} is in the package more than once (names that differ only in capitals count as the same file).`
    ))
  }
  if (path.toLowerCase().endsWith('.svg')) {
    return themeError('SVG_NOT_ALLOWED', path, `${shown} is an SVG: a theme can't ship SVG files. Use PNG or WebP.`)
  }
  if (fileKind(path) === undefined) {
    return themeError('NOT_ALLOWED', path, `${shown} isn't a file a theme package may hold (see PRD-261 §4.2).`)
  }
  return null
}

/** Every path refusal, the member count and the unpacked total; empty when the paths pass. */
export function pathErrors(entries: readonly PackageEntry[]): ThemeError[] {
  if (entries.length > MAX_MEMBERS) {
    return [themeError('TOO_MANY_FILES', '', `A theme package holds at most ${MAX_MEMBERS} entries.`)]
  }
  const seen = new Set<string>()
  const errors: ThemeError[] = []
  entries.forEach((entry) => {
    const error = memberError(entry, seen)
    if (error !== null) errors.push(error)
    seen.add(entry.path.toLowerCase())
  })
  if (errors.length > 0) return errors
  const total = entries.reduce((sum, entry) => sum + entry.data.length, 0)
  if (total > UNCOMPRESSED_MAX_BYTES) {
    return [themeError('UNCOMPRESSED_TOO_LARGE', '', "The package's files unpack to more than the package limit.")]
  }
  return []
}

function isUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data)
    return true
  } catch {
    return false
  }
}

/** Why `data` isn't what `path` says, or null. */
function contentError(kind: FileKind, path: string, data: Uint8Array): ThemeError | null {
  if (kind.check !== null) {
    const problem = kind.check(data)
    return problem === null ? null : themeError('BAD_FILE_TYPE', path, `${path}: ${problem.replace(/\.+$/, '')}.`)
  }
  return isUtf8(data) ? null : themeError('NOT_UTF8', path, `${path} must be UTF-8 text.`)
}

/** One file's refusal against its cap and what is left of the package total, or null. */
function sizeError(kind: FileKind, path: string, size: number, left: number): ThemeError | null {
  if (size <= Math.min(kind.cap, left)) return null
  if (kind.cap <= left) return themeError(kind.tooLargeCode, path, `${path} is over its limit of ${Math.floor(kind.cap / KB)} KB.`)
  return themeError('UNCOMPRESSED_TOO_LARGE', path, "The package's files unpack to more than the package limit.")
}

export interface ReadResult {
  readonly files: ReadonlyMap<string, CheckedFile>
  readonly errors: readonly ThemeError[]
}

/** Every file's size and bytes checked (paths must have passed `pathErrors`); all refusals at once. */
export function readFiles(entries: readonly PackageEntry[]): ReadResult {
  const files = new Map<string, CheckedFile>()
  const errors: ThemeError[] = []
  let left = UNCOMPRESSED_MAX_BYTES
  entries.forEach(({ path, data }) => {
    const kind = fileKind(path)
    if (kind === undefined) throw new Error(`${path} reached readFiles without passing pathErrors`)
    const tooLarge = sizeError(kind, path, data.length, left)
    if (tooLarge !== null) {
      errors.push(tooLarge)
      return
    }
    left -= data.length
    const error = contentError(kind, path, data)
    if (error !== null) errors.push(error)
    files.set(path, { data, contentType: kind.contentType })
  })
  return { files, errors }
}
