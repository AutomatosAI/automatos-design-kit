/**
 * Phone screenshots in a package, and the package cap that holds them (core package.py's phone-preview kinds and
 * contract.py's CAP_SETTINGS['package']): `assets/previews/phone/<NAME>.png` is a PNG and `.jpg` a JPEG, each by its
 * first bytes and at most 512 KB; a `.jpeg`, a `.webp` or a folder below is no package path. `pack` packs every one
 * the theme folder holds, and refuses one theme.json's `phonePreviews` names that isn't there. The package is at most
 * 32 MB: 24 web and 24 phone screenshots at 512 KB each (24 MB) fit beside the code, a package over 32 MB doesn't.
 */
import { randomBytes } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { CAPS, FILE_KINDS, fileKind, KB, MB } from '../src/files.ts'
import { packTheme } from '../src/pack.ts'
import { readZip } from '../src/zip.ts'

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0]
const PHONE = 'assets/previews/phone/'
const WEB = 'assets/previews/'
/** core package.py IMAGE_MAX_BYTES and contract.py CAP_SETTINGS['package'] at the vendored commit. */
const IMAGE_CAP = 512 * KB
const CORE_PACKAGE_CAP = 32 * MB
/** core manifest.py MAX_PREVIEWS: each list of screenshots holds up to this many. */
const MAX_PREVIEWS = 24
/** Enough screenshots at the image cap to pass the package cap, past what one list may name. */
const OVER_CAP_SHOTS = Math.ceil(CORE_PACKAGE_CAP / IMAGE_CAP) + 1
/** Packing tens of megabytes of incompressible bytes at deflate level 9 on a cold runner. */
const BIG_PACK_TIMEOUT_MS = 120_000

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-pack-phone-'))
  folders.push(folder)
  return folder
}

/** `signature`, then `size` bytes in all: random past the signature, so deflate can't shrink a big one. */
function picture(signature: readonly number[], size = signature.length + 4): Uint8Array {
  const data = new Uint8Array(randomBytes(size))
  data.set(signature)
  return data
}

const png = (size?: number): Uint8Array => picture(PNG_SIGNATURE, size)
const jpeg = (size?: number): Uint8Array => picture(JPEG_SIGNATURE, size)

/** A copy of hello with `files` written into it and theme.json's fields set. */
function helloWith(files: Readonly<Record<string, Uint8Array | string>>, fields: Readonly<Record<string, unknown>> = {}): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  Object.entries(files).forEach(([path, data]) => {
    mkdirSync(dirname(join(theme, path)), { recursive: true })
    writeFileSync(join(theme, path), data)
  })
  const manifestPath = join(theme, 'theme.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, ...fields }, null, 2)}\n`)
  return theme
}

/** The codes pack refuses the theme with; it writes nothing into the out folder. */
function refusedCodes(theme: string): string[] {
  const out = tempFolder()
  const result = packTheme(theme, out)
  if (result.ok) throw new Error('expected a refusal, the theme packed')
  expect(readdirSync(out)).toEqual([])
  return Array.from(new Set(result.errors.map((error) => error.code)))
}

describe('the phone screenshot file kinds', () => {
  it.each([
    [`${PHONE}home.png`, 'image/png'],
    [`${PHONE}home-chat.jpg`, 'image/jpeg'],
  ])('%s is a phone screenshot, %s, at most 512 KB', (path, type) => {
    expect(fileKind(path)).toMatchObject({ name: 'phone-preview', contentType: type, cap: IMAGE_CAP, tooLargeCode: 'FILE_TOO_LARGE' })
  })

  it.each([`${PHONE}home.jpeg`, `${PHONE}home.webp`, `${PHONE}home.svg`, `${PHONE}home/chat.png`, `${WEB}home.jpg`])(
    '%s is no package path',
    (path) => expect(fileKind(path)).toBeUndefined(),
  )

  it("leaves a web preview a web preview, and sits after it, in package.py's order", () => {
    expect(fileKind(`${WEB}home.png`)?.name).toBe('preview')
    const names = FILE_KINDS.map((kind) => kind.name)
    const at = names.indexOf('preview')
    expect(names.slice(at, at + 3)).toEqual(['preview', 'phone-preview', 'phone-preview'])
  })

  it('reads a phone screenshot by its first bytes: a .jpg must be a JPEG, a .png a PNG', () => {
    const jpg = fileKind(`${PHONE}home.jpg`)
    const pngKind = fileKind(`${PHONE}home.png`)
    expect([jpg?.check?.(jpeg()), pngKind?.check?.(png())]).toEqual([null, null])
    expect(jpg?.check?.(png())).toBe('its bytes are not a JPEG image')
    expect(pngKind?.check?.(jpeg())).toBe('its bytes are not a PNG image')
  })

  it("holds the package to core's 32 MB", () => {
    expect(CAPS.package).toBe(CORE_PACKAGE_CAP)
  })
})

