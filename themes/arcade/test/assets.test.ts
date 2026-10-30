// @vitest-environment node
// The package's files beside the code: every font is the file assets/fonts/README.md names, by its sha256, with its
// licence beside it; theme.json's fonts are the web's woff2 files and its mobile block's are the TrueType ones, each
// under the 400 KB a font may be; and no colour is written anywhere in src/ but the catalogue, no CSS rule is
// important, and no CSS rule names a bare element, so nothing of Arcade's styles reaches the host's own parts.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS_DIR = join(THEME_DIR, 'assets', 'fonts')
const SRC_DIR = join(THEME_DIR, 'src')
const FONT_CAP_BYTES = 400 * 1024
const CATALOGUE = 'looks/catalogue.ts'

const manifest = JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8')) as {
  readonly fonts: string[]
  readonly mobile: { readonly fonts: Readonly<Record<string, string>> }
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

/** README rows: `file` and its sha256. */
function pinned(): ReadonlyMap<string, string> {
  const readme = readFileSync(join(FONTS_DIR, 'README.md'), 'utf8')
  const rows = [...readme.matchAll(/^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|$/gm)]
  return new Map(rows.map((row) => [row[1], row[2]]))
}

describe('the fonts', () => {
  const files = filesUnder(FONTS_DIR).map((path) => relative(FONTS_DIR, path)).filter((path) => path !== 'README.md')

  it('are each the file the README names, by its sha256', () => {
    const pins = pinned()
    expect([...pins.keys()].sort()).toEqual([...files].sort())
    files.forEach((file) => {
      const sha = createHash('sha256').update(readFileSync(join(FONTS_DIR, file))).digest('hex')
      expect(sha, file).toBe(pins.get(file))
    })
  })

  it("are theme.json's, the web's woff2 and the phone's TrueType, each under 400 KB", () => {
    expect(manifest.fonts.every((path) => path.startsWith('assets/fonts/') && path.endsWith('.woff2'))).toBe(true)
    Object.values(manifest.mobile.fonts).forEach((path) => expect(path).toMatch(/^assets\/fonts\/mobile\/.+\.ttf$/))
    ;[...manifest.fonts, ...Object.values(manifest.mobile.fonts)].forEach((path) => {
      expect(statSync(join(THEME_DIR, path)).size, path).toBeLessThanOrEqual(FONT_CAP_BYTES)
    })
  })

  it('travel with their licences', () => {
    expect(files).toEqual(expect.arrayContaining(['LICENSE-press-start-2p.txt', 'LICENSE-pixelify-sans.txt']))
  })
})

describe('the source', () => {
  const sources = filesUnder(SRC_DIR).map((path) => ({ path: relative(SRC_DIR, path), text: readFileSync(path, 'utf8') }))
  const colour = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/

  it('writes every colour in the catalogue alone', () => {
    const named = sources.filter(({ path, text }) => path !== CATALOGUE && colour.test(text)).map(({ path }) => path)
    expect(named).toEqual([])
  })

  it('marks no CSS rule important and names no bare element in a selector', () => {
    const sheets = sources.filter(({ path }) => path.endsWith('.css'))
    sheets.forEach(({ path, text }) => {
      expect(text, path).not.toMatch(/!important/)
      const selectors = text.replace(/\/\*[\s\S]*?\*\//g, '').match(/^[^@{}\s][^{}]*(?=\{)/gm) ?? []
      selectors.flatMap((selector) => selector.split(',')).map((part) => part.trim()).forEach((part) => {
        expect(part, `${path}: ${part}`).toMatch(/^(?:\.|:root|from|to|\d)/)
      })
    })
  })
})
