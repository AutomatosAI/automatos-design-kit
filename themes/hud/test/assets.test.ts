// @vitest-environment node
// HUD's files in the package. Auto's 36 clips and stills under assets/mascot/ are Play's, byte for byte (each held
// to the sha256 and size in test/fixtures/mascot-files.json, Play's list of core's bytes), each a kind core's package
// check accepts and within its cap, and the code names them through the SDK's assetUrl. The display faces under
// assets/fonts/ are the woff2 files hud-fonts.css names by paths relative to dist/theme.css, with their licences,
// each file held to the sha256 assets/fonts/README.md gives it, and theme.json lists exactly those faces.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { host } from '@automatos/theme-harness/host'
import { describe, expect, it } from 'vitest'
import { clipUrls, MASCOT_DIR, posterUrl, type VideoFormat } from '@automatos/mascot/media'
import { MASCOT_STATES } from '@automatos/mascot/types'
import { KIT_ROOT, readSource, readThemeFile, readThemeJson, SOURCE_ROOT, THEME_ROOT } from './support/files.ts'

const KB = 1024
/** core's caps (package.py): a clip, a still, a font and a text file. */
const CLIP_MAX_BYTES = 1024 * KB
const IMAGE_MAX_BYTES = 512 * KB
const FONT_MAX_BYTES = 400 * KB
const TEXT_MAX_BYTES = 256 * KB
const MASCOT_FOLDER = join(THEME_ROOT, 'assets', 'mascot')
const PLAY_MASCOT_FOLDER = join(KIT_ROOT, 'themes', 'play', 'assets', 'mascot')
const FONTS_FOLDER = join(THEME_ROOT, 'assets', 'fonts')
const FONTS_CSS = 'app/hud-fonts.css'
const VIDEO_FORMATS: readonly VideoFormat[] = ['webm', 'mp4']
const STILL = 'png'
const MASCOT_FILE = /^[a-z0-9][a-z0-9._-]{0,127}\.(?:png|webm|mp4)$/
const FONT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:woff2|txt|md)$/
const FILES_ROOT = '/api/themes/files/0123abcd/'
const FONT_URL = /url\(\s*["']?([^"')\s]+)["']?\s*\)/g
const PACKAGE_FONT_URL = /^\.\.\/assets\/fonts\/([A-Za-z0-9][A-Za-z0-9._-]*\.woff2)$/
/** A row of assets/fonts/README.md's table: the file in backticks first, its sha256 in backticks later. */
const README_ROW = /^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|/gm

type Check = (bytes: Buffer) => boolean
/** core's byte checks (package.py IS_PNG, IS_WEBM, IS_MP4) and the woff2 signature. */
const SIGNATURES: Readonly<Record<string, Check>> = {
  png: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webm: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  mp4: (bytes) => bytes.subarray(4, 8).toString('latin1') === 'ftyp',
  woff2: (bytes) => bytes.subarray(0, 4).toString('latin1') === 'wOF2',
}

type Checksum = { readonly sha256: string; readonly bytes: number }

function extension(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1)
}

function visible(folder: string): string[] {
  return readdirSync(folder).filter((name) => !name.startsWith('.')).sort()
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function checksums(folder: string): Record<string, Checksum> {
  return Object.fromEntries(visible(folder).map((name) => {
    const path = join(folder, name)
    return [name, { sha256: sha256(path), bytes: statSync(path).size }]
  }))
}

describe("Auto's files, assets/mascot", () => {
  it('hold a still and both clips for every state, and nothing else', () => {
    const expected = MASCOT_STATES.flatMap((state) => [STILL, ...VIDEO_FORMATS].map((format) => `${state}.${format}`))
    expect(visible(MASCOT_FOLDER)).toEqual(expected.sort())
  })

  it.each(visible(MASCOT_FOLDER))('%s is a lower-case package name, the right bytes and within its cap', (name) => {
    const bytes = readFileSync(join(MASCOT_FOLDER, name))
    expect(name).toMatch(MASCOT_FILE)
    expect(SIGNATURES[extension(name)](bytes)).toBe(true)
    expect(bytes.length).toBeLessThanOrEqual(extension(name) === STILL ? IMAGE_MAX_BYTES : CLIP_MAX_BYTES)
  })

  it("are Play's files, byte for byte, as its checksum list has them", () => {
    const listed = readThemeJson<{ files: Record<string, Checksum> }>('test/fixtures/mascot-files.json').files
    const own = checksums(MASCOT_FOLDER)
    expect(own).toEqual(listed)
    expect(own).toEqual(checksums(PLAY_MASCOT_FOLDER))
  })

  it("come from the SDK's assetUrl, for files the package holds", () => {
    host.reset()
    host.setFilesRoot(FILES_ROOT)
    expect(MASCOT_DIR).toBe('assets/mascot')
    expect(posterUrl('idle')).toBe(`${FILES_ROOT}assets/mascot/idle.png`)
    MASCOT_STATES.forEach((state) => VIDEO_FORMATS.forEach((format) => clipUrls(state, format)))
    const asked = Array.from(new Set(host.askedPaths()))
    expect(asked.filter((path) => !existsSync(join(THEME_ROOT, path)))).toEqual([])
  })
})

/** The url()s of hud-fonts.css, in order. */
function fontUrls(): string[] {
  return Array.from(readSource(FONTS_CSS).replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(FONT_URL), (match) => match[1])
}

function fontFiles(): string[] {
  return visible(FONTS_FOLDER)
}

describe('the display faces, assets/fonts', () => {
  it('hold the woff2 files hud-fonts.css names, by paths relative to dist/theme.css, and theme.json lists them', () => {
    const named = fontUrls().map((url) => PACKAGE_FONT_URL.exec(url)?.[1] ?? `not a package font path: ${url}`)
    const woff2 = fontFiles().filter((name) => name.endsWith('.woff2'))
    expect([...named].sort()).toEqual(woff2)
    expect(woff2).toEqual(['chakra-petch-latin-600-normal.woff2', 'rajdhani-latin-700-normal.woff2'])
    expect(readThemeJson<{ fonts: string[] }>('theme.json').fonts).toEqual(woff2.map((name) => `assets/fonts/${name}`))
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

  it('carry the OFL licence of every family beside its files', () => {
    const families = fontFiles().filter((name) => name.endsWith('.woff2')).map((name) => name.split('-latin-')[0])
    families.forEach((family) => {
      const licence = join(FONTS_FOLDER, `LICENSE-${family}.txt`)
      expect(existsSync(licence), family).toBe(true)
      expect(readFileSync(licence, 'utf8')).toContain('SIL Open Font License, Version 1.1')
    })
  })

  it("are each the bytes assets/fonts/README.md's table names", () => {
    const rows = Array.from(readThemeFile('assets/fonts/README.md').matchAll(README_ROW), (match) => [match[1], match[2]])
    const listed = Object.fromEntries(rows)
    const onDisk = Object.fromEntries(fontFiles().filter((name) => name !== 'README.md').map((name) => [name, sha256(join(FONTS_FOLDER, name))]))
    expect(listed).toEqual(onDisk)
  })
})
