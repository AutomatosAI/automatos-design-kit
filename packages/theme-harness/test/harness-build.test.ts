// @vitest-environment node
// PRD-261 B-02e: the harness build draws a theme's CSS as the theme's own build makes it. A real build of a small
// theme folder (made-up data, in the system temp folder): CSS modules name its classes first, then the one stylesheet
// the build writes is wrapped under html.<htmlClass> and renamed once over the whole sheet (a font family declared in
// one file and used in another is renamed in both), and its reduced-motion rule is copied under the toolbar's
// attribute. Then the steps alone: the pass over the written files, the media mirror and the selector forms it writes.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import postcss, { type ChildNode, type Rule } from 'postcss'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { FORCED_ACTIVE, HTML_ATTRS, MOTION_REDUCE } from '../src/host/prepaint.ts'
import {
  APP_ASSETS_DIR, harnessConfig, harnessStylesheet, mediaMirror, underAttribute, wrapWrittenStylesheets,
} from '../vite.harness.config.ts'

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

/** The stylesheets a harness build of `themeDir` writes, as text. */
async function builtStylesheets(themeDir: string): Promise<string[]> {
  const outDir = tempFolder({})
  const config = harnessConfig(themeDir)
  await build({ ...config, configFile: false, logLevel: 'silent', build: { ...config.build, outDir } })
  const dir = join(outDir, APP_ASSETS_DIR)
  return readdirSync(dir).filter((name) => name.endsWith('.css')).map((name) => readFileSync(join(dir, name), 'utf8'))
}

const isRule = (node: ChildNode): node is Rule => node.type === 'rule'
const mirrored = (css: string): string => postcss([mediaMirror()]).process(css, { from: undefined }).css

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