describe('pack and phone screenshots', () => {
  it('packs every phone screenshot, PNG and JPEG, with its type in the sha256 manifest', () => {
    const shots = { [`${PHONE}default.jpg`]: jpeg(), [`${PHONE}night-chat.png`]: png() }
    const theme = helloWith(shots, { phonePreviews: Object.keys(shots) })
    const result = packTheme(theme, tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => `${error.code} ${error.message}`).join('\n'))
    const packed = new Map(readZip(readFileSync(result.file)).map((entry) => [entry.path, entry.data]))
    Object.entries(shots).forEach(([path, data]) => expect(Buffer.from(packed.get(path) ?? []).equals(data)).toBe(true))
    expect(result.manifest.files[`${PHONE}default.jpg`].type).toBe('image/jpeg')
    expect(result.manifest.files[`${PHONE}night-chat.png`].type).toBe('image/png')
  })

  it.each<[string, Readonly<Record<string, Uint8Array>>, readonly string[], string]>([
    ['a listed screenshot the folder lacks', {}, [`${PHONE}default.jpg`], 'MISSING_FILE'],
    ['a .jpg that is a PNG', { [`${PHONE}default.jpg`]: png() }, [`${PHONE}default.jpg`], 'BAD_FILE_TYPE'],
    ['a screenshot over 512 KB', { [`${PHONE}default.png`]: png(IMAGE_CAP + 1) }, [`${PHONE}default.png`], 'FILE_TOO_LARGE'],
    ['a .jpeg', { [`${PHONE}default.jpeg`]: jpeg() }, [], 'NOT_ALLOWED'],
  ])('refuses %s, and writes nothing', (_label, files, listed, code) => {
    const theme = helloWith(files, listed.length > 0 ? { phonePreviews: listed } : {})
    expect(refusedCodes(theme)).toEqual([code])
  })

  it('packs 24 web and 24 phone screenshots at 512 KB each, 24 MB, under the 32 MB cap', () => {
    const web = Array.from({ length: MAX_PREVIEWS }, (_, index) => `${WEB}default-s${index}.png`)
    const phone = Array.from({ length: MAX_PREVIEWS }, (_, index) => `${PHONE}night-s${index}.jpg`)
    const files = Object.fromEntries([...web.map((path) => [path, png(IMAGE_CAP)]), ...phone.map((path) => [path, jpeg(IMAGE_CAP)])])
    const result = packTheme(helloWith(files, { previews: web, phonePreviews: phone }), tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => `${error.code} ${error.message}`).join('\n'))
    expect(result.bytes).toBeGreaterThan(2 * MAX_PREVIEWS * IMAGE_CAP)
    expect(result.bytes).toBeLessThanOrEqual(CAPS.package)
  }, BIG_PACK_TIMEOUT_MS)

  it('refuses a package over 32 MB, naming the cap', () => {
    const files = Object.fromEntries(Array.from({ length: OVER_CAP_SHOTS }, (_, index) => [`${PHONE}night-s${index}.jpg`, jpeg(IMAGE_CAP)]))
    const result = packTheme(helloWith(files), tempFolder())
    if (result.ok) throw new Error('expected PACKAGE_TOO_LARGE, the theme packed')
    expect(result.errors.map((error) => error.code)).toEqual(['PACKAGE_TOO_LARGE'])
    expect(result.errors[0].message).toMatch(/^A theme package must be 32 MB or smaller; this one is \d+ bytes\.$/)
  }, BIG_PACK_TIMEOUT_MS)
})
