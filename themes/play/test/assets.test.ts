// Play's files in the package: Auto's 36 clips and stills (core's frontend/public/auto, byte for byte)
// under assets/mascot/, and the display faces with their licences (core's app/fonts/play) under
// assets/fonts/. Each file is a kind core's package check accepts (orchestrator/services/themes/package.py),
// within its cap, and the code names each by the path the package holds it at: the mascot through the
// SDK's assetUrl, the faces through play-fonts.css's url()s, relative to dist/theme.css.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clipUrls, MASCOT_DIR, posterUrl, type VideoFormat } from '../src/lib/mascot/media.ts'
import { MASCOT_STATES } from '../src/lib/mascot/types.ts'
import { stripComments } from './css-rules.ts'
import { askedPaths, setFilesRoot } from './sdk-stub.ts'
import { readSource, sourceScripts, SOURCE_ROOT, THEME_ROOT } from './source-files.ts'

const KB = 1024
/** core's caps: THEME_MAX_CLIP_KB (contract.py), IMAGE_MAX_BYTES, FONT_MAX_BYTES and TEXT_MAX_BYTES (package.py). */
const CLIP_MAX_BYTES = 1024 * KB
const IMAGE_MAX_BYTES = 512 * KB
const FONT_MAX_BYTES = 400 * KB
const TEXT_MAX_BYTES = 256 * KB
const MASCOT_FOLDER = join(THEME_ROOT, 'assets', 'mascot')
const FONTS_FOLDER = join(THEME_ROOT, 'assets', 'fonts')
const FONTS_CSS = 'app/play-fonts.css'
const VIDEO_FORMATS: readonly VideoFormat[] = ['webm', 'mp4']
const STILL = 'png'
/** core's package NAME, lower case only, as assetUrl takes a path. */
const MASCOT_FILE = /^[a-z0-9][a-z0-9._-]{0,127}\.(?:png|webm|mp4)$/
/** core's package NAME; the licence files keep core's upper-case names. */
const FONT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:woff2|txt|md)$/
const FILES_ROOT = '/api/themes/files/0123abcd/'
const FONT_URL = /url\(\s*["']?([^"')\s]+)["']?\s*\)/g
const PACKAGE_FONT_URL = /^\.\.\/assets\/fonts\/([A-Za-z0-9][A-Za-z0-9._-]*\.woff2)$/

type Check = (bytes: Buffer) => boolean
/** core's byte checks (package.py IS_PNG, IS_WEBM, IS_MP4) and the woff2 signature. */
const SIGNATURES: Readonly<Record<string, Check>> = {
  png: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webm: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  mp4: (bytes) => bytes.subarray(4, 8).toString('latin1') === 'ftyp',
  woff2: (bytes) => bytes.subarray(0, 4).toString('latin1') === 'wOF2',
}

function extension(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1)
}

function mascotFiles(): string[] {
  return readdirSync(MASCOT_FOLDER).filter((name) => !name.startsWith('.')).sort()
}

function fontFiles(): string[] {
  return readdirSync(FONTS_FOLDER).filter((name) => !name.startsWith('.')).sort()
}

describe("Auto's files, assets/mascot", () => {
  it('hold a still and both clips for every state, and nothing else', () => {
    const expected = MASCOT_STATES.flatMap((state) => [STILL, ...VIDEO_FORMATS].map((format) => `${state}.${format}`))
    expect(mascotFiles()).toEqual(expected.sort())
  })

  it.each(mascotFiles())('%s is a lower-case package name, the right bytes and within its cap', (name) => {
    const bytes = readFileSync(join(MASCOT_FOLDER, name))
    expect(name).toMatch(MASCOT_FILE)
    expect(SIGNATURES[extension(name)](bytes)).toBe(true)
    expect(bytes.length).toBeLessThanOrEqual(extension(name) === STILL ? IMAGE_MAX_BYTES : CLIP_MAX_BYTES)
  })
})

describe("the mascot's URLs", () => {
  it("come from the SDK's assetUrl, for files the package holds", () => {
    setFilesRoot(FILES_ROOT)
    expect(MASCOT_DIR).toBe('assets/mascot')
    expect(posterUrl('idle')).toBe(`${FILES_ROOT}assets/mascot/idle.png`)
    expect(clipUrls('hello', 'webm')).toEqual({
      video: `${FILES_ROOT}assets/mascot/hello.webm`, poster: `${FILES_ROOT}assets/mascot/hello.png`,
    })
    MASCOT_STATES.forEach((state) => VIDEO_FORMATS.forEach((format) => clipUrls(state, format)))
    const asked = Array.from(new Set(askedPaths()))
    expect(asked.length).toBe(mascotFiles().length)
    expect(asked.filter((path) => !existsSync(join(THEME_ROOT, path)))).toEqual([])
  })

  it('are undefined while the host names no package, so nothing loads', () => {
    setFilesRoot(null)
    expect(posterUrl('lost')).toBeUndefined()
    expect(clipUrls('oops', 'mp4')).toEqual({ video: undefined, poster: undefined })
  })

  it("never name core's /auto/ folder", () => {
    const named = sourceScripts().filter((rel) => /['"`]\/auto(?:\/|['"`])/.test(readSource(rel)))
    expect(named).toEqual([])
  })
})

/** The url()s of play-fonts.css, in order. */
function fontUrls(): string[] {
  return Array.from(stripComments(readSource(FONTS_CSS)).matchAll(FONT_URL), (match) => match[1])
}

describe('the display faces, assets/fonts', () => {
  it('hold the woff2 files play-fonts.css names, by paths relative to dist/theme.css', () => {
    const named = fontUrls().map((url) => PACKAGE_FONT_URL.exec(url)?.[1] ?? `not a package font path: ${url}`)
    expect(named.length).toBeGreaterThan(0)
    expect([...named].sort()).toEqual(fontFiles().filter((name) => name.endsWith('.woff2')))
  })

  it('stay as written in the build: src/ holds no assets/ for Vite to inline from', () => {
    expect(existsSync(join(SOURCE_ROOT, 'assets'))).toBe(false)
  })

  it.each(fontFiles())('%s is a package name, the right kind and within its cap', (name) => {
    const path = join(FONTS_FOLDER, name)
    expect(name).toMatch(FONT_FILE)
    if (name.endsWith('.woff2')) {
      expect(SIGNATURES.woff2(readFileSync(path))).toBe(true)
      expect(statSync(path).size).toBeLessThanOrEqual(FONT_MAX_BYTES)
    } else {
      expect(statSync(path).size).toBeLessThanOrEqual(TEXT_MAX_BYTES)
    }
  })

  it('carry the licence of every family beside its files', () => {
    const families = new Set(fontFiles().filter((name) => name.endsWith('.woff2')).map((name) => name.split('-latin-')[0]))
    expect(families.size).toBeGreaterThan(0)
    families.forEach((family) => expect(existsSync(join(FONTS_FOLDER, `LICENSE-${family}.txt`)), family).toBe(true))
  })

  it("define every --pl-font-* variable the catalogue's type styles read", () => {
    const read = new Set(Array.from(readSource('lib/looks/catalogue.ts').matchAll(/var\((--pl-font-[\w-]+)\)/g), (m) => m[1]))
    expect(read.size).toBeGreaterThan(0)
    const fonts = stripComments(readSource(FONTS_CSS))
    expect(Array.from(read).filter((name) => !fonts.includes(`${name}: play-`))).toEqual([])
  })
})
