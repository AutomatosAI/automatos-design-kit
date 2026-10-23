/**
 * A phone's fonts (theme.json's `mobile` block, host 1.1.0): `assets/fonts/mobile/<NAME>.ttf` and `.otf`,
 * each one sfnt face (src/files.ts `sfntProblem`), checked as core's reader checks them
 * (orchestrator/services/themes/package.py `_sfnt_problem`). The faces are headers built here, as core's
 * tests/test_prd261_mobile_package.py builds them: no real font is in either repo.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkPackage } from '../src/check-package.ts'
import { byText, collectThemeFiles } from '../src/collect.ts'
import { FILE_KINDS, fileKind, KB, sfntProblem } from '../src/files.ts'
import type { PackageEntry } from '../src/members.ts'

type JsonObject = Readonly<Record<string, unknown>>
type Span = readonly [offset: number, length: number]

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const MANIFEST = 'theme.json'
const MOBILE_ENGINES = { automatos: '^1.1.0', sdk: '^1.0.0' }
const TOKENS = { light: { '--background': '0 0% 100%', '--foreground': '#14181c' } }
const SANS = 'assets/fonts/mobile/sans.ttf'
const SERIF = 'assets/fonts/mobile/serif.otf'
/** core package.py FONT_MAX_BYTES. */
const FONT_MAX_BYTES = 400 * KB
const HEADER_BYTES = 12
const RECORD_BYTES = 16
const TABLE_BYTES = 4

