/**
 * The files a theme package may hold, their caps and their byte checks.
 *
 * A port of `FILE_KINDS`, the caps and the byte sniffers of core's
 * orchestrator/services/themes/package.py (and `check_woff2` of
 * orchestrator/modules/documents/brand_fonts.py). Each path matches at most one kind; a path that
 * matches none can't be in a package. The caps are the server's defaults (PRD-261 Q25, D1):
 * package 10 MB, JS plus CSS 3 MB, the entry 300 KB, each mascot clip 1 MB.
 */

export const KB = 1024
export const MB = 1024 * KB

export const CAPS = Object.freeze({
  package: 10 * MB,
  code: 3072 * KB,
  entry: 300 * KB,
  clip: 1024 * KB,
})

export const MAX_MEMBERS = 500
export const UNCOMPRESSED_MAX_BYTES = 50 * MB
const JSON_MAX_BYTES = 64 * KB
const PREPAINT_MAX_BYTES = 256 * KB
const TEXT_MAX_BYTES = 256 * KB
const SOURCE_MAX_BYTES = 1 * MB
const FONT_MAX_BYTES = 400 * KB
const IMAGE_MAX_BYTES = 512 * KB
const WOFF2_MAX_BYTES = 2 * MB
const WOFF2_HEADER_BYTES = 48
const WOFF2_COLLECTION_FLAVOR = 0x74746366 // "ttcf"
const WOFF2_FLAVORS: ReadonlySet<number> = new Set([0x00010000, 0x4f54544f])

const NAME = '[A-Za-z0-9][A-Za-z0-9._-]{0,127}'
const LOOK_ID = '[A-Za-z0-9][A-Za-z0-9_-]{0,63}'
const SOURCE_EXTENSIONS = '(?:ts|tsx|js|jsx|mjs|cjs|css|json|md|txt)'
const TEXT_TYPE = 'text/plain; charset=utf-8'

/** The kinds whose bytes count as the theme's code (JS plus CSS). */
export const CODE_KINDS: ReadonlySet<string> = new Set(['entry', 'chunk', 'style'])

/** Why `data` is not what its path says, or null. Text kinds (no check) must be UTF-8. */
export type ByteCheck = (data: Uint8Array) => string | null

export interface FileKind {
  readonly name: string
  readonly pattern: RegExp
  readonly contentType: string
  readonly cap: number
  readonly tooLargeCode: string
  readonly check: ByteCheck | null
}

function ascii(data: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...data.subarray(start, end))
}

function sniff(test: (data: Uint8Array) => boolean, what: string): ByteCheck {
  return (data) => (test(data) ? null : `its bytes are not ${what}`)
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3]

function startsWith(data: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => data[index] === byte)
}

const IS_PNG = sniff((data) => startsWith(data, PNG_SIGNATURE), 'a PNG image')
const IS_WEBP = sniff((data) => ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 12) === 'WEBP', 'a WebP image')
const IS_WEBM = sniff((data) => startsWith(data, WEBM_SIGNATURE), 'a WebM video')
const IS_MP4 = sniff((data) => ascii(data, 4, 8) === 'ftyp', 'an MP4 video')

/** Why `data` is not one complete woff2 face, or null (brand_fonts.py `check_woff2`). */
export function woff2Problem(data: Uint8Array): string | null {
  if (data.length === 0) return 'The uploaded file is empty.'
  if (data.length > WOFF2_MAX_BYTES) return `A font file must be ${WOFF2_MAX_BYTES / MB} MB or smaller.`
  if (ascii(data, 0, 4) !== 'wOF2') return 'A font file must be a woff2 font: convert a TTF or OTF file to woff2 first.'
  if (data.length < WOFF2_HEADER_BYTES) return 'The woff2 header is incomplete: is the file a complete woff2 font?'
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const flavor = view.getUint32(4)
  const length = view.getUint32(8)
  if (length !== data.length) return `The woff2 file is incomplete: its header says ${length} bytes, the upload has ${data.length}.`
  if (flavor === WOFF2_COLLECTION_FLAVOR) return 'A font collection is not supported: upload one face per file.'
  if (!WOFF2_FLAVORS.has(flavor)) return 'The woff2 file does not hold a TrueType or OpenType font.'
  if (view.getUint16(12) === 0) return 'The woff2 file holds no font tables.'
  return null
}

function kind(
  name: string, path: string, contentType: string, cap: number, tooLargeCode = 'FILE_TOO_LARGE', check: ByteCheck | null = null,
): FileKind {
  return Object.freeze({ name, pattern: new RegExp(`^(?:${path})$`), contentType, cap, tooLargeCode, check })
}

/** PRD-261 §4.2's layout, in package.py's order. */
export const FILE_KINDS: readonly FileKind[] = Object.freeze([
  kind('manifest', String.raw`theme\.json`, 'application/json', JSON_MAX_BYTES),
  kind('entry', String.raw`dist/entry\.js`, 'text/javascript', CAPS.entry, 'ENTRY_TOO_LARGE'),
  kind('chunk', String.raw`dist/chunks/${NAME}\.js`, 'text/javascript', CAPS.code, 'CODE_TOO_LARGE'),
  kind('style', String.raw`dist/theme\.css`, 'text/css', CAPS.code, 'CODE_TOO_LARGE'),
  kind('prepaint', String.raw`boot/prepaint\.json`, 'application/json', PREPAINT_MAX_BYTES),
  kind('look-schema', String.raw`looks/schema\.json`, 'application/json', JSON_MAX_BYTES),
  kind('preset', String.raw`looks/presets/${LOOK_ID}\.look\.json`, 'application/json', JSON_MAX_BYTES),
  kind('font', String.raw`assets/fonts/${NAME}\.woff2`, 'font/woff2', FONT_MAX_BYTES, 'FILE_TOO_LARGE', woff2Problem),
  kind('licence', String.raw`assets/fonts/${NAME}\.(?:txt|md)`, TEXT_TYPE, TEXT_MAX_BYTES),
  kind('clip', String.raw`assets/mascot/${NAME}\.webm`, 'video/webm', CAPS.clip, 'CLIP_TOO_LARGE', IS_WEBM),
  kind('clip', String.raw`assets/mascot/${NAME}\.mp4`, 'video/mp4', CAPS.clip, 'CLIP_TOO_LARGE', IS_MP4),
  kind('still', String.raw`assets/mascot/${NAME}\.png`, 'image/png', IMAGE_MAX_BYTES, 'FILE_TOO_LARGE', IS_PNG),
  kind('brand', String.raw`assets/brand/${NAME}\.png`, 'image/png', IMAGE_MAX_BYTES, 'FILE_TOO_LARGE', IS_PNG),
  kind('brand', String.raw`assets/brand/${NAME}\.webp`, 'image/webp', IMAGE_MAX_BYTES, 'FILE_TOO_LARGE', IS_WEBP),
  kind('preview', String.raw`assets/previews/${NAME}\.png`, 'image/png', IMAGE_MAX_BYTES, 'FILE_TOO_LARGE', IS_PNG),
  kind('source', String.raw`source/(?:${NAME}/){0,7}${NAME}\.${SOURCE_EXTENSIONS}`, TEXT_TYPE, SOURCE_MAX_BYTES),
  kind('doc', String.raw`(?:README\.md|CHANGELOG\.md|LICENSE(?:\.md|\.txt)?)`, TEXT_TYPE, TEXT_MAX_BYTES),
])

/** The kind of file `path` names, or undefined when nothing may live there. */
export function fileKind(path: string): FileKind | undefined {
  return FILE_KINDS.find((candidate) => candidate.pattern.test(path))
}
