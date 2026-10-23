// @vitest-environment node
// PRD-261 B-02e: the harness build draws a theme's CSS as the theme's own build makes it. A real build of a small
// theme folder (made-up data, in the system temp folder): CSS modules name its classes first, then the one stylesheet
// the build writes is wrapped under html.<htmlClass> and renamed once over the whole sheet (a font family declared in
// one file and used in another is renamed in both), and its reduced-motion rule is copied under the toolbar's
// attribute. Then the steps alone: the pass over the written files, the media mirror and the selector forms it writes.
// The built page (index.html) also carries the host's fonts as core binds them, apart from the theme's stylesheet:
// a class on <html> for each of core's three variables, and an @font-face for each of core's faces, its file emitted
// byte for byte in the app's own folder, on the harness's origin (the faces as app/fonts/core/README.md pins them).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import postcss, { type AtRule, type ChildNode, type Root, type Rule } from 'postcss'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { FORCED_ACTIVE, HTML_ATTRS, MOTION_REDUCE } from '../src/host/prepaint.ts'
import {
  APP_ASSETS_DIR, harnessConfig, harnessStylesheet, mediaMirror, underAttribute, wrapWrittenStylesheets,
} from '../vite.harness.config.ts'
import { CORE_FONT_VARIABLES, readHostFonts, sha256Of, type HostFace } from './host-fonts-readme.ts'

type Files = Readonly<Record<string, string>>

const HTML_CLASS = 'sample'
const SAMPLE: Files = {
  'theme.json': JSON.stringify({ htmlClass: HTML_CLASS }),
  'src/entry.ts': [
    "import './fonts.css'",
    "import styles from './frame.module.css'",
    '',
    'export const frameClass = styles.frame',
    'export default { register() {} }',
    '',
  ].join('\n'),
  'src/fonts.css': '@font-face { font-family: Brand; src: local("Arial"); }\n',
  'src/frame.module.css': [
    '.frame { font-family: Brand, serif; }',
    ':global(html.sample) .label { color: #101010; }',
    '@media (prefers-reduced-motion: reduce) { .frame { transition: none; } }',
    '',
  ].join('\n'),
}
/** A real build of the harness app (React and the fake SDK with it) on a cold CI runner. */
const BUILD_TIMEOUT_MS = 120_000
const MOTION = `html[${HTML_ATTRS.motion}="${MOTION_REDUCE}"]`
const FORCED = `html[${HTML_ATTRS.forcedColors}="${FORCED_ACTIVE}"]`

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, (char) => `\\${char}`)
/** A rule for a CSS module's class, <htmlClass>-<local>-<5-character hash>, under `prefix`, opening on `body`. */
const moduleRule = (prefix: string, local: string, body: string): RegExp => (
  new RegExp(`${escaped(prefix)} \\.${HTML_CLASS}-${local}-[\\w-]{5} \\{\\s*${escaped(body)}`)
)

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

/** A folder in the system temp directory holding `files`. */
function tempFolder(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'automatos-harness-'))
  folders.push(root)
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  })
  return root
}

/** A harness build of `themeDir`, into a new temp folder; the folder. */
async function builtHarness(themeDir: string): Promise<string> {
  const outDir = tempFolder({})
  const config = harnessConfig(themeDir)
  await build({ ...config, configFile: false, logLevel: 'silent', build: { ...config.build, outDir } })
  return outDir
}

/** The stylesheets a harness build wrote to the app's folder of `outDir`, as text. */
function writtenStylesheets(outDir: string): string[] {
  const dir = join(outDir, APP_ASSETS_DIR)
  return readdirSync(dir).filter((name) => name.endsWith('.css')).map((name) => readFileSync(join(dir, name), 'utf8'))
}

/** The stylesheets a harness build of `themeDir` writes, as text. */
async function builtStylesheets(themeDir: string): Promise<string[]> {
  return writtenStylesheets(await builtHarness(themeDir))
}

const isRule = (node: ChildNode): node is Rule => node.type === 'rule'
const mirrored = (css: string): string => postcss([mediaMirror()]).process(css, { from: undefined }).css