function bytesOf(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

const TRUETYPE = [0x00, 0x01, 0x00, 0x00]
const APPLE_TRUETYPE = bytesOf('true')
const OPENTYPE = bytesOf('OTTO')

/**
 * An sfnt face: its header, `count` table records and one table of `body` bytes after the directory. By
 * default every record spans that one table; `spans` gives each record's offset and length.
 */
function face(version: readonly number[] = TRUETYPE, count = 1, spans?: readonly Span[], body = TABLE_BYTES): Uint8Array {
  const directoryEnd = HEADER_BYTES + RECORD_BYTES * count
  const records = spans ?? Array.from({ length: count }, (): Span => [directoryEnd, body])
  const data = new Uint8Array(directoryEnd + body)
  const view = new DataView(data.buffer)
  data.set(version, 0)
  view.setUint16(4, count)
  view.setUint16(6, RECORD_BYTES)
  records.forEach(([offset, length], index) => {
    const at = HEADER_BYTES + index * RECORD_BYTES
    data.set(bytesOf(`t${String(index).padStart(3, '0')}`), at)
    view.setUint32(at + 8, offset)
    view.setUint32(at + 12, length)
  })
  return data
}

/** `data` with its header's numTables replaced, the records left as they are. */
function withCount(data: Uint8Array, count: number): Uint8Array {
  const copy = Uint8Array.from(data)
  new DataView(copy.buffer).setUint16(4, count)
  return copy
}

/** The hello package with theme.json's fields set (`mobile` and an engines range that admits it) and `files` added. */
function helloPackage(mobile: JsonObject, files: Readonly<Record<string, Uint8Array>> = {}): PackageEntry[] {
  const hello = collectThemeFiles(HELLO_DIR)
  const manifest = JSON.parse(new TextDecoder().decode(hello.find((entry) => entry.path === MANIFEST)?.data)) as JsonObject
  const changed = new TextEncoder().encode(`${JSON.stringify({ ...manifest, engines: MOBILE_ENGINES, mobile }, null, 2)}\n`)
  const entries = new Map<string, Uint8Array>([...hello.map((entry): [string, Uint8Array] => [entry.path, entry.data]), [MANIFEST, changed]])
  Object.entries(files).forEach(([path, data]) => entries.set(path, data))
  return Array.from(entries, ([path, data]) => ({ path, data })).sort((a, b) => byText(a.path, b.path))
}

/** The one refusal's message, once it is `code` at `path` and one plain line. */
function onlyError(entries: readonly PackageEntry[], code: string, path: string): string {
  const { errors, manifest } = checkPackage(entries)
  expect(errors.map((error) => [error.code, error.path])).toEqual([[code, path]])
  expect(manifest).toBeNull()
  const { message } = errors[0]
  expect(message.trim()).not.toBe('')
  expect(message).not.toContain('\n')
  return message
}

describe('a phone font is one TrueType or OpenType face', () => {
  const versions: readonly (readonly [string, readonly number[]])[] = [
    ['00 01 00 00', TRUETYPE], ['true', APPLE_TRUETYPE], ['OTTO', OPENTYPE],
  ]
  const kinds: readonly (readonly [string, string])[] = [[SANS, 'font/ttf'], [SERIF, 'font/otf']]

  it.each(versions.flatMap(([name, version]) => kinds.map(([path, served]) => [name, path, served, version] as const)))(
    'a %s face at %s passes, served as %s',
    (_name, path, served, version) => {
      const result = checkPackage(helloPackage({ tokens: TOKENS, fonts: { sans: path } }, { [path]: face(version) }))
      expect(result.errors).toEqual([])
      expect(result.manifest).not.toBeNull()
      expect(result.files.get(path)?.contentType).toBe(served)
    },
  )

  it('passes a face whose tables each lie inside the file, both ending on its last byte', () => {
    const data = face(TRUETYPE, 2, [[44, 4], [40, 8]]) // the directory ends at byte 44, the file at 48
    expect(data.length).toBe(48)
    expect(sfntProblem(data)).toBeNull()
    expect(checkPackage(helloPackage({ tokens: TOKENS, fonts: { sans: SANS } }, { [SANS]: data })).errors).toEqual([])
  })

  it.each([
    ['a collection (ttcf)', face(bytesOf('ttcf')), 'it is a font collection (ttcf), and a theme ships one face per file'],
    ['a woff2', face(bytesOf('wOF2')), 'its bytes are not a TrueType or OpenType font'],
    ['an empty file', new Uint8Array(0), 'the file is empty'],
    ['a short header', Uint8Array.of(...TRUETYPE, 0x00, 0x01), 'its font header is cut short'],
    ['no tables', Uint8Array.of(...TRUETYPE, ...new Array<number>(8 + RECORD_BYTES).fill(0)), 'its header lists 0 tables, and a font holds 1 to 64'],
    ['65 tables', face(TRUETYPE, 65), 'its header lists 65 tables, and a font holds 1 to 64'],
    ['a directory past the end', withCount(face(), 2), 'its table directory runs past the end of the file'],
    ['a record past the end', face(TRUETYPE, 1, [[28, TABLE_BYTES + 1]]), 'its table 1 of 1 runs past the end of the file'],
    ['a second record past the end', face(TRUETYPE, 2, [[44, 4], [44, 5]]), 'its table 2 of 2 runs past the end of the file'],
  ])('refuses %s as BAD_FILE_TYPE with the reason', (_name, data, reason) => {
    expect(sfntProblem(data)).toBe(reason)
    const message = onlyError(helloPackage({ tokens: TOKENS, fonts: { sans: SANS } }, { [SANS]: data }), 'BAD_FILE_TYPE', SANS)
    expect(message).toBe(`${SANS}: ${reason}.`)
  })

  it('names a record by its index, never by its tag', () => {
    const data = face(TRUETYPE, 1, [[28, TABLE_BYTES + 1]])
    data.set(bytesOf('<b>!'), HEADER_BYTES)
    expect(sfntProblem(data)).not.toContain('<b>!')
  })

  it('checks the bytes whatever the block names: a face nothing names is still read', () => {
    onlyError(helloPackage({ tokens: TOKENS }, { [SANS]: withCount(face(), 2) }), 'BAD_FILE_TYPE', SANS)
  })

  it('passes a face at the font cap; one byte more is FILE_TOO_LARGE', () => {
    const atCap = FONT_MAX_BYTES - HEADER_BYTES - RECORD_BYTES
    expect(checkPackage(helloPackage({ tokens: TOKENS }, { [SANS]: face(TRUETYPE, 1, undefined, atCap) })).errors).toEqual([])
    onlyError(helloPackage({ tokens: TOKENS }, { [SANS]: face(TRUETYPE, 1, undefined, atCap + 1) }), 'FILE_TOO_LARGE', SANS)
  })
})

describe('the two phone font kinds', () => {
  it('sit after the woff2 font, served as font/ttf and font/otf under the font cap', () => {
    const names = FILE_KINDS.map((kind) => kind.name)
    const at = names.indexOf('font')
    expect(names.slice(at, at + 3)).toEqual(['font', 'mobile-font', 'mobile-font'])
    expect([fileKind(SANS)?.contentType, fileKind(SERIF)?.contentType]).toEqual(['font/ttf', 'font/otf'])
    expect([fileKind(SANS)?.cap, fileKind(SERIF)?.cap]).toEqual([FONT_MAX_BYTES, FONT_MAX_BYTES])
    expect([fileKind(SANS)?.tooLargeCode, fileKind(SERIF)?.tooLargeCode]).toEqual(['FILE_TOO_LARGE', 'FILE_TOO_LARGE'])
    expect(fileKind(SANS)?.check).toBe(sfntProblem)
    expect(fileKind(SERIF)?.check).toBe(sfntProblem)
    expect(fileKind('assets/fonts/inter.woff2')?.contentType).toBe('font/woff2')
  })

  it.each([
    'assets/fonts/mobile/x.woff2', 'assets/fonts/x.ttf', 'assets/fonts/x.otf', 'assets/fonts/mobile/x.TTF',
    'assets/fonts/mobile/inner/x.ttf',
  ])('%s matches no kind, so the package is NOT_ALLOWED', (path) => {
    expect(fileKind(path)).toBeUndefined()
    onlyError(helloPackage({ tokens: TOKENS }, { [path]: face() }), 'NOT_ALLOWED', path)
  })
})