const PAGE_FILE = 'index.html'
const FONT_SUFFIX = '.woff2'
/** next/font's font-display, which core's faces keep. */
const FONT_DISPLAY = 'swap'
const STYLE_ELEMENT = /<style>([\s\S]*?)<\/style>/g
const HTML_CLASS_ATTRIBUTE = /<html\b[^>]*\sclass="([^"]*)"/
const WOFF2_SOURCE = /^url\(\s*(['"]?)([^'")]+)\1\s*\)\s+format\(\s*['"]woff2['"]\s*\)$/
const ONE_FAMILY = /^'[\w-]+'$/
const CLASS_SELECTOR = /^\.[\w-]+$/

/** An @font-face in the built page: its family, the path its woff2 src names, its weight, style and display. */
interface PageFace {
  readonly family: string
  readonly path: string
  readonly weight: string
  readonly style: string
  readonly display: string
}

const unquoted = (value: string): string => value.trim().replace(/^(['"])(.*)\1$/, '$2')

/** The sheet of the built page's one <style> element. */
function pageSheet(page: string): Root {
  const sheets = Array.from(page.matchAll(STYLE_ELEMENT), (match) => match[1] ?? '')
  expect(sheets, 'the page has one <style> element').toHaveLength(1)
  return postcss.parse(sheets[0] ?? '')
}

/** The classes the built page's <html> carries. */
function htmlClassesOf(page: string): string[] {
  return (HTML_CLASS_ATTRIBUTE.exec(page)?.[1] ?? '').split(/\s+/).filter((name) => name !== '')
}

/** A rule's own declarations, by property. */
function declarations(container: AtRule | Rule): Map<string, string> {
  const values = new Map<string, string>()
  container.each((node) => {
    if (node.type === 'decl') values.set(node.prop, node.value)
  })
  return values
}

/** Each @font-face of the sheet. */
function pageFaces(sheet: Root): PageFace[] {
  const faces: PageFace[] = []
  sheet.walkAtRules('font-face', (rule) => {
    const values = declarations(rule)
    const value = (prop: string): string => values.get(prop) ?? ''
    faces.push({
      family: unquoted(value('font-family')),
      path: WOFF2_SOURCE.exec(value('src'))?.[2] ?? '',
      weight: value('font-weight'),
      style: value('font-style'),
      display: value('font-display'),
    })
  })
  return faces
}

/** Each rule of the sheet that sets `variable`: its selector and the value. */
function variableRules(sheet: Root, variable: string): { readonly selector: string; readonly value: string }[] {
  const found: { selector: string; value: string }[] = []
  sheet.walkRules((rule) => {
    const value = declarations(rule).get(variable)
    if (value !== undefined) found.push({ selector: rule.selector, value })
  })
  return found
}

/** The family `variable` is bound to: one rule sets it, on a class the page's <html> carries, to one family. */
function boundFamily(sheet: Root, variable: string, htmlClasses: readonly string[]): string {
  const rules = variableRules(sheet, variable)
  expect(rules, `one rule sets ${variable}`).toHaveLength(1)
  const { selector, value } = rules[0] ?? { selector: '', value: '' }
  expect(selector, `a class sets ${variable}`).toMatch(CLASS_SELECTOR)
  expect(htmlClasses, `<html> carries the class that sets ${variable}`).toContain(selector.slice(1))
  expect(value, `${variable} names one family`).toMatch(ONE_FAMILY)
  return unquoted(value)
}

/** One of core's faces in the page: under `family`, as core declares it, its file emitted byte for byte, on origin. */
function expectFace(
  outDir: string, faces: readonly PageFace[], face: HostFace, family: string, sha256: string | undefined,
): void {
  const stem = basename(face.file, FONT_SUFFIX)
  const file = new RegExp(`^/${escaped(APP_ASSETS_DIR)}/${escaped(stem)}-[\\w-]+${escaped(FONT_SUFFIX)}$`)
  const found = faces.filter((drawn) => drawn.family === family && file.test(drawn.path))
  expect(found, `one @font-face for ${face.file}, from the app's own folder`).toHaveLength(1)
  const { path, weight, style, display } = found[0] ?? { path: '', weight: '', style: '', display: '' }
  const declared = { weight: face.weight, style: face.style, display: FONT_DISPLAY }
  expect({ weight, style, display }, `${face.file} as core declares it`).toEqual(declared)
  expect(sha256Of(readFileSync(join(outDir, path))), `${face.file} emitted byte for byte`).toBe(sha256)
}

describe("the harness build of a theme's CSS", () => {
  it('writes one stylesheet: CSS module names first, then wrapped, renamed over the whole sheet, and mirrored', async () => {
    const sheets = await builtStylesheets(tempFolder(SAMPLE))
    expect(sheets).toHaveLength(1)
    const css = sheets[0] ?? ''
    expect(css).toMatch(moduleRule(`html.${HTML_CLASS}`, 'frame', 'font-family: sample-Brand, serif;'))
    expect(css).toMatch(moduleRule(`html.${HTML_CLASS}`, 'label', 'color: #101010;'))
    expect(css).toMatch(/@font-face \{\s*font-family: sample-Brand;/)
    expect(css).not.toContain(`${HTML_CLASS}-${HTML_CLASS}-`)
    expect(css).toMatch(moduleRule(`${MOTION}.${HTML_CLASS}`, 'frame', 'transition: none;'))
  }, BUILD_TIMEOUT_MS)

  it('refuses an htmlClass the server would refuse, before it builds', () => {
    const folder = tempFolder({ 'theme.json': JSON.stringify({ htmlClass: 'Not A Class' }) })
    expect(() => harnessConfig(folder)).toThrow('htmlClass "Not A Class" must be')
  })
})

describe("the harness build's page: the host's fonts", () => {
  it("binds core's three variables on <html> and emits each of core's faces, apart from the theme's sheet", async () => {
    const outDir = await builtHarness(tempFolder(SAMPLE))
    const page = readFileSync(join(outDir, PAGE_FILE), 'utf8')
    const sheet = pageSheet(page)
    const { faces, files } = readHostFonts()
    const pinned = new Map(files.map(({ file, sha256 }) => [file, sha256]))
    const drawn = pageFaces(sheet)
    expect(drawn, "an @font-face for each of core's faces, and no other").toHaveLength(faces.length)
    const families = CORE_FONT_VARIABLES.map((variable) => boundFamily(sheet, variable, htmlClassesOf(page)))
    expect(new Set(families).size, 'each variable has a family of its own').toBe(CORE_FONT_VARIABLES.length)
    faces.forEach((face) => {
      expectFace(outDir, drawn, face, families[CORE_FONT_VARIABLES.indexOf(face.variable)] ?? '', pinned.get(face.file))
    })
    const themeCss = writtenStylesheets(outDir).join('\n')
    const hostNames = [...CORE_FONT_VARIABLES, ...families]
    hostNames.forEach((name) => expect(themeCss, `the theme's stylesheet holds no ${name}`).not.toContain(name))
  }, BUILD_TIMEOUT_MS)
})

describe('the pass over the written stylesheets', () => {
  it("wraps and renames each stylesheet in the app's folder, and leaves every other file as it is", () => {
    const out = tempFolder({
      [`${APP_ASSETS_DIR}/style-a1.css`]: '@font-face { font-family: Brand; src: local("Arial"); }\n.sample-a-AbCdE { font-family: Brand; }\n',
      [`${APP_ASSETS_DIR}/index-a1.js`]: 'export {}\n',
      'assets/notes.css': '.left { color: red; }\n',
    })
    expect(wrapWrittenStylesheets(out, HTML_CLASS)).toEqual([join(out, APP_ASSETS_DIR, 'style-a1.css')])
    const read = (path: string): string => readFileSync(join(out, path), 'utf8')
    expect(read(`${APP_ASSETS_DIR}/style-a1.css`)).toContain('html.sample .sample-a-AbCdE { font-family: sample-Brand; }')
    expect(read(`${APP_ASSETS_DIR}/index-a1.js`)).toBe('export {}\n')
    expect(read('assets/notes.css')).toBe('.left { color: red; }\n')
  })

  it("is the preset's wrap, then the mirror", () => {
    const css = harnessStylesheet('@media (prefers-reduced-motion: reduce) { .a { transition: none; } }', HTML_CLASS)
    expect(css).toContain(`${MOTION}.${HTML_CLASS} .a { transition: none; }`)
  })
})

describe('the media mirror', () => {
  it("copies each reduced-motion and forced-colours rule after its block, under the toolbar's attribute", () => {
    const css = mirrored([
      '@media (prefers-reduced-motion: reduce) { html.sample .a { transition: none; } }',
      '@media (forced-colors: active) { :where(html.sample) .b { color: CanvasText; } }',
    ].join('\n'))
    const nodes = postcss.parse(css).nodes
    expect(nodes.filter((node) => node.type === 'atrule')).toHaveLength(2)
    expect(nodes.filter(isRule).map((rule) => rule.selector)).toEqual([`${MOTION}.sample .a`, `:where(${FORCED}.sample) .b`])
  })

  it('leaves a query with more than its one feature as it is', () => {
    const css = '@media screen and (prefers-reduced-motion: reduce) { html.sample .c { transition: none; } }'
    expect(mirrored(css)).toBe(css)
  })

  it.each([
    ['html.sample .a', `${MOTION}.sample .a`],
    [':where(html.sample) .a', `:where(${MOTION}.sample) .a`],
    ['.a', `${MOTION} .a`],
  ])('puts %s under the attribute', (selector, expected) => {
    expect(underAttribute(selector, MOTION)).toBe(expected)
  })
})
